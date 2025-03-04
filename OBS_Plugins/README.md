# PyGamer Replay Script Documentation


## Introduction
PyGamer-Replay, is a script for managing replays in OBS.
It works with OBS's built-in replay buffer. Similarly to Instant Replay, it allows you to bind a hotkey to saving the replay buffer to a file, and playing it on a specified media source.
However, PyGamer-Replay extends this functionality in a way tailored for tournament streams. PyGamer-Replay enables you to store and play more than just one replay file.

This works by building a **Replay Compilation.** A Replay Compilation stores all replays associated with it in a user-specified folder. When the user presses the save hotkey, the replay is saved to the folder. When the user presses the build hotkey, the script stitches all replays in the folder together into a single video file. This video file is then played on a user-specified specified media source.

The script is customizable, allowing you to specify how many **Replay Compilations** you can have. Each **Replay Compilation** can have its own folder, hotkeys, and media source. This allows you to have multiple **Replay Compilations** for different scenarios, such as say a Tournament where you want to build a compilation for each player.
