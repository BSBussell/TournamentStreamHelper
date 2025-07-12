# Twitch Prediction Manager

A reliable application for managing Twitch predictions for streamers, with both GUI and CLI interfaces.

## Features

- Automatically creates and resolves Twitch predictions based on tournament data
- Continuously updates prediction information to a JSON file for overlays  
- Resilient error handling and auto-recovery
- Watchdog thread to ensure continuous operation
- Dark mode GUI interface
- Clean separation of concerns with MVC architecture

## Installation

### Prerequisites

- Python 3.8 or higher
- Twitch developer account with API credentials

### Setup

1. Clone the repository:

```bash
git clone https://github.com/yourusername/twitch-prediction-manager.git
cd twitch-prediction-manager
```

2. Install dependencies:

```bash
pip install -r requirements.txt
```

3. Run the application (GUI or CLI):

```bash
# GUI version
python main_gui.py

# CLI version
python main_cli.py
```

4. On first run, the application will create a `config.ini` file. Edit this file to add your Twitch API credentials:

```ini
[Twitch]
access_token = your_access_token
client_id = your_client_id
broadcaster_id = 

[TSH]
tsh_out = ../../../out/
prediction_time = 600

[App]
log_level = INFO
refresh_interval = 2
auto_reconnect = True
watchdog_interval = 30
```

## Directory Structure

The application consists of these main components:

- `config_manager.py`: Manages configuration settings
- `twitch_api_client.py`: Handles communication with Twitch API
- `data_manager.py`: Handles file operations and data access
- `prediction_manager.py`: Core business logic
- `main_gui.py`: PyQt5 graphical user interface
- `main_cli.py`: Command-line interface

## How It Works

1. The application reads tournament data (player names, round names, scores) from files in the TSH output directory
2. It uses this data to create Twitch predictions through the Twitch API
3. Predictions are continuously polled and their status is written to a JSON file
4. When a match concludes, the prediction can be automatically resolved based on scores

## Troubleshooting

### Common Issues

1. **API Authentication Errors**
   - Verify your Twitch API credentials in `config.ini`
   - Check if your access token has expired

2. **Tournament Data Not Found**
   - Verify the `tsh_out` path in `config.ini`
   - Check if the required files exist and are readable

3. **Application Crashes**
   - Check the log file at `prediction_manager.log`
   - The application should automatically recover from most errors

### Logs

By default, logs are written to:
- `prediction_manager.log` (GUI version)
- `prediction_manager_cli.log` (CLI version)

## License

This project is licensed under the MIT License - see the LICENSE file for details.