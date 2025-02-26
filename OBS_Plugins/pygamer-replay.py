import obspython as obs
import os
import subprocess
import time
import sys

from stitch_videos import stitch_videos

"""Sets the media source in OBS with the given file path."""
def set_media(source_name, path):
    if not path:
        obs.script_log(obs.LOG_WARNING, "SetMedia: Path is None or empty.")
        return False

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


replay_comps = []

class ReplayCompilation:
    def __init__(self, name):
        self.name = name
        self.source_name = ""
        self.hotkey_id = None
        self.stitch_hotkey_id = None
        self.folder_path = ""
        self.attempts = 0
        self.last_replay = ""

    def try_play(self):
        """Attempts to play the latest replay."""
        # global last_replay, attempts

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
                os.rename(path, dest_path)
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

            replay_filename = time.strftime("replay_%Y-%m-%d_%H-%M-%S.mkv")
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

    def stitch_replays(self, pressed):
        """Handles the stitching hotkey press."""
        if not pressed:
            return

        obs.script_log(obs.LOG_INFO, "Stitching replays together.")
        comp = stitch_videos(self.folder_path, self.folder_path)

        if comp:

            set_media(self.source_name,comp)

            # Delete the old replays
            # Collect all .mkv files in the folder that are not named comp
            video_files = [f for f in sorted(os.listdir(self.folder_path)) if f.endswith(".mkv") and f != os.path.basename(comp)]

            for video in video_files:
                obs.script_log(obs.LOG_INFO, f"Deleting old replay: {video}")
                os.remove(os.path.join(self.folder_path, video))

            obs.script_log(obs.LOG_INFO, f"Deleted old replays.")

    def update(self, settings):

        self.source_name = obs.obs_data_get_string(settings, self.name + "_source")
        self.folder_path = obs.obs_data_get_string(settings, self.name + "_folder")

        if not self.folder_path:
            obs.script_log(obs.LOG_WARNING, "No folder set for saving replays.")
        else:
            obs.script_log(obs.LOG_INFO, f"Replay folder set to: {self.folder_path}")

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

    """def script_property(self):
        obs.obs_properties_add_text(group, replay_comp.name + "_source", "Media Source", obs.OBS_TEXT_DEFAULT)
        obs.obs_properties_add_path(group, replay_comp.name + "_folder", "Replay Save Folder", obs.OBS_PATH_DIRECTORY, None, None)

        obs.obs_properties_add_button(group, replay_comp.name + "_remove", "Remove This Compilation", lambda *_: remove_replay_comp(replay_comp))

        obs.obs_properties_add_group(props, replay_comp.name, replay_comp.name, group, False)
        """



replay_comps.append(ReplayCompilation("P1Comp"))
replay_comps.append(ReplayCompilation("P2Comp"))

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
        group = obs.obs_properties_create()

        p = obs.obs_properties_add_list(group, replay_comp.name + "_source", "Media Source", obs.OBS_COMBO_TYPE_EDITABLE, obs.OBS_COMBO_FORMAT_STRING)
        sources = obs.obs_enum_sources()
        if sources:
            for source in sources:
                source_id = obs.obs_source_get_id(source)
                if source_id in ["ffmpeg_source", "vlc_source"]:
                    name = obs.obs_source_get_name(source)
                    obs.obs_property_list_add_string(p, name, name)
        obs.source_list_release(sources)


        obs.obs_properties_add_path(group, replay_comp.name + "_folder", "Replay Save Folder", obs.OBS_PATH_DIRECTORY, None, None)

        # Button for deleting compilation here

        obs.obs_properties_add_group(props, replay_comp.name, replay_comp.name, obs.OBS_GROUP_NORMAL, group)

    # Section for adding new compilations here

    return props


def script_load(settings):

    if settings is None:
        obs.script_log(obs.LOG_WARNING, "Settings not loaded! Hotkeys may fail.")
        return

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
    for each in replay_comps:
        if each.hotkey_id is not None:
            replay_name = each.name + "_save.trigger"
            obs.obs_data_set_array(settings, replay_name, obs.obs_hotkey_save(each.hotkey_id))

        if each.stitch_hotkey_id is not None:
            stitch_name = each.name + "_stitch.trigger"
            obs.obs_data_set_array(settings, stitch_name, obs.obs_hotkey_save(each.stitch_hotkey_id))
