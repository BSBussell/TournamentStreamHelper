# Bee Bussell
# February 26, 2025
# Script for dynamically building and managing replay compilations in OBS

import obspython as obs     # Because this is an OBS script
import os                   # For file operations
import time                 # For timestamping
import random               # Shuffle mode
import json                 # For loading config.json
import shutil               # For moving files

from stitch_videos import stitch_videos # Import the stitch_videos function from the other script


# Global Hotkeys
# Clear Hotkey
clear_hotkey_id = None
# Build Compilation Hotkey
build_comp_hotkey_id = None


"""Sets the media source in OBS with the given file path."""
def set_media(source_name, path):
    source = obs.obs_get_source_by_name(source_name)
    if source is None:
        obs.script_log(obs.LOG_WARNING, f"SetMedia: Source '{source_name}' not found.")
        return False

    settings = obs.obs_data_create()
    source_id = obs.obs_source_get_id(source)

    if source_id == "ffmpeg_source":
        obs.obs_data_set_string(settings, "local_file", path)
        obs.obs_data_set_bool(settings, "is_local_file", True)
        obs.obs_source_update(source, settings)
        obs.script_log(obs.LOG_INFO, f"SetMedia: Updated ffmpeg source '{source_name}' with path: {path}")

    elif source_id == "vlc_source":
        array = obs.obs_data_array_create()
        item = obs.obs_data_create()

        obs.obs_data_set_string(item, "value", path)
        obs.obs_data_array_push_back(array, item)
        obs.obs_data_set_array(settings, "playlist", array)
        obs.obs_source_update(source, settings)

        obs.obs_data_release(item)
        obs.obs_data_array_release(array)
        obs.script_log(obs.LOG_INFO, f"SetMedia: Updated VLC source '{source_name}' with path: {path}")

    else:
        obs.script_log(obs.LOG_WARNING, f"SetMedia: Unsupported source type for '{source_name}'.")

    obs.obs_data_release(settings)
    obs.obs_source_release(source)
    return True




# A Class that manages a single replay compilation
class ReplayCompilation:
    def __init__(self, name):
        self.name = name
        self.source_name = ""
        self.hotkey_id = None
        self.stitch_hotkey_id = None
        self.folder_path = ""
        self.attempts = 0
        self.last_replay = ""
        self.shuffle_mode = False
        self.ignore_all = False

    def try_play(self):
        """Attempts to play the latest replay."""
        # global last_replay, attempts
        obs.script_log(obs.LOG_INFO, "Trying to play the latest replay.")

        replay_buffer = obs.obs_frontend_get_replay_buffer_output()
        if replay_buffer is None:
            obs.remove_current_callback()
            return

        cd = obs.calldata_create()
        ph = obs.obs_output_get_proc_handler(replay_buffer)
        obs.proc_handler_call(ph, "get_last_replay", cd)
        path = obs.calldata_string(cd, "path")
        obs.calldata_destroy(cd)
        obs.obs_output_release(replay_buffer)

        if path and self.folder_path:
            filename = os.path.basename(path)
            dest_path = os.path.join(self.folder_path, filename)

            os.makedirs(self.folder_path, exist_ok=True)

            try:
                shutil.copy(path, dest_path)
                path = dest_path
                obs.script_log(obs.LOG_INFO, f"Replay moved to: {dest_path}")
            except Exception as e:
                obs.script_log(obs.LOG_ERROR, f"Failed to move replay: {e}")

        if path == self.last_replay:
            path = None

        if path is None:
            self.attempts += 1
            if self.attempts >= 10:
                obs.remove_current_callback()
        else:
            self.last_replay = path
            set_media(self.source_name, path)
            obs.remove_current_callback()

    def save_replay(self, pressed):
        """Handles instant replay hotkey press."""
        if not pressed:
            return

        replay_buffer = obs.obs_frontend_get_replay_buffer_output()
        if replay_buffer:
            ph = obs.obs_output_get_proc_handler(replay_buffer)
            # obs.proc_handler_call(ph, "save", None) # No need to save here

            if not self.folder_path:
                obs.script_log(obs.LOG_WARNING, self.name + "'s Replay folder not set.")
                return

            replay_filename = time.strftime("replay_%Y-%m-%d_%H-%M-%S.mp4")
            full_path = os.path.join(self.folder_path, replay_filename)

            obs.script_log(obs.LOG_INFO, f"Saving replay to: {full_path}")

            cd = obs.calldata_create()
            obs.calldata_set_string(cd, "path", full_path)
            obs.proc_handler_call(ph, "save", cd)
            obs.calldata_destroy(cd)



            if obs.obs_output_active(replay_buffer):

                self.attempts = 0
                obs.timer_add(self.try_play, 2000)
            else:
                obs.script_log(obs.LOG_WARNING, "Replay buffer is not active!")

            obs.obs_output_release(replay_buffer)

    # TODO: Implement this in a way that doesn't block the main thread
    def stitch_replays(self, pressed):
        """Handles the stitching hotkey press."""
        if not pressed:
            return

        obs.script_log(obs.LOG_INFO, "Stitching replays together.")


        # Custom set sorting lambda:
        # - "replay_" files sorted oldest to newest
        # - Other files sorted newest to oldest
        def set_sort(file):
            path = os.path.join(self.folder_path, file)
            timestamp = os.path.getmtime(path)

            # Check if file is a replay file
            is_replay = file.lower().startswith("replay")

            # Sorting logic:
            # - Replay files (0) → sorted by timestamp (oldest first)
            # - Other files (1) → sorted by timestamp (newest first)
            return (0 if is_replay else 1, timestamp if is_replay else -timestamp)

        # Random shuffle
        def bogo_sort(file):
            return random.random()


        # Add time to the file name to prevent overwriting
        # Get current time in a safe format for filenames
        time_str = time.strftime("%Y-%m-%d_%H-%M-%S")

        # Define the file path
        dest_file = os.path.join(self.folder_path, f"{self.name}_comp_{time_str}.mp4")

        # Call the stitch_videos function
        if self.shuffle_mode:

            # Delete the old compilation
            # This is a file that starts with {self.name}_comp_
            video_files = [f for f in sorted(os.listdir(self.folder_path)) if f.startswith(f"{self.name}_comp_")]

            for video in video_files:
                obs.script_log(obs.LOG_INFO, f"Deleting old compilation: {video}")
                os.remove(os.path.join(self.folder_path, video))


            comp = stitch_videos(self.folder_path, dest_file, sort_lambda=bogo_sort)
        else:
            comp = stitch_videos(self.folder_path, dest_file,  sort_lambda=set_sort)

        if comp:

            set_media(self.source_name,comp)

            # Delete the old replays if we're not in shuffle mode
            if not self.shuffle_mode:
                # Delete the old replays
                # Collect all .mp4 files in the folder that are not named comp
                video_files = [f for f in sorted(os.listdir(self.folder_path)) if f.endswith(".mp4") and f != os.path.basename(comp)]

                for video in video_files:
                    obs.script_log(obs.LOG_INFO, f"Deleting old replay: {video}")
                    os.remove(os.path.join(self.folder_path, video))

                obs.script_log(obs.LOG_INFO, f"Deleted old replays.")

    def clear_replays(self, pressed):
        """Handles the clearing hotkey press."""
        if not pressed or self.folder_path == '':
            return

        obs.script_log(obs.LOG_INFO, "Clearing all replays.")
        video_files = [f for f in sorted(os.listdir(self.folder_path)) if f.endswith(".mp4")]

        for video in video_files:
            obs.script_log(obs.LOG_INFO, f"Deleting old replay: {video}")
            os.remove(os.path.join(self.folder_path, video))


        # Stop media source playback
        source = obs.obs_get_source_by_name(self.source_name)
        if source:
            obs.obs_source_media_stop(source)
            obs.obs_source_release(source)

        # Clear the media source of its path
        set_media(self.source_name, "")

        obs.script_log(obs.LOG_INFO, f"Deleted all replays.")

    def update(self, settings):

        self.source_name = obs.obs_data_get_string(settings, self.name + "_source")
        self.folder_path = obs.obs_data_get_string(settings, self.name + "_folder")
        self.shuffle_mode = obs.obs_data_get_bool(settings, self.name + "_shuffle_mode")
        self.ignore_all = obs.obs_data_get_bool(settings, self.name + "_ignore_all")

        if not self.folder_path:
            obs.script_log(obs.LOG_WARNING, "No folder set for saving replays.")
        else:
            obs.script_log(obs.LOG_INFO, f"Replay folder set to: {self.folder_path}")


    def create_group(self):
        group = obs.obs_properties_create()
        p = obs.obs_properties_add_list(group, self.name + "_source", "Media Source", obs.OBS_COMBO_TYPE_EDITABLE, obs.OBS_COMBO_FORMAT_STRING)
        sources = obs.obs_enum_sources()
        if sources:
            for source in sources:
                source_id = obs.obs_source_get_id(source)
                if source_id in ["ffmpeg_source", "vlc_source"]:
                    name = obs.obs_source_get_name(source)
                    obs.obs_property_list_add_string(p, name, name)
        obs.source_list_release(sources)

        obs.obs_properties_add_path(group, self.name + "_folder", "Replay Save Folder", obs.OBS_PATH_DIRECTORY, None, None)

        # bool set to false titled "Shuffle Mode" with a default value of false
        obs.obs_properties_add_bool(group, self.name + "_shuffle_mode", "Shuffle Mode")

        # bool set to false titled "Ignore All" with a default value of false
        obs.obs_properties_add_bool(group, self.name + "_ignore_all", "Ignore Clear All")

        return group


    def load_hotkey(self, settings):
        def load_hotkey(self, settings):
            replay_name = self.name + "_save.trigger"
            replay_lbl = self.name + " Save Clip"
            stitch_name = self.name + "_stitch.trigger"
            stitch_lbl = self.name + " Build Compilation"

            def make_replay_callback(instance):
                return lambda pressed: instance.save_replay(pressed)

            def make_stitch_callback(instance):
                return lambda pressed: instance.stitch_replays(pressed)

            self.hotkey_id = obs.obs_hotkey_register_frontend(replay_name, replay_lbl, make_replay_callback(self))
            self.stitch_hotkey_id = obs.obs_hotkey_register_frontend(stitch_name, stitch_lbl, make_stitch_callback(self))

            obs.script_log(obs.LOG_INFO, f"Registered hotkey for {replay_lbl} with ID {self.hotkey_id}")
            obs.script_log(obs.LOG_INFO, f"Registered hotkey for {stitch_lbl} with ID {self.stitch_hotkey_id}")

            # Load saved hotkeys
            hotkey_data = obs.obs_data_get_array(settings, replay_name)
            if hotkey_data:
                obs.obs_hotkey_load(self.hotkey_id, hotkey_data)
                obs.obs_data_array_release(hotkey_data)

            stitch_hotkey_data = obs.obs_data_get_array(settings, stitch_name)
            if stitch_hotkey_data:
                obs.obs_hotkey_load(self.stitch_hotkey_id, stitch_hotkey_data)
                obs.obs_data_array_release(stitch_hotkey_data)

    def save_hotkey(self, settings):
        if self.hotkey_id is not None:
            replay_name = self.name + "_save.trigger"
            obs.obs_data_set_array(settings, replay_name, obs.obs_hotkey_save(self.hotkey_id))

        if self.stitch_hotkey_id is not None:
            stitch_name = self.name + "_stitch.trigger"
            obs.obs_data_set_array(settings, stitch_name, obs.obs_hotkey_save(self.stitch_hotkey_id))





# OBS Settings UI
def script_update(settings):
    for each in replay_comps:
        each.update(settings)


def script_description():
    return "Multi Replay Compilation with Auto-Stitching\n\nBy Bee Bussell"


def script_properties():

    """Dynamically creates UI properties for all replay compilations."""
    props = obs.obs_properties_create()

    for replay_comp in replay_comps:
        group = replay_comp.create_group()
        obs.obs_properties_add_group(props, replay_comp.name, replay_comp.name, obs.OBS_GROUP_NORMAL, group)

    # Section for adding new compilations here

    return props

def clear_replays(pressed):
    for each in replay_comps:
        if not each.ignore_all:
            each.clear_replays(pressed)

def build_all(pressed):
    for each in replay_comps:
        each.stitch_replays(pressed)

def script_load(settings):

    if settings is None:
        obs.script_log(obs.LOG_WARNING, "Settings not loaded! Hotkeys may fail.")
        return


    # Global hotkey for clearing all replays
    global clear_hotkey_id
    clear_hotkey_id = obs.obs_hotkey_register_frontend("clear_replays.trigger", "Clear All Replays", clear_replays)
    obs.script_log(obs.LOG_INFO, f"Registered hotkey for Clear All Replays with ID {clear_hotkey_id}")

    # Load saved hotkeys
    hotkey_data = obs.obs_data_get_array(settings, "clear_replays.trigger")
    if hotkey_data:
        obs.obs_hotkey_load(clear_hotkey_id, hotkey_data)
        obs.obs_data_array_release(hotkey_data)

    # Global hotkey for building compilation
    global build_comp_hotkey_id
    build_comp_hotkey_id = obs.obs_hotkey_register_frontend("build_comp.trigger", "Build Compilation", build_all)
    obs.script_log(obs.LOG_INFO, f"Registered hotkey for Build Compilation with ID {build_comp_hotkey_id}")

    # Load saved hotkeys
    hotkey_data = obs.obs_data_get_array(settings, "build_comp.trigger")
    if hotkey_data:
        obs.obs_hotkey_load(build_comp_hotkey_id, hotkey_data)
        obs.obs_data_array_release(hotkey_data)

    # Load Individual Replay Comp Hotkeys

    # Evil Spells
    def make_replay_callback(instance):
            return lambda pressed: instance.save_replay(pressed)

    def make_stitch_callback(instance):
        return lambda pressed: instance.stitch_replays(pressed)


    for each in replay_comps:
        replay_name = each.name + "_save.trigger"
        replay_lbl = each.name + " Save Clip"
        stitch_name = each.name + "_stitch.trigger"
        stitch_lbl = each.name + " Build Compilation"

        each.hotkey_id = obs.obs_hotkey_register_frontend(replay_name, replay_lbl,  make_replay_callback(each))
        each.stitch_hotkey_id = obs.obs_hotkey_register_frontend(stitch_name, stitch_lbl, make_stitch_callback(each))

        obs.script_log(obs.LOG_INFO, f"Registered hotkey for {replay_lbl} with ID {each.hotkey_id}")
        obs.script_log(obs.LOG_INFO, f"Registered hotkey for {stitch_lbl} with ID {each.stitch_hotkey_id}")

        hotkey_data = obs.obs_data_get_array(settings, replay_name)
        if hotkey_data:  # Ensure it's not None
            obs.obs_hotkey_load(each.hotkey_id, hotkey_data)
            obs.obs_data_array_release(hotkey_data)

        stitch_hotkey_data = obs.obs_data_get_array(settings, stitch_name)
        if stitch_hotkey_data:  # Ensure it's not None
            obs.obs_hotkey_load(each.stitch_hotkey_id, stitch_hotkey_data)
            obs.obs_data_array_release(stitch_hotkey_data)


def script_save(settings):

    # Save Global Hotkeys
    if clear_hotkey_id is not None:
        obs.obs_data_set_array(settings, "clear_replays.trigger", obs.obs_hotkey_save(clear_hotkey_id))

    if build_comp_hotkey_id is not None:
        obs.obs_data_set_array(settings, "build_comp.trigger", obs.obs_hotkey_save(build_comp_hotkey_id))

    # Save Individual Hotkeys
    for each in replay_comps:
        if each.hotkey_id is not None:
            replay_name = each.name + "_save.trigger"
            obs.obs_data_set_array(settings, replay_name, obs.obs_hotkey_save(each.hotkey_id))

        if each.stitch_hotkey_id is not None:
            stitch_name = each.name + "_stitch.trigger"
            obs.obs_data_set_array(settings, stitch_name, obs.obs_hotkey_save(each.stitch_hotkey_id))


replay_comps = []

# Load replay compilations from config.json
config_path = os.path.join(os.path.dirname(__file__), "config.json")
if os.path.exists(config_path):
    with open(config_path, "r") as config_file:
        config = json.load(config_file)
        for comp_name in config.get("Compilations", []):
            replay_comps.append(ReplayCompilation(comp_name))
else:
    obs.script_log(obs.LOG_WARNING, "config.json not found. No replay compilations loaded.")
