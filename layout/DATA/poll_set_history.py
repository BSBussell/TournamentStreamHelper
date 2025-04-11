#!/usr/bin/env python3
import requests
import json
import re
import sys
import time
import os

# Start.gg GraphQL endpoint
API_URL = "https://api.start.gg/gql/alpha"

# Insert your API key here or set the environment variable STARTGG_API_KEY.
API_KEY = "e62c84314c4bcda4dfc1cf6c6ef69c69"

# GraphQL query that fetches sets for an event using pagination.
GRAPHQL_QUERY = """
query getSets($event: String!, $pageNum: Int!, $perPage: Int!) {
  event(slug: $event) {
    sets(page: $pageNum, perPage: $perPage) {
      pageInfo {
        page
        perPage
        totalPages
      }
      nodes {
        id
        slots {
          entrant {
            name
          }
          standing {
            stats {
              score {
                value
              }
            }
          }
        }
        winnerId
      }
    }
  }
}
"""

def extract_event_slug(url):
    """
    Extracts the event slug from a start.gg event URL.
    Expected URL format:
      https://start.gg/tournament/<tournament_slug>/event/<event_slug>
    Returns a slug in the format:
      "tournament/<tournament_slug>/event/<event_slug>"
    """
    match = re.search(r"tournament/([^/]+)/event/([^/]+)", url)
    if match:
        tournament_slug = match.group(1)
        event_slug = match.group(2)
        return f"tournament/{tournament_slug}/event/{event_slug}"
    else:
        print("Error: URL does not match the expected start.gg event format.")
        sys.exit(1)

def fetch_sets(event_slug, per_page=20):
    """
    Fetches all sets for the given event using pagination.
    Returns a list of dictionaries with the format:
      { "P1": <entrant name 1>, "P2": <entrant name 2>, "Score": [score1, score2] }
    """
    sets_list = []
    page = 1
    total_pages = 1  # initialize to enter the loop
    headers = {
        "Content-Type": "application/json",
        "Authorization": f"Bearer {API_KEY}"
    }
    
    while page <= total_pages:
        variables = {"event": event_slug, "pageNum": page, "perPage": per_page}
        payload = {
            "query": GRAPHQL_QUERY,
            "variables": variables
        }
        try:
            response = requests.post(API_URL, json=payload, headers=headers)
            response.raise_for_status()
        except requests.RequestException as e:
            print("Error fetching data:", e)
            break

        data = response.json()
        if "errors" in data:
            print("GraphQL error(s):", data["errors"])
            break

        sets_data = data.get("data", {}).get("event", {}).get("sets", {})
        page_info = sets_data.get("pageInfo", {})
        total_pages = page_info.get("totalPages", 1)
        nodes = sets_data.get("nodes", [])

        for node in nodes:
            slots = node.get("slots", [])
            if len(slots) >= 2:
                p1 = slots[0].get("entrant", {}).get("name", "unknown")
                p2 = slots[1].get("entrant", {}).get("name", "unknown")

                # Remove everything including and before the last '|' in the name
                p1 = p1.split("|")[-1].strip()
                p2 = p2.split("|")[-1].strip()

                # Attempt to extract the score from the nested standing field
                score1 = 0
                score2 = 0
                s1 = slots[0].get("standing")
                if s1 and s1.get("stats", {}).get("score", {}) is not None:
                    score1 = s1["stats"]["score"].get("value", 0)
                s2 = slots[1].get("standing")
                if s2 and s2.get("stats", {}).get("score", {}) is not None:
                    score2 = s2["stats"]["score"].get("value", 0)

                # If either score is none or -1, skip the set
                if score1 is None or score2 is None or score1 == -1 or score2 == -1:
                    continue
                sets_list.append({
                    "P1": p1,
                    "P2": p2,
                    "Score": [score1, score2]
                })
        print(f"Fetched page {page} of {total_pages} containing {len(nodes)} sets.")
        page += 1
        # Pause to respect rate limits
        time.sleep(1)

    return sets_list

def write_sets_to_file(sets_list, file_path):
    """
    Writes the sets list to a JSON file with the structure:
      { "Sets": [ <set1>, <set2>, ... ] }
    """
    try:
        with open(file_path, "w") as f:
            json.dump({"Sets": sets_list}, f, indent=4)
        print(f"Successfully wrote {len(sets_list)} sets to {file_path}")
    except Exception as e:
        print("Error writing to file:", e)

def main():
    if len(sys.argv) < 2:
        print("Usage: python script.py <start.gg event URL> [output file path]")
        sys.exit(1)
    
    event_url = sys.argv[1]
    file_path = sys.argv[2] if len(sys.argv) >= 3 else "set_history.json"
    
    event_slug = extract_event_slug(event_url)
    print(f"Extracted event slug: {event_slug}")
    
    sets_list = fetch_sets(event_slug, per_page=20)
    write_sets_to_file(sets_list, file_path)

if __name__ == "__main__":
    main()