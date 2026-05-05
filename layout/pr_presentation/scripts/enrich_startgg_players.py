#!/usr/bin/env python3
from __future__ import annotations

import argparse
import csv
import json
import os
import re
import sys
import traceback
from pathlib import Path
from typing import Any

import requests

try:
    import orjson
except ImportError:
    orjson = None

try:
    from loguru import logger
except ImportError:
    import logging

    logging.basicConfig(level=logging.INFO, format="%(levelname)s: %(message)s")
    logger = logging.getLogger(__name__)


SCRIPT_DIR = Path(__file__).resolve().parent
LAYOUT_DIR = SCRIPT_DIR.parent
REPO_ROOT = LAYOUT_DIR.parent.parent
PLAYER_DATA_PATH = LAYOUT_DIR / "player_placements_startgg.json"
LOCAL_PLAYERS_PATH = REPO_ROOT / "user_data" / "local_players.csv"
QUERY_PATH = SCRIPT_DIR / "StartGGUserBySlugQuery.txt"
STARTGG_GQL_URL = "https://www.start.gg/api/-/gql"

TOKEN_ENV_NAMES = (
    "STARTGG_TOKEN",
    "START_GG_TOKEN",
    "STARTGG_API_TOKEN",
    "SMASHGG_TOKEN",
)


def load_json(path: Path) -> dict[str, Any]:
    data = path.read_bytes()
    if orjson is not None:
        return orjson.loads(data)
    return json.loads(data.decode("utf-8"))


def write_json(path: Path, data: dict[str, Any]) -> None:
    if orjson is not None:
        encoded = orjson.dumps(data, option=orjson.OPT_INDENT_2 | orjson.OPT_APPEND_NEWLINE)
    else:
        encoded = (json.dumps(data, indent=2, ensure_ascii=False) + "\n").encode("utf-8")
    path.write_bytes(encoded)


def read_query_file(path: Path) -> str:
    return path.read_text(encoding="utf-8")


def startgg_token() -> str | None:
    for env_name in TOKEN_ENV_NAMES:
        token = os.environ.get(env_name)
        if token:
            return token

    settings_path = REPO_ROOT / "user_data" / "settings.json"
    if settings_path.exists():
        try:
            settings = load_json(settings_path)
        except Exception:
            logger.warning(f"Could not read settings from {settings_path}")
            return None

        for key in ("STARTGG_TOKEN", "START_GG_TOKEN", "startgg_token", "startggToken"):
            token = settings.get(key)
            if token:
                return str(token)

    return None


def startgg_headers(token: str | None) -> dict[str, str]:
    headers = {
        "client-version": "20",
        "Content-Type": "application/json",
        "User-Agent": (
            "Mozilla/5.0 (Linux; Android 6.0; Nexus 5 Build/MRA58N) "
            "AppleWebKit/537.36 (KHTML, like Gecko) "
            "Chrome/119.0.0.0 Mobile Safari/537.36"
        ),
    }
    if token:
        headers["Authorization"] = f"Bearer {token}"
    return headers


def query_startgg(query: str, variables: dict[str, Any], token: str | None) -> dict[str, Any]:
    payload = {
        "operationName": "UserBySlug",
        "variables": variables,
        "query": query,
    }
    request_code = 0
    response = None
    retries = 0

    try:
        while request_code != 200 and retries < 5:
            response = requests.post(
                STARTGG_GQL_URL,
                headers=startgg_headers(token),
                json=payload,
                timeout=20,
            )
            request_code = response.status_code
            retries += 1

        if response is None:
            return {"errors": [{"message": "No response from start.gg"}]}

        try:
            data = response.json()
        except ValueError:
            data = {"errors": [{"message": f"Non-JSON response with HTTP {response.status_code}"}]}

        if request_code != 200:
            data.setdefault("errors", []).append({"message": f"HTTP {request_code} after {retries} attempts"})

        if "errors" in data:
            for error in data["errors"]:
                logger.error(f"Error: {error.get('message')}")
                if "extensions" in error:
                    logger.error(f"Extensions: {error['extensions']}")

        return data
    except Exception:
        logger.error(traceback.format_exc())
        return {"errors": [{"message": "Request exception; see log output"}]}


def user_slug_from_account(account: Any) -> tuple[str | None, str | None]:
    if not isinstance(account, str) or not account.strip():
        return None, "missing startggAccount"

    account = account.strip()
    match = re.match(r"^(?:https?://)?(?:www\.)?start\.gg/(user/[^/?#]+)", account, re.IGNORECASE)
    if match:
        return match.group(1), None

    if re.match(r"^user/[^/?#]+$", account, re.IGNORECASE):
        return account, None

    return None, f"invalid startggAccount: {account}"


def normalize_startgg_user(user: dict[str, Any], fallback_slug: str) -> dict[str, Any]:
    player = user.get("player") or {}
    return {
        "userId": str(user["id"]) if user.get("id") is not None else None,
        "userSlug": user.get("slug") or fallback_slug,
        "discriminator": user.get("discriminator"),
        "name": user.get("name"),
        "genderPronoun": user.get("genderPronoun"),
        "bio": user.get("bio"),
        "location": user.get("location"),
        "images": user.get("images") or [],
        "authorizations": user.get("authorizations") or [],
        "playerId": str(player["id"]) if player.get("id") is not None else None,
        "gamerTag": player.get("gamerTag"),
        "prefix": player.get("prefix"),
    }


def player_label(player: dict[str, Any], index: int) -> str:
    tag = player.get("tag") or f"player #{index + 1}"
    placement = player.get("placement")
    if placement is not None:
        return f"{tag} (placement {placement})"
    return str(tag)


def normalize_tag(value: Any) -> str:
    return re.sub(r"\s+", " ", str(value or "").strip().lower())


def load_local_players(path: Path) -> dict[str, dict[str, Any]]:
    if not path.exists():
        logger.warning(f"Local player DB not found: {path}")
        return {}

    players: dict[str, dict[str, Any]] = {}
    with path.open("r", encoding="utf-8", newline="") as csvfile:
        reader = csv.DictReader(csvfile, quotechar="'")
        for row in reader:
            gamer_tag = normalize_tag(row.get("gamerTag"))
            if not gamer_tag:
                continue

            try:
                row["mains"] = json.loads(row.get("mains") or "{}")
            except Exception:
                row["mains"] = {}
                logger.error(f"No mains found for: {row.get('gamerTag')}")

            players[gamer_tag] = row

    return players


def local_player_for_entry(player: dict[str, Any], local_players: dict[str, dict[str, Any]]) -> dict[str, Any] | None:
    candidates = [
        player.get("tag"),
        player.get("startgg", {}).get("gamerTag"),
    ]

    for candidate in candidates:
        match = local_players.get(normalize_tag(candidate))
        if match:
            return match

    return None


def merge_local_mains(players: list[Any], local_players_path: Path) -> tuple[int, list[str]]:
    local_players = load_local_players(local_players_path)
    updated = 0
    missing: list[str] = []

    for index, player in enumerate(players):
        if not isinstance(player, dict):
            continue

        local_player = local_player_for_entry(player, local_players)
        if not local_player:
            missing.append(f"{player_label(player, index)}: no local_players.csv match")
            continue

        mains = local_player.get("mains") or {}
        if mains:
            player["mains"] = mains
            updated += 1
        elif "mains" in player:
            player.pop("mains")
            updated += 1

    return updated, missing


def enrich_players(path: Path, query_path: Path, dry_run: bool, skip_api: bool) -> int:
    data = load_json(path)
    players = data.get("players")
    if not isinstance(players, list):
        print(f"No players array found in {path}")
        return 1

    query = read_query_file(query_path) if not skip_api else ""
    token = startgg_token()

    processed = len(players)
    enriched = 0
    removed_pfp = 0
    skipped: list[str] = []
    failed: list[str] = []

    for index, player in enumerate(players):
        if not isinstance(player, dict):
            skipped.append(f"entry #{index + 1}: not an object")
            continue

        if "pfp" in player:
            player.pop("pfp")
            removed_pfp += 1

        label = player_label(player, index)
        slug, slug_error = user_slug_from_account(player.get("startggAccount"))
        if slug_error:
            skipped.append(f"{label}: {slug_error}")
            continue

        if skip_api:
            continue

        response = query_startgg(query, {"slug": slug}, token)
        user = response.get("data", {}).get("user")
        if not user:
            errors = response.get("errors") or []
            reason = errors[0].get("message") if errors else "no user returned"
            failed.append(f"{label}: {reason}")
            continue

        player["startgg"] = normalize_startgg_user(user, slug)
        enriched += 1

    mains_updated, local_missing = merge_local_mains(players, LOCAL_PLAYERS_PATH)

    if not dry_run:
        write_json(path, data)

    print(f"Run mode: {'dry-run' if dry_run else 'write'}")
    print(f"Start.gg API: {'skipped' if skip_api else 'enabled'}")
    print(f"Players processed: {processed}")
    print(f"Players enriched: {enriched}")
    print(f"Players with local mains updated: {mains_updated}")
    print(f"Top-level pfp fields removed: {removed_pfp}")
    print(f"Players skipped: {len(skipped)}")
    print(f"Players failed: {len(failed)}")
    print(f"Players missing local mains source: {len(local_missing)}")

    if skipped:
        print("\nSkipped:")
        for item in skipped:
            print(f"- {item}")

    if failed:
        print("\nFailed:")
        for item in failed:
            print(f"- {item}")

    if local_missing:
        print("\nNo local player match:")
        for item in local_missing:
            print(f"- {item}")

    if dry_run:
        print("\nDry run only; no files were written.")

    return 0 if not failed else 2


def parse_args() -> argparse.Namespace:
    parser = argparse.ArgumentParser(
        description=(
            "Enrich layout/pr_presentation/player_placements_startgg.json with public start.gg user metadata. "
            "Run from the repo root with: python layout/pr_presentation/scripts/enrich_startgg_players.py"
        )
    )
    parser.add_argument("--dry-run", action="store_true", help="Query and summarize without writing JSON.")
    parser.add_argument("--skip-api", action="store_true", help="Only update local DB fields such as mains; do not query start.gg.")
    parser.add_argument(
        "--file",
        type=Path,
        default=PLAYER_DATA_PATH,
        help=f"Player JSON file to update. Defaults to {PLAYER_DATA_PATH}",
    )
    return parser.parse_args()


def main() -> int:
    args = parse_args()
    return enrich_players(args.file.resolve(), QUERY_PATH, args.dry_run, args.skip_api)


if __name__ == "__main__":
    sys.exit(main())
