#!/usr/bin/env python3
# -*- coding: utf-8 -*-
"""
Twitch Prediction Manager CLI
A reliable and maintainable command-line interface for managing Twitch predictions
"""

import os
import sys
import time
import logging
import argparse
from typing import Dict, Optional

from prediction_manager import PredictionManager

# Configure logging
logging.basicConfig(
    level=logging.INFO,
    format='%(asctime)s - %(name)s - %(levelname)s - %(message)s',
    handlers=[
        logging.FileHandler('prediction_manager_cli.log'),
        logging.StreamHandler()
    ]
)

logger = logging.getLogger(__name__)


class PredictionManagerCLI:
    """Command-line interface for the Prediction Manager."""
    
    def __init__(self):
        """Initialize the CLI."""
        self.manager = PredictionManager()
        self.exit_requested = False
    
    def run(self):
        """Run the CLI application."""
        # Verify configuration
        if not self.manager.config.is_valid():
            print("\n⚠️  Please configure your Twitch credentials in config.ini and try again.")
            return 1
        
        # Start the prediction poller
        self.manager.start_poller()
        
        try:
            while not self.exit_requested:
                choice = self.display_menu()
                self.handle_choice(choice)
                
                # Small pause before showing the menu again
                time.sleep(0.5)
        except KeyboardInterrupt:
            print("\nScript interrupted by user.")
        finally:
            # Cleanup
            self.manager.stop_poller()
            print("Goodbye!")
        
        return 0
    
    def display_menu(self):
        """Display the main menu and get user choice."""
        os.system('cls' if os.name == 'nt' else 'clear')
        self.display_current_status()
        
        print("\n" + "=" * 50)
        print("            TWITCH PREDICTION MANAGER")
        print("=" * 50 + "\n")
        print("1) Post prediction using tournament data")
        print("2) Count score and conclude match")
        print("3) Check current prediction status")
        print("4) Verify configuration")
        print("5) Exit")
        
        return input("\nSelect an option: ")
    
    def display_current_status(self):
        """Display current prediction and tournament status."""
        # Display tournament info
        player_tags = self.manager.get_player_tags()
        round_name = self.manager.get_round_name()
        scores = self.manager.get_scores()
        
        print("\n--- Tournament Information ---")
        print(f"Round: {round_name or '—'}")
        print(f"Players: {' vs '.join(player_tags) if player_tags else '—'}")
        print(f"Score: {f'{scores[0]} – {scores[1]}' if scores else '—'}")
        
        # Display prediction info
        pred = self.manager.fetch_current_prediction()
        if not pred:
            print("\n--- No Active Prediction ---")
            return
        
        print(f"\n--- Active Prediction: {pred.get('status', 'UNKNOWN')} ---")
        print(f"Title: {pred.get('title', '—')}")
        
        outcomes = pred.get('outcomes', [])
        if len(outcomes) >= 2:
            o1, o2 = outcomes[0], outcomes[1]
            total = o1["channel_points"] + o2["channel_points"]
            
            if total == 0:
                p1, p2 = 50, 50
            else:
                p1 = round(100 * o1["channel_points"] / total)
                p2 = 100 - p1
            
            print(f"{o1['title']}: {p1}% ({o1['channel_points']} points, {o1['users']} users)")
            print(f"{o2['title']}: {p2}% ({o2['channel_points']} points, {o2['users']} users)")
    
    def handle_choice(self, choice):
        """Handle menu choice."""
        if choice == "1":
            self.start_prediction()
        elif choice == "2":
            self.conclude_match()
        elif choice == "3":
            self.check_prediction_status()
        elif choice == "4":
            self.verify_configuration()
        elif choice == "5":
            self.exit_requested = True
        else:
            print("\n⚠️  Invalid choice. Please try again.")
            input("Press Enter to continue...")
    
    def start_prediction(self):
        """Start a new prediction."""
        tags = self.manager.get_player_tags()
        round_name = self.manager.get_round_name()
        
        if not tags or not round_name:
            print("\n⚠️  Missing player tags or round name.")
            input("Press Enter to continue...")
            return
        
        title = f"Who will win {round_name}?"
        print(f"\nCreating prediction: '{title}'")
        print(f"Options: {tags[0]} vs {tags[1]}")
        
        confirm = input("\nConfirm? (y/n): ").lower()
        if confirm != 'y':
            print("Cancelled.")
            input("Press Enter to continue...")
            return
        
        success = self.manager.post_prediction(title, tags)
        
        if success:
            print("\n✅ Prediction started successfully!")
        else:
            print("\n❌ Failed to start prediction.")
        
        input("Press Enter to continue...")
    
    def conclude_match(self):
        """Conclude the current match based on scores."""
        print("\nConcluding match...")
        
        success = self.manager.conclude_match()
        
        if success:
            print("\n✅ Match concluded successfully!")
        else:
            print("\n❌ Failed to conclude match.")
            print("Reasons could include:")
            print("  - No active prediction")
            print("  - Scores are tied")
            print("  - Winner name doesn't match prediction options")
        
        input("Press Enter to continue...")
    
    def check_prediction_status(self):
        """Check and display detailed prediction status."""
        pred = self.manager.fetch_current_prediction()
        
        if not pred:
            print("\nNo active prediction found.")
            input("Press Enter to continue...")
            return
        
        print(f"\nPrediction ID: {pred.get('id', '—')}")
        print(f"Title: {pred.get('title', '—')}")
        print(f"Status: {pred.get('status', '—')}")
        print(f"Created: {pred.get('created_at', '—')}")
        print(f"Duration: {pred.get('prediction_window', '—')} seconds")
        
        outcomes = pred.get('outcomes', [])
        print(f"\n{len(outcomes)} Outcome(s):")
        
        for i, outcome in enumerate(outcomes, 1):
            print(f"\nOutcome {i}:")
            print(f"  Title: {outcome.get('title', '—')}")
            print(f"  Points: {outcome.get('channel_points', 0)}")
            print(f"  Users: {outcome.get('users', 0)}")
            
            top_predictors = outcome.get('top_predictors', [])
            if top_predictors:
                print(f"  Top Predictors:")
                for predictor in top_predictors[:3]:  # Show top 3
                    print(f"    {predictor.get('user_name', '—')}: {predictor.get('channel_points_won', 0)} points")
        
        input("\nPress Enter to continue...")
    
    def verify_configuration(self):
        """Verify and display configuration settings."""
        print("\n--- Configuration Verification ---")
        
        # Twitch API config
        print("\nTwitch API Configuration:")
        has_token = bool(self.manager.config.get('Twitch', 'access_token'))
        has_client_id = bool(self.manager.config.get('Twitch', 'client_id'))
        has_broadcaster_id = bool(self.manager.config.get('Twitch', 'broadcaster_id'))
        
        print(f"  Access Token: {'✅ Set' if has_token else '❌ Missing'}")
        print(f"  Client ID: {'✅ Set' if has_client_id else '❌ Missing'}")
        print(f"  Broadcaster ID: {'✅ Set' if has_broadcaster_id else '❌ Missing'}")
        
        # TSH config
        print("\nTSH Configuration:")
        tsh_out = self.manager.config.get('TSH', 'tsh_out')
        prediction_time = self.manager.config.getint('TSH', 'prediction_time')
        print(f"  TSH Output Directory: {tsh_out}")
        print(f"  Prediction Time: {prediction_time} seconds")
        
        # File paths
        print("\nFile Paths:")
        p1_path = self.manager.data.get_file_path('score/1/team/1/player/1/name.txt')
        p2_path = self.manager.data.get_file_path('score/1/team/2/player/1/name.txt')
        round_path = self.manager.data.get_file_path('score/1/match.txt')
        
        print(f"  Player 1 Name: {str(p1_path)}")
        print(f"    Exists: {'✅ Yes' if p1_path.exists() else '❌ No'}")
        
        print(f"  Player 2 Name: {str(p2_path)}")
        print(f"    Exists: {'✅ Yes' if p2_path.exists() else '❌ No'}")
        
        print(f"  Round Name: {str(round_path)}")
        print(f"    Exists: {'✅ Yes' if round_path.exists() else '❌ No'}")
        
        input("\nPress Enter to continue...")


def main():
    """Main application entry point."""
    parser = argparse.ArgumentParser(description='Twitch Prediction Manager CLI')
    parser.add_argument('--config', help='Path to custom config file')
    args = parser.parse_args()
    
    # Configure manager with custom config if provided
    cli = PredictionManagerCLI()
    
    return cli.run()


if __name__ == "__main__":
    sys.exit(main())