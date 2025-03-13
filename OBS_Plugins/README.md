# PyGamer Replay Script Documentation
> A Script by Bee for usage in The Tennessee Gorilla Productions

## Introduction
PyGamer-Replay is a Python script designed for dynamically building and managing replay compilations in OBS Studio.

While existing solutions rely on storing replays in RAM, making them prone to crashes even on machines with 18GB of RAM, PyGamer-Replay takes a more efficient approach by saving replays directly to disk storage. This enables smoother performance, particularly on lower-end machines.

The script leverages OBS’s built-in replay buffer, extending its functionality beyond Instant Replay by allowing users to:
* Automatically save replays to a folder via hotkey.
* Compile multiple replays into a single video file with a single press.
* Instantly play the stitched compilation on a specified media source in OBS.

This is ideal for tournament streams, highlight compilations, or any scenario where you need a seamless playback of multiple replays without manual video editing.


## Features
### Replay Compilation
A **Replay Compilation** is a collection of replays saved to a specified folder. This script manageds this folder, and enables easy hotkeys for:
1. Saving replays to the folder.
2. Stitching each video in the folder to a single video file.
3. Clearing the folder of all replays.

### Buzzwords
* **Low RAM usage** - As replays are saved directly to disk, the number of replays you can save is only limited by your storage space.
* **Modular** - This script is setup to allow modularity.
* **Customizable** - The script is highly customizable allowing you to dynamically increase the number of **Compilations** you can have through a *lightweight* configuration file, and bundled with a host of options to customize how replays are saved and built.
* **Hotkey Modularity** - Usage of the script is designed to be interfaced through hotkeys. When paired with a Stream Deck, or other macro devices, this script can be used to quickly save replays and build multiple compilations with the push of a single button.

## Installation
You will need OBS

## Usage Guide:
### Configuring Replay Compilation's
Each **Replay Compilation** has a few key settings that must be configured before use.
1. **Folder** - The folder where replays are saved.
2. **Media Source** - The media source where the compilation will be played.
3. **Hotkeys** - The hotkeys used to save replays, build compilations, and clear the folder.

> #### Configuration File
> In order to specify the amount and names of **Replay Compilations**, you will need to edit the `config.json` file. Simply add or remove the name of the compilation you would like to add and refresh the script and the new compilation should appear in the script's settings.


### Hotkey Functions

| Hotkey | Function |
|--------|----------|
|**Compilation Specific Hotkeys**| Hotkeys that are specific per compilation |
| Save Replay | Saves the current replay to the folder. |
| Build Compilation | Stitches all replays in the folder to a single video file and plays it on the specified media source. |
| Clear Replays | Deletes all replays in the folder. |
|**Global Hotkeys**| Hotkeys that are global to all compilations |
| Clear All Replays | Deletes all replays in all folders. |
| Build All Compilations | Builds each replay compilation |

