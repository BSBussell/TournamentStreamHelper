import os
import time
import json
import threading
import requests
from configparser import ConfigParser

# ——— CONFIGURATION ———
CONFIG_PATH = os.path.join(os.path.dirname(__file__), "config.ini")
PREDICTION_INFO_PATH = os.path.join(os.path.dirname(__file__), "prediction_info.json")

config = ConfigParser()
if not os.path.exists(CONFIG_PATH):
    config["Twitch"] = {"access_token": "", "client_id": "", "broadcaster_id": ""}
    config["TSH"] = {"tsh_out": "../../../out/", "prediction_time": "600"}
    with open(CONFIG_PATH, "w") as cfg:
        config.write(cfg)
    raise RuntimeError("Created config.ini—please fill in your Twitch creds and rerun.")
else:
    config.read(CONFIG_PATH)

# ——— RETRY HELPER ———
def retry_request(func, retries=3, delay=1):
    for i in range(1, retries + 1):
        resp = func()
        if resp is not None and resp.ok:
            return resp
        print(f"⚠️ Retry {i}/{retries} failed; waiting {delay}s…")
        time.sleep(delay)
    return None

# ——— TWITCH API FUNCTIONS ———
def get_user_id():
    """Fetch and cache broadcaster_id."""
    headers = {
        "Authorization": f"Bearer {config['Twitch']['access_token']}",
        "Client-Id": config["Twitch"]["client_id"],
    }
    resp = retry_request(lambda: requests.get("https://api.twitch.tv/helix/users", headers=headers))
    if not resp or not resp.ok:
        return None
    data = resp.json().get("data", [])
    if not data:
        return None
    uid = data[0]["id"]
    config.set("Twitch", "broadcaster_id", uid)
    with open(CONFIG_PATH, "w") as cfg:
        config.write(cfg)
    return uid

def get_active_prediction_and_outcomes():
    hdrs = {
        "Authorization": f"Bearer {config['Twitch']['access_token']}",
        "Client-Id": config["Twitch"]["client_id"],
    }
    params = {"broadcaster_id": config["Twitch"]["broadcaster_id"]}
    resp = retry_request(lambda: requests.get("https://api.twitch.tv/helix/predictions", headers=hdrs, params=params))
    if not resp or not resp.ok:
        return None, {}
    items = resp.json().get("data", [])
    if not items:
        return None, {}
    pred = items[0]
    outcomes = {o["title"]: o["id"] for o in pred["outcomes"]}
    return pred["id"], outcomes

def post_prediction(title: str, outcomes: list[str], window: int = config["TSH"]["prediction_time"]) -> bool:
    payload = {
        "broadcaster_id": config["Twitch"]["broadcaster_id"],
        "title": title,
        "outcomes": [{"title": o} for o in outcomes],
        "prediction_window": window,
    }
    hdrs = {
        "Authorization": f"Bearer {config['Twitch']['access_token']}",
        "Client-Id": config["Twitch"]["client_id"],
        "Content-Type": "application/json",
    }
    resp = requests.post("https://api.twitch.tv/helix/predictions", headers=hdrs, json=payload)
    return resp.ok

def resolve_prediction(pred_id: str, winner_id: str) -> bool:
    payload = {
        "broadcaster_id": config["Twitch"]["broadcaster_id"],
        "id": pred_id,
        "status": "RESOLVED",
        "winning_outcome_id": winner_id,
    }
    hdrs = {
        "Authorization": f"Bearer {config['Twitch']['access_token']}",
        "Client-Id": config["Twitch"]["client_id"],
        "Content-Type": "application/json",
    }
    resp = requests.patch("https://api.twitch.tv/helix/predictions", headers=hdrs, json=payload)
    return resp.ok

# --- Cancel prediction ---
def cancel_prediction(pred_id: str) -> bool:
    """Cancel an existing prediction."""
    payload = {
        "broadcaster_id": config["Twitch"]["broadcaster_id"],
        "id": pred_id,
        "status": "CANCELED",
    }
    hdrs = {
        "Authorization": f"Bearer {config['Twitch']['access_token']}",
        "Client-Id": config["Twitch"]["client_id"],
        "Content-Type": "application/json",
    }
    resp = requests.patch("https://api.twitch.tv/helix/predictions", headers=hdrs, json=payload)
    return resp.ok

def fetch_current_prediction() -> dict | None:
    _, _ = get_active_prediction_and_outcomes()  # just to validate credentials
    hdrs = {
        "Authorization": f"Bearer {config['Twitch']['access_token']}",
        "Client-Id": config["Twitch"]["client_id"],
    }
    params = {"broadcaster_id": config["Twitch"]["broadcaster_id"]}
    resp = retry_request(lambda: requests.get("https://api.twitch.tv/helix/predictions", headers=hdrs, params=params))
    if not resp or not resp.ok:
        return None
    data = resp.json().get("data", [])
    print("🔍 Current prediction:", json.dumps(data[0], indent=2) if data else "None")
    return data[0] if data else None

# ——— FILE I/O FOR TSH ———
def get_file_path(rel: str) -> str:
    base = config.get("TSH", "tsh_out", fallback="../../../out/")
    return os.path.normpath(os.path.join(os.path.dirname(__file__), base, rel.lstrip("/")))

def read_text(rel: str) -> str | None:
    path = get_file_path(rel)
    try:
        return open(path, "r").read().strip()
    except Exception:
        return None

def get_player_tags() -> list[str] | None:
    p1 = read_text("score/1/team/1/player/1/name.txt")
    p2 = read_text("score/1/team/2/player/1/name.txt")
    return [p1, p2] if p1 and p2 else None

def get_round_name() -> str | None:
    return read_text("score/1/match.txt")

def get_scores() -> tuple[int, int] | None:
    s1 = read_text("score/1/team/1/score.txt")
    s2 = read_text("score/1/team/2/score.txt")
    try:
        return int(s1), int(s2)
    except Exception:
        return None

def write_prediction_to_file(pred: dict) -> None:
    if not pred:
        return
    out = {
        "title": pred["title"],
        "status": pred["status"],
        "outcomes": [
            {
                "title": o["title"],
                "channel_points": o["channel_points"],
                "users": o["users"],
                "top_predictors": o["top_predictors"],
            }
            for o in pred["outcomes"]
        ],
        "duration": pred["prediction_window"],
        "creation_time": pred["created_at"],
    }
    with open(PREDICTION_INFO_PATH, "w", encoding="utf-8") as f:
        json.dump(out, f, indent=2)

# ——— POLLER THREAD ———
exit_flag = threading.Event()
def start_poller(poll_interval: float = 2.0):
    def _poll():
        while not exit_flag.is_set():
            pred = fetch_current_prediction()
            write_prediction_to_file(pred)
            for _ in range(int(poll_interval * 10)):
                if exit_flag.is_set():
                    break
                time.sleep(poll_interval / 10)
    t = threading.Thread(target=_poll, daemon=True)
    t.start()
    return t