#!/usr/bin/env python3
# -*- coding: utf-8 -*-
"""
Prediction Manager for Twitch Prediction Tool
Core business logic that coordinates API and data operations
"""

import time
import logging
import threading
from typing import Dict, List, Tuple, Optional, Callable, Any

from config_manager import ConfigManager
from twitch_api_client import TwitchAPIClient, TwitchAPIError
from data_manager import DataManager

logger = logging.getLogger(__name__)


class PredictionManager:
    """Core manager for Twitch prediction operations."""
    
    def __init__(self, config_path=None, prediction_info_path=None):
        """Initialize the prediction manager.
        
        Args:
            config_path: Path to config file (optional)
            prediction_info_path: Path to prediction info JSON file (optional)
        """
        self.config = ConfigManager(config_path)
        self.api = TwitchAPIClient(self.config)
        self.data = DataManager(self.config, prediction_info_path)
        
        self._poller_thread = None
        self._exit_flag = threading.Event()
        self._watchdog_thread = None
        self._last_successful_poll = 0
        self._callbacks = []
        
        # Ensure we have the broadcaster ID
        self.api.get_user_id()
    
    def start_poller(self, interval: float = None) -> bool:
        """Start the background poller thread.
        
        Args:
            interval: Polling interval in seconds (default: from config)
            
        Returns:
            True if started, False if already running
        """
        if self._poller_thread and self._poller_thread.is_alive():
            logger.warning("Poller thread is already running")
            return False
        
        if interval is None:
            interval = self.config.getfloat('App', 'refresh_interval', fallback=2.0)
        
        self._exit_flag.clear()
        self._poller_thread = threading.Thread(target=self._poll_loop, 
                                              args=(interval,),
                                              daemon=True)
        self._poller_thread.start()
        
        # Start the watchdog if enabled
        if self.config.getboolean('App', 'auto_reconnect', fallback=True):
            self._start_watchdog()
            
        logger.info(f"Poller thread started with {interval}s interval")
        return True
    
    def stop_poller(self):
        """Stop the background poller thread."""
        self._exit_flag.set()
        
        if self._watchdog_thread and self._watchdog_thread.is_alive():
            self._watchdog_thread.join(timeout=2)
            self._watchdog_thread = None
            
        if self._poller_thread and self._poller_thread.is_alive():
            self._poller_thread.join(timeout=5)
            self._poller_thread = None
            
        logger.info("Poller thread stopped")
    
    def _poll_loop(self, interval: float):
        """Background thread function for polling predictions.
        
        Args:
            interval: Polling interval in seconds
        """
        chunk_time = interval / 10  # For responsive exits
        
        while not self._exit_flag.is_set():
            try:
                prediction = self.api.fetch_current_prediction()
                
                if prediction:
                    self.data.write_prediction_to_file(prediction)
                    
                # Record successful poll time
                self._last_successful_poll = time.time()
                
                # Notify callbacks
                self._notify_callbacks(prediction)
                
            except Exception as e:
                logger.error(f"Error in poller: {str(e)}")
            
            # Sleep in chunks for responsive shutdown
            for _ in range(int(interval / chunk_time)):
                if self._exit_flag.is_set():
                    break
                time.sleep(chunk_time)
    
    def _start_watchdog(self):
        """Start the watchdog thread to monitor and recover the poller."""
        interval = self.config.getfloat('App', 'watchdog_interval', fallback=30.0)
        
        self._watchdog_thread = threading.Thread(target=self._watchdog_loop, 
                                                args=(interval,),
                                                daemon=True)
        self._watchdog_thread.start()
        logger.info(f"Watchdog started with {interval}s interval")
    
    def _watchdog_loop(self, interval: float):
        """Background thread function for watchdog.
        
        Args:
            interval: Watchdog check interval in seconds
        """
        while not self._exit_flag.is_set():
            if self._poller_thread and self._poller_thread.is_alive():
                # Check if poller is responsive
                if time.time() - self._last_successful_poll > interval * 2:
                    logger.warning("Poller thread appears unresponsive, restarting")
                    self._restart_poller()
            else:
                # Poller died, restart it
                logger.warning("Poller thread died, restarting")
                self._restart_poller()
            
            # Sleep in chunks for responsive shutdown
            for _ in range(10):
                if self._exit_flag.is_set():
                    break
                time.sleep(interval / 10)
    
    def _restart_poller(self):
        """Restart the poller thread."""
        # Force kill old thread
        self._poller_thread = None
        
        # Start a new thread
        interval = self.config.getfloat('App', 'refresh_interval', fallback=2.0)
        self._poller_thread = threading.Thread(target=self._poll_loop, 
                                              args=(interval,),
                                              daemon=True)
        self._poller_thread.start()
        logger.info("Poller thread restarted")
    
    def register_callback(self, callback: Callable[[Optional[Dict]], None]):
        """Register a callback function to be called on prediction updates.
        
        Args:
            callback: Function that takes prediction data dict as argument
        """
        self._callbacks.append(callback)
    
    def unregister_callback(self, callback):
        """Unregister a previously registered callback function."""
        if callback in self._callbacks:
            self._callbacks.remove(callback)
    
    def _notify_callbacks(self, prediction: Optional[Dict]):
        """Notify all registered callbacks with prediction data.
        
        Args:
            prediction: Prediction data dict
        """
        for callback in self._callbacks:
            try:
                callback(prediction)
            except Exception as e:
                logger.error(f"Error in callback: {str(e)}")
    
    def post_prediction(self, title: str, outcomes: List[str], window: int = None) -> bool:
        """Create a new prediction.
        
        Args:
            title: Title for the prediction
            outcomes: List of outcome titles
            window: Prediction window in seconds (uses config default if None)
            
        Returns:
            True if successful, False otherwise
        """
        return self.api.post_prediction(title, outcomes, window)
    
    def resolve_prediction(self, pred_id: str, winner_id: str) -> bool:
        """Resolve a prediction with a winner.
        
        Args:
            pred_id: Prediction ID
            winner_id: Winning outcome ID
            
        Returns:
            True if successful, False otherwise
        """
        return self.api.resolve_prediction(pred_id, winner_id)
    
    def cancel_prediction(self, pred_id: str) -> bool:
        """Cancel an active prediction.
        
        Args:
            pred_id: Prediction ID
            
        Returns:
            True if successful, False otherwise
        """
        return self.api.cancel_prediction(pred_id)
    
    def fetch_current_prediction(self) -> Optional[Dict]:
        """Fetch the current active prediction.
        
        Returns:
            Prediction data as dict, or None if no active prediction
        """
        return self.api.fetch_current_prediction()
    
    def get_active_prediction_and_outcomes(self) -> Tuple[Optional[str], Dict[str, str]]:
        """Get the active prediction ID and outcome IDs.
        
        Returns:
            (prediction_id, {outcome_title: outcome_id}) tuple
        """
        return self.api.get_active_prediction_and_outcomes()
    
    def get_player_tags(self) -> Optional[List[str]]:
        """Get player tags from TSH files.
        
        Returns:
            List of player tags, or None if not found
        """
        return self.data.get_player_tags()
    
    def get_round_name(self) -> Optional[str]:
        """Get the current round name from TSH files.
        
        Returns:
            Round name, or None if not found
        """
        return self.data.get_round_name()
    
    def get_scores(self) -> Optional[Tuple[int, int]]:
        """Get current scores from TSH files.
        
        Returns:
            (score1, score2) tuple, or None if error
        """
        return self.data.get_scores()
    
    def conclude_match(self) -> bool:
        """Automatically conclude a match by getting winner from scores.
        
        Returns:
            True if successful, False otherwise
        """
        player_tags = self.get_player_tags()
        if not player_tags or len(player_tags) != 2:
            logger.error("Could not retrieve player tags")
            return False
        
        scores = self.get_scores()
        if not scores:
            logger.error("Could not retrieve scores")
            return False
            
        p1_score, p2_score = scores
        if p1_score == p2_score:
            logger.warning("Cannot conclude match with tied scores")
            return False
            
        winner = player_tags[0] if p1_score > p2_score else player_tags[1]
        logger.info(f"Match concluded. Winner: {winner}")
        
        pred_id, outcomes = self.get_active_prediction_and_outcomes()
        if not pred_id:
            logger.error("No active prediction to resolve")
            return False
            
        winner_id = outcomes.get(winner)
        if not winner_id:
            logger.error(f"Winner '{winner}' not found in prediction outcomes")
            return False
            
        return self.resolve_prediction(pred_id, winner_id)