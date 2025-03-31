# Bee Bussell
# February 26, 2025
# Script that will take an array of video files and stitch them together into one video file
# using FFmpeg. This script will be called by the OBS script pygamer-replay.py.

import os
import sys
import subprocess
import obspython as obs
import threading # Used so we aren't blocking the main thread

def stitch_videos(folder_path, output_path, sort_lambda=None):

    """Stitches all video files in a folder into one using FFmpeg with customizable sorting."""
    obs.script_log(obs.LOG_INFO, f"Stitching videos in folder: {folder_path}")

    if not os.path.exists(folder_path) or not os.path.isdir(folder_path):
        obs.script_log(obs.LOG_WARNING, f"Invalid folder path: {folder_path}")
        return None

    # Collect all .mkv files in the folder
    video_files = [f for f in os.listdir(folder_path) if f.endswith(".mp4")]

    if not video_files:
        obs.script_log(obs.LOG_WARNING, "No video files found to stitch.")
        return None

    # Default sorting (newest to oldest) if no custom function is provided
    if sort_lambda is None:
        sort_lambda = lambda f: os.path.getmtime(os.path.join(folder_path, f))

    # Apply sorting
    video_files = sorted(video_files, key=sort_lambda, reverse=False)

    # Logging file order
    obs.script_log(obs.LOG_INFO, "Sorted video file order:")
    for video in video_files:
        obs.script_log(obs.LOG_INFO, f"- {video}")

    # Create a temporary file list for FFmpeg
    list_file_path = os.path.join(folder_path, "file_list.txt")
    with open(list_file_path, "w") as f:
        for video in video_files:
            f.write(f"file '{os.path.join(folder_path, video)}'\n")

    # Define the output stitched video path
    output_video = output_path

    # FFmpeg command to concatenate videos
    ffmpeg_cmd = [
        "/opt/homebrew/bin/ffmpeg",
        "-f", "concat",
        "-safe", "0",
        "-i", list_file_path,
        "-c", "copy",
        output_video
    ]

    # Run FFmpeg
    # def run_ffmpeg():
    #     try:
    #         result = subprocess.run(ffmpeg_cmd, capture_output=True, text=True, check=True)
    #         obs.script_log(obs.LOG_INFO, f"FFmpeg output: {result.stdout}")
    #         obs.script_log(obs.LOG_INFO, f"Successfully stitched videos into {output_video}")
    #     except subprocess.CalledProcessError as e:
    #         obs.script_log(obs.LOG_ERROR, f"FFmpeg error: {e.stderr}")
    #         return None
    #     finally:
    #         os.remove(list_file_path)  # Clean up temp file


    try:
 
        result = subprocess.run(ffmpeg_cmd, capture_output=True, text=True, check=True)
        obs.script_log(obs.LOG_INFO, f"FFmpeg output: {result.stdout}")
        obs.script_log(obs.LOG_INFO, f"Successfully stitched videos into {output_video}")

    except subprocess.CalledProcessError as e:
 
        obs.script_log(obs.LOG_ERROR, f"FFmpeg error: {e.stderr}")
 
        return None


    # ffmpeg_thread = threading.Thread(target=run_ffmpeg)
    # ffmpeg_thread.start()
    


    return output_video


def main():
    """Main function to run stitch_videos from command line."""
    if len(sys.argv) < 2:
        print("Usage: python stitch_videos.py <folder_path>")
        sys.exit(1)

    folder_path = sys.argv[1]
    output_path = sys.argv[1]  # Can change if a different output directory is needed
    result = stitch_videos(folder_path, output_path)

    if result:
        print(f"Successfully stitched videos into {result}")
    else:
        print("Failed to stitch videos.")


if __name__ == "__main__":
    main()
