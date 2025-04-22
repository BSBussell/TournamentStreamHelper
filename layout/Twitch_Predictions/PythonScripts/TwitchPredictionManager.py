#!/usr/bin/env python3
# -*- coding: utf-8 -*-
"""
Twitch Prediction Manager
A unified script for managing Twitch predictions for streamers.

Functionality:
1. Automatically obtains the broadcaster ID if not already in config
2. Creates and resolves predictions based on tournament data
3. Continually updates prediction information to a JSON file for overlays
"""

import requests
import json
import os
import configparser
import time
import threading
import argparse
import sys

# Path constants
SCRIPT_DIR = os.path.dirname(os.path.abspath(__file__))
CONFIG_PATH = os.path.join(SCRIPT_DIR, "config.ini")
PREDICTION_INFO_PATH = os.path.join(SCRIPT_DIR, "prediction_info.json")

# Global variables
exit_flag = threading.Event()
config = configparser.ConfigParser()


def setup_config():
    """Initialize the config file if it doesn't exist or is missing required fields."""
    if not os.path.exists(CONFIG_PATH):
        print("ℹ️ No config.ini found. Creating one with example values.")
        config['Twitch'] = {
            'access_token': '',
            'client_id': '',
            'broadcaster_id': ''
        }
        config['TSH'] = {
            'tsh_out': '../../../out/',
            'prediction_time': '600'
        }
        with open(CONFIG_PATH, 'w') as configfile:
            config.write(configfile)
        print("⚠️ Please edit config.ini with your Twitch API credentials.")
        return False
    
    config.read(CONFIG_PATH)
    
    # Check for required Twitch credentials
    if ('Twitch' not in config or 
            not config['Twitch'].get('access_token') or 
            not config['Twitch'].get('client_id')):
        print("⚠️ Missing Twitch credentials in config.ini.")
        print("Please add your access_token and client_id to the [Twitch] section.")
        return False
    
    # Ensure the TSH section exists
    if 'TSH' not in config:
        config['TSH'] = {
            'tsh_out': '../../../out/',
            'prediction_time': '600'
        }
        with open(CONFIG_PATH, 'w') as configfile:
            config.write(configfile)
    
    return True

def retry_request(func, retries=3, delay=1):
    for attempt in range(retries):
        response = func()
        if response and response.ok:
            return response
        
        print(f"❌ Attempt {attempt + 1} failed. Retrying...")
        time.sleep(delay)
    return None

def get_user_id():
    """Get the broadcaster's Twitch user ID and save it to config.ini."""
    try:
        access_token = config.get('Twitch', 'access_token')
        client_id = config.get('Twitch', 'client_id')

        headers = {
            "Authorization": f"Bearer {access_token}",
            "Client-Id": client_id,
        }

        response = retry_request(lambda: requests.get("https://api.twitch.tv/helix/users", headers=headers))

        if response.ok:
            data = response.json().get("data", [])
            if data:
                user_id = data[0]["id"]
                print(f"User ID: {user_id}")

                # Save user ID to config
                config.set('Twitch', 'broadcaster_id', user_id)
                with open(CONFIG_PATH, "w") as configfile:
                    config.write(configfile)
                
                print("✅ User ID saved to config.ini")
                return user_id
            else:
                print("❌ No user data found.")
                return None
        else:
            print(f"❌ Error fetching user data: {response.status_code}")
            print(response.text)
            return None
    except Exception as e:
        print(f"❌ An error occurred: {e}")
        return None


def get_file_path(relative_path):
    """Convert a relative path from config to an absolute path."""
    base_dir = config.get('TSH', 'tsh_out', fallback='../../../out/')
    if relative_path.startswith(base_dir):
        # Path is already relative to TSH_OUT
        full_path = os.path.join(SCRIPT_DIR, relative_path)
    else:
        # Create full path
        full_path = os.path.join(SCRIPT_DIR, base_dir, relative_path.lstrip('/'))
    
    return os.path.normpath(full_path)


def read_file_content(file_path):
    """Read content from a file, handling errors gracefully."""
    try:
        with open(file_path, "r") as f:
            return f.read().strip()
    except FileNotFoundError:
        print(f"❌ File not found: {file_path}")
        return None
    except Exception as e:
        print(f"❌ Error reading {file_path}: {e}")
        return None


def get_player_tags():
    """Get player tags from TSH files."""
    p1_file = get_file_path(os.path.join('score/1/team/1/player/1/name.txt'))
    p2_file = get_file_path(os.path.join('score/1/team/2/player/1/name.txt'))
    
    p1 = read_file_content(p1_file)
    p2 = read_file_content(p2_file)
    
    if not p1 or not p2:
        return None
    
    return [p1, p2]


def get_round_name():
    """Get the current round name from TSH files."""
    round_file = get_file_path(os.path.join('score/1/match.txt'))
    return read_file_content(round_file)


def get_scores():
    """Get current scores from TSH files."""
    p1_score_file = get_file_path(os.path.join('score/1/team/1/score.txt'))
    p2_score_file = get_file_path(os.path.join('score/1/team/2/score.txt'))
    
    p1_score_text = read_file_content(p1_score_file)
    p2_score_text = read_file_content(p2_score_file)
    
    if not p1_score_text or not p2_score_text:
        return None, None
    
    try:
        p1_score = int(p1_score_text)
        p2_score = int(p2_score_text)
        return p1_score, p2_score
    except ValueError:
        print("❌ Error parsing scores as integers.")
        return None, None


def get_active_prediction_id_and_outcome_ids():
    """Get the active prediction ID and outcome IDs."""
    access_token = config.get('Twitch', 'access_token')
    client_id = config.get('Twitch', 'client_id')
    broadcaster_id = config.get('Twitch', 'broadcaster_id')

    url = "https://api.twitch.tv/helix/predictions"
    headers = {
        "Authorization": f"Bearer {access_token}",
        "Client-Id": client_id,
    }
    params = {
        "broadcaster_id": broadcaster_id,
    }

    
    response = retry_request(lambda: requests.get(url, headers=headers, params=params))
    if response.ok:
        data = response.json().get("data", [])
        if not data:
            print("ℹ️ No active predictions found.")
            return None, None
        prediction = data[0]
        prediction_id = prediction["id"]
        outcomes = {outcome["title"]: outcome["id"] for outcome in prediction["outcomes"]}
        return prediction_id, outcomes
    else:
        print(f"❌ Failed to fetch active predictions: {response.status_code}")
        print(response.text)
        return None, None


def resolve_prediction(prediction_id, winning_outcome_id):
    """Resolve an active prediction with a winner."""
    access_token = config.get('Twitch', 'access_token')
    client_id = config.get('Twitch', 'client_id')
    broadcaster_id = config.get('Twitch', 'broadcaster_id')

    url = "https://api.twitch.tv/helix/predictions"
    headers = {
        "Authorization": f"Bearer {access_token}",
        "Client-Id": client_id,
        "Content-Type": "application/json"
    }
    payload = {
        "broadcaster_id": broadcaster_id,
        "id": prediction_id,
        "status": "RESOLVED",
        "winning_outcome_id": winning_outcome_id
    }

    response = requests.patch(url, headers=headers, json=payload)
    if response.ok:
        print("✅ Prediction resolved successfully!")
        return True
    else:
        print(f"❌ Failed to resolve prediction: {response.status_code}")
        print(response.text)
        return False


def post_prediction():
    """Post a new prediction based on the current match."""
    access_token = config.get('Twitch', 'access_token')
    client_id = config.get('Twitch', 'client_id')
    broadcaster_id = config.get('Twitch', 'broadcaster_id')
    
    round_name = get_round_name()
    if not round_name:
        print("❌ Could not retrieve round name.")
        return False

    player_tags = get_player_tags()
    if not player_tags:
        print("❌ Could not retrieve player tags.")
        return False
    
    prediction_time = config.getint('TSH', 'prediction_time', fallback=600)
    title = f"Who will win {round_name}?"

    url = "https://api.twitch.tv/helix/predictions"
    headers = {
        "Authorization": f"Bearer {access_token}",
        "Client-Id": client_id,
        "Content-Type": "application/json",
    }
    payload = {
        "broadcaster_id": broadcaster_id,
        "title": title,
        "outcomes": [{"title": outcome} for outcome in player_tags],
        "prediction_window": prediction_time,
    }

    try:
        response = requests.post(url, headers=headers, json=payload)
        if response.ok:
            print("✅ Prediction started!")
            print(f"   Title: {title}")
            print(f"   Options: {' vs '.join(player_tags)}")
            print(f"   Duration: {prediction_time} seconds")
            return True
        else:
            print(f"❌ Error starting prediction: {response.status_code}")
            print(response.text)
            return False
    except Exception as e:
        print(f"❌ Error posting prediction: {e}")
        return False


def conclude_match():
    """Conclude a match by determining the winner and resolving the prediction."""
    player_tags = get_player_tags()
    if not player_tags:
        print("❌ Could not retrieve player tags.")
        return False
    
    P1, P2 = player_tags
    
    score1, score2 = get_scores()
    if score1 is None or score2 is None:
        print("❌ Could not retrieve scores.")
        return False

    if score1 == score2:
        print("⚠️ Match is a tie. Cannot conclude.")
        return False

    winner = P1 if score1 > score2 else P2
    print(f"🏁 Match finished. Winner: {winner}")

    prediction_id, outcomes = get_active_prediction_id_and_outcome_ids()
    if not prediction_id:
        print("❌ No active prediction to resolve.")
        return False
    
    if prediction_id and outcomes:
        winning_outcome_id = outcomes.get(winner)
        if winning_outcome_id:
            return resolve_prediction(prediction_id, winning_outcome_id)
        else:
            print("❌ Winner not found in current prediction outcomes.")
            print(f"   Available outcomes: {list(outcomes.keys())}")
            print(f"   Winner: {winner}")
            return False
    return False


def fetch_current_prediction():
    """Fetch the current prediction data from Twitch API."""
    access_token = config.get('Twitch', 'access_token')
    client_id = config.get('Twitch', 'client_id')
    broadcaster_id = config.get('Twitch', 'broadcaster_id')
    
    url = f"https://api.twitch.tv/helix/predictions?broadcaster_id={broadcaster_id}"
    headers = {
        'Client-ID': client_id,
        'Authorization': f'Bearer {access_token}'
    }
    
    try:
        response = retry_request(lambda: requests.get(url, headers=headers))
        if response.status_code != 200:
            return None
        data = response.json()
        if not data.get("data"):
            return None
        return data["data"][0]  # Most recent prediction
    except Exception as e:
        print(f"[ERROR] {e}")
        return None


def write_prediction_to_file(prediction):
    """Write prediction data to the JSON file for overlays."""
    if not prediction:
        return
    
    try:
        output = {
            "title": prediction["title"],
            "status": prediction["status"],
            "outcomes": [
                {
                    "title": outcome["title"],
                    "channel_points": outcome["channel_points"],
                    "users": outcome["users"],
                    "top_predictors": outcome["top_predictors"]
                }
                for outcome in prediction["outcomes"]
            ],
            "duration": prediction["prediction_window"],
            "creation_time": prediction["created_at"]
        }
        
        with open(PREDICTION_INFO_PATH, "w", encoding="utf-8") as f:
            json.dump(output, f, indent=2)
    except Exception as e:
        print(f"[ERROR] Writing prediction data: {e}")


def prediction_poller_thread():
    """Background thread to poll for prediction updates and write to file."""
    global exit_flag
    print("[INFO] Starting Twitch prediction poller thread.")
    
    while not exit_flag.is_set():
        try:
            prediction = fetch_current_prediction()
            if prediction:
                write_prediction_to_file(prediction)
        except Exception as e:
            print(f"[ERROR] Poller thread: {e}")
        
        # Sleep for 2 seconds between polls
        sleep_time = 2 # Seconds
        sleep_checks = 20 # Number of checks within the sleep time
        chunk_time = sleep_time / sleep_checks

        # Break sleep time into smaller chunks in order to exit faster
        for _ in range(sleep_checks):  
            if exit_flag.is_set():
                break
            time.sleep(chunk_time)
    
    print("[INFO] Prediction poller thread stopped.")


def display_menu():
    """Display the main menu options."""
    print("\n== Twitch Prediction Manager ==")
    print("1) Post prediction using tournament data")
    print("2) Count score and conclude match")
    print("3) Check current prediction status")
    print("4) Verify configuration")
    print("5) Exit")
    return input("Select an option: ")


def check_prediction_status():
    """Check and display the current prediction status."""
    print("\n== Current Prediction Status ==")
    prediction = fetch_current_prediction()
    
    if not prediction:
        print("No active prediction found.")
        return
    
    status = prediction["status"]
    title = prediction["title"]
    created_at = prediction["created_at"]
    
    print(f"Title: {title}")
    print(f"Status: {status}")
    print(f"Created: {created_at}")
    
    print("\nOutcomes:")
    for outcome in prediction["outcomes"]:
        print(f"  - {outcome['title']}: {outcome['channel_points']} points, {outcome['users']} users")


def verify_configuration():
    """Verify the current configuration and display key settings."""
    print("\n== Configuration Verification ==")
    
    # Check Twitch credentials
    print("Twitch API Configuration:")
    has_token = bool(config.get('Twitch', 'access_token', fallback=None))
    has_client_id = bool(config.get('Twitch', 'client_id', fallback=None))
    has_broadcaster_id = bool(config.get('Twitch', 'broadcaster_id', fallback=None))
    
    print(f"  - Access Token: {'✅ Set' if has_token else '❌ Missing'}")
    print(f"  - Client ID: {'✅ Set' if has_client_id else '❌ Missing'}")
    print(f"  - Broadcaster ID: {'✅ Set' if has_broadcaster_id else '❌ Missing'}")
    
    # Check TSH paths
    print("\nTSH Configuration:")
    tsh_out = config.get('TSH', 'tsh_out', fallback='../../../out/')
    prediction_time = config.getint('TSH', 'prediction_time', fallback=600)
    print(f"  - TSH Output Directory: {tsh_out}")
    print(f"  - Prediction Time: {prediction_time} seconds")
    
    # Test file access
    print("\nTesting File Access:")
    p1_file = get_file_path(os.path.join('score/1/team/1/player/1/name.txt'))
    p2_file = get_file_path(os.path.join('score/1/team/2/player/1/name.txt'))
    round_file = get_file_path(os.path.join('score/1/match.txt'))
    
    p1_exists = os.path.exists(p1_file)
    p2_exists = os.path.exists(p2_file)
    round_exists = os.path.exists(round_file)
    
    print(f"  - Player 1 Name: {'✅ Found' if p1_exists else '❌ Not found'} ({p1_file})")
    print(f"  - Player 2 Name: {'✅ Found' if p2_exists else '❌ Not found'} ({p2_file})")
    print(f"  - Round Name: {'✅ Found' if round_exists else '❌ Not found'} ({round_file})")
    
    # Check prediction output file
    print(f"\nPrediction Output File: {PREDICTION_INFO_PATH}")
    if os.path.exists(PREDICTION_INFO_PATH):
        print("  - ✅ File exists")
        try:
            with open(PREDICTION_INFO_PATH, 'r') as f:
                json.load(f)
            print("  - ✅ Valid JSON format")
        except json.JSONDecodeError:
            print("  - ❌ Invalid JSON format")
    else:
        print("  - ⚠️ File does not exist yet (will be created when prediction is active)")


def main():
    """Main function to run the script."""
    global exit_flag
    
    # Setup configuration
    if not setup_config():
        print("Please configure the application and try again.")
        return

    # Check if broadcaster ID is set, if not, try to get it
    if not config.get('Twitch', 'broadcaster_id', fallback=None):
        print("ℹ️ Broadcaster ID not found in config. Attempting to retrieve it...")
        user_id = get_user_id()
        if not user_id:
            print("Please run the script again after setting up your Twitch credentials.")
            return
    
    # Start the prediction poller thread
    poller_thread = threading.Thread(target=prediction_poller_thread, daemon=True)
    poller_thread.start()
    
    try:
        while True:
            choice = display_menu()
            
            if choice == "1":
                post_prediction()
            elif choice == "2":
                conclude_match()
            elif choice == "3":
                check_prediction_status()
            elif choice == "4":
                verify_configuration()
            elif choice == "5":
                print("Exiting...")
                exit_flag.set()
                break
            else:
                print("Invalid choice. Please try again.")
            
            # Small pause before showing the menu again
            time.sleep(0.5)
    except KeyboardInterrupt:
        print("\nScript interrupted by user.")
    finally:
        # Make sure the poller thread is stopped
        exit_flag.set()
        poller_thread.join(timeout=2)
        print("Goodbye!")


if __name__ == "__main__":
    main()
