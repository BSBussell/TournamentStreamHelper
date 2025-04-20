import requests
import json
import os
import configparser



# Loading configs
config = configparser.ConfigParser()
config.read(os.path.join(os.path.dirname(__file__), "config.ini"))

try:
    ACCESS_TOKEN = config.get("Twitch", "ACCESS_TOKEN")
    CLIENT_ID = config.get("Twitch", "CLIENT_ID")
    BROADCASTER_ID = config.get("Twitch", "BROADCASTER_ID")
except (configparser.NoSectionError, configparser.NoOptionError) as e:
    print(f"❌ Error reading Twitch configuration: {e}")
    exit(1)

try:
    TSH_OUT = config.get("TSH", "TSH_OUT")
    PREDICTION_TIME = config.getint("TSH", "PREDICTION_TIME")

    # Use TSH_OUT to use the correct path
    '''
    p1_file = ../../../out/
    p2_file = ../../../out/score/1/team/2/player/1/name.txt
    round_name = ../../../out/score/1/match.txt
    p1_score = ../../../out/score/1/team/1/score.txt
    p2_score = ../../../out/score/1/team/2/score.txt
    '''

    P1_FILE = os.path.join(TSH_OUT, 'score/1/team/1/player/1/name.txt')
    P2_FILE = os.path.join(TSH_OUT, 'score/1/team/2/player/1/name.txt')
    ROUND_NAME = os.path.join(TSH_OUT, 'score/1/match.txt')
    P1_SCORE = os.path.join(TSH_OUT, 'score/1/team/1/score.txt')
    P2_SCORE = os.path.join(TSH_OUT, 'score/1/team/2/score.txt')
    
    # Find paths from file path
    P1_FILE = os.path.join(os.path.dirname(__file__), P1_FILE)
    P2_FILE = os.path.join(os.path.dirname(__file__), P2_FILE)
    ROUND_NAME = os.path.join(os.path.dirname(__file__), ROUND_NAME)
    P1_SCORE = os.path.join(os.path.dirname(__file__), P1_SCORE)
    P2_SCORE = os.path.join(os.path.dirname(__file__), P2_SCORE)
    
except (configparser.NoSectionError, configparser.NoOptionError, ValueError) as e:
    print(f"❌ Error reading TSH configuration: {e}")
    exit(1)



def get_tags():
    with open(P1_FILE, "r") as f:
        P1 = f.read().strip()
    with open(P2_FILE, "r") as f:
        P2 = f.read().strip()
    return [P1, P2]

def get_round():
    with open(ROUND_NAME, "r") as f:
        return f.read().strip()

def get_scores():
    with open(P1_SCORE, "r") as f:
        score1 = int(f.read().strip())
    with open(P2_SCORE, "r") as f:
        score2 = int(f.read().strip())
    return score1, score2

def get_active_prediction_id_and_outcome_ids():
    url = "https://api.twitch.tv/helix/predictions"
    headers = {
        "Authorization": f"Bearer {ACCESS_TOKEN}",
        "Client-Id": CLIENT_ID,
    }
    params = {
        "broadcaster_id": BROADCASTER_ID,
    }

    response = requests.get(url, headers=headers, params=params)
    if response.ok:
        data = response.json().get("data", [])
        if not data:
            print("❌ No active predictions found.")
            return None, None
        prediction = data[0]
        prediction_id = prediction["id"]
        outcomes = {outcome["title"]: outcome["id"] for outcome in prediction["outcomes"]}
        return prediction_id, outcomes
    else:
        print("❌ Failed to fetch active predictions.")
        print(response.text)
        return None, None

def resolve_prediction(prediction_id, winning_outcome_id):
    url = "https://api.twitch.tv/helix/predictions"
    headers = {
        "Authorization": f"Bearer {ACCESS_TOKEN}",
        "Client-Id": CLIENT_ID,
        "Content-Type": "application/json"
    }
    payload = {
        "broadcaster_id": BROADCASTER_ID,
        "id": prediction_id,
        "status": "RESOLVED",
        "winning_outcome_id": winning_outcome_id
    }

    response = requests.patch(url, headers=headers, json=payload)
    if response.ok:
        print("✅ Prediction resolved successfully!")
    else:
        print("❌ Failed to resolve prediction.")
        print(response.text)

def post_prediction():
    title = "Who will win " + get_round() + "?"
    outcomes = get_tags()
    duration = PREDICTION_TIME

    url = "https://api.twitch.tv/helix/predictions"
    headers = {
        "Authorization": f"Bearer {ACCESS_TOKEN}",
        "Client-Id": CLIENT_ID,
        "Content-Type": "application/json",
    }
    payload = {
        "broadcaster_id": BROADCASTER_ID,
        "title": title,
        "outcomes": [{"title": outcome} for outcome in outcomes],
        "prediction_window": duration,
    }

    response = requests.post(url, headers=headers, json=payload)

    if response.ok:
        print("✅ Prediction started!")
        print(json.dumps(response.json(), indent=2))
    else:
        print("❌ Error starting prediction:")
        print(response.text)

def conclude_match():
    P1, P2 = get_tags()
    score1, score2 = get_scores()

    if score1 == score2:
        print("⚠️ Match is a tie. Cannot conclude.")
        return

    winner = P1 if score1 > score2 else P2
    print(f"🏁 Match finished. Winner: {winner}")

    prediction_id, outcomes = get_active_prediction_id_and_outcome_ids()
    if prediction_id and outcomes:
        winning_outcome_id = outcomes.get(winner)
        if winning_outcome_id:
            resolve_prediction(prediction_id, winning_outcome_id)
        else:
            print("❌ Winner not found in current prediction outcomes.")

def menu():
    while True:
        print("\n== Tournament Prediction Menu ==")
        print("1) Post prediction using TSH player files")
        print("2) Count score and conclude match")
        print("3) Exit")
        choice = input("Select an option: ")

        if choice == "1":
            post_prediction()
        elif choice == "2":
            conclude_match()
        elif choice == "3":
            print("Exiting...")
            break
        else:
            print("Invalid choice. Please try again.")

if __name__ == "__main__":
    menu()