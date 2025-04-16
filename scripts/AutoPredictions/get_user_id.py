import requests
import configparser


configparser = configparser.ConfigParser()
configparser.read("config.ini")

ACCESS_TOKEN = configparser.get('Twitch', 'ACCESS_TOKEN')
CLIENT_ID = configparser.get('Twitch', 'CLIENT_ID')

headers = {
    "Authorization": f"Bearer {ACCESS_TOKEN}",
    "Client-Id": CLIENT_ID,
}

response = requests.get("https://api.twitch.tv/helix/users", headers=headers)


# Get the user id
if response.ok:
    data = response.json().get("data", [])
    if data:
        user_id = data[0]["id"]
        print(f"User ID: {user_id}")

        # Write user id to config
        configparser.set('Twitch', 'BROADCASTER_ID', user_id)

        with open("config.ini", "w") as configfile:
            configparser.write(configfile)
        
        print("✅ User ID saved to config.ini")

    else:
        print("❌ No user data found.")