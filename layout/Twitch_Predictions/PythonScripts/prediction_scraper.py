import requests
import time
import json
import os
import configparser

# Load config.ini
config = configparser.ConfigParser()
config.read(os.path.join(os.path.dirname(__file__), "config.ini"))

CLIENT_ID = config['Twitch']['client_id']
ACCESS_TOKEN = config['Twitch']['access_token']
BROADCASTER_ID = config['Twitch']['broadcaster_id']

HEADERS = {
    'Client-ID': CLIENT_ID,
    'Authorization': f'Bearer {ACCESS_TOKEN}'
}

OUTPUT_PATH = os.path.join(os.path.dirname(__file__), "prediction_info.json")

def fetch_current_prediction():
    url = f"https://api.twitch.tv/helix/predictions?broadcaster_id={BROADCASTER_ID}"
    response = requests.get(url, headers=HEADERS)
    if response.status_code != 200:
        print(f"[ERROR] Twitch API error: {response.status_code} - {response.text}")
        return None
    data = response.json()
    if not data.get("data"):
        return None
    return data["data"][0]  # Most recent prediction

def write_prediction_to_file(prediction):
    print("Prediction data:")
    print(json.dumps(prediction, indent=4))
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
    with open(OUTPUT_PATH, "w", encoding="utf-8") as f:
        json.dump(output, f, indent=2)
    print("[INFO] Wrote prediction data.")

def main_loop():
    print("[INFO] Starting Twitch prediction poller.")
    while True:
        try:
            prediction = fetch_current_prediction()
            if prediction:
                write_prediction_to_file(prediction)
            else:
                print("[INFO] No active prediction.")
        except Exception as e:
            print(f"[ERROR] {e}")
        time.sleep(2)

if __name__ == "__main__":
    main_loop()