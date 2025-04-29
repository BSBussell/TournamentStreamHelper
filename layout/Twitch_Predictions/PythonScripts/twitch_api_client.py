#!/usr/bin/env python3
# -*- coding: utf-8 -*-
"""
Twitch API Client for Twitch Prediction Tool
Handles all API communication with Twitch
"""

import time
import logging
import requests
from typing import Dict, List, Tuple, Optional, Callable, Union, Any

logger = logging.getLogger(__name__)


class TwitchAPIError(Exception):
    """Exception raised for Twitch API errors."""
    def __init__(self, message, status_code=None, response_text=None):
        self.status_code = status_code
        self.response_text = response_text
        super().__init__(message)


class TwitchAPIClient:
    """Client for interacting with the Twitch API."""
    
    def __init__(self, config_manager):
        """Initialize the Twitch API client.
        
        Args:
            config_manager: ConfigManager instance that provides API credentials
        """
        self.config = config_manager
        self.session = requests.Session()
        self._validate_credentials()
    
    def _validate_credentials(self):
        """Validate API credentials and retrieve broadcaster ID if needed."""
        if not self.config.get('Twitch', 'access_token') or not self.config.get('Twitch', 'client_id'):
            raise TwitchAPIError("Missing Twitch API credentials in configuration")
        
        if not self.config.get_broadcaster_id():
            self.get_user_id()
    
    def retry_request(self, request_func: Callable, retries: int = 3, delay: int = 1) -> Optional[requests.Response]:
        """Execute an API request with retries on failure.
        
        Args:
            request_func: Function that makes the request
            retries: Number of retry attempts
            delay: Delay between retries in seconds
            
        Returns:
            Response object if successful, None otherwise
        """
        last_error = None
        
        for attempt in range(retries):
            try:
                response = request_func()
                
                if response.ok:
                    return response
                
                # Handle rate limiting
                if response.status_code == 429:
                    retry_after = int(response.headers.get('Retry-After', delay * 2))
                    logger.warning(f"Rate limited. Waiting {retry_after}s before retry.")
                    time.sleep(retry_after)
                elif response.status_code == 401:
                    raise TwitchAPIError("Authentication failed. Token may be expired.", 
                                         status_code=response.status_code, 
                                         response_text=response.text)
                else:
                    logger.error(f"API request failed: {response.status_code} - {response.text}")
                    
            except requests.RequestException as e:
                logger.warning(f"Request error on attempt {attempt + 1}: {str(e)}")
                last_error = e
            
            # Add exponential backoff for retries
            wait_time = delay * (2 ** attempt)
            logger.debug(f"Retry {attempt + 1}/{retries} after {wait_time}s")
            time.sleep(wait_time)
        
        if last_error:
            raise TwitchAPIError(f"Request failed after {retries} retries") from last_error
        return None
    
    def get_user_id(self) -> str:
        """Get the user ID for the authenticated user and save it to config.
        
        Returns:
            The user ID string
        """
        headers = self.config.get_api_headers()
        
        try:
            response = self.retry_request(lambda: self.session.get("https://api.twitch.tv/helix/users", headers=headers))
            
            if not response:
                raise TwitchAPIError("Failed to retrieve user ID")
            
            data = response.json().get("data", [])
            if not data:
                raise TwitchAPIError("No user data found in API response")
            
            user_id = data[0]["id"]
            logger.info(f"Got user ID: {user_id}")
            
            # Save to config
            self.config.set_broadcaster_id(user_id)
            
            return user_id
            
        except Exception as e:
            logger.error(f"Error getting user ID: {str(e)}")
            raise TwitchAPIError(f"Failed to get user ID: {str(e)}") from e
    
    def fetch_current_prediction(self) -> Optional[Dict]:
        """Fetch the current active prediction.
        
        Returns:
            Prediction data as dict, or None if no active prediction
        """
        broadcaster_id = self.config.get_broadcaster_id()
        headers = self.config.get_api_headers()
        params = {"broadcaster_id": broadcaster_id}
        
        try:
            response = self.retry_request(
                lambda: self.session.get("https://api.twitch.tv/helix/predictions", 
                                         headers=headers, 
                                         params=params)
            )
            
            if not response:
                return None
                
            data = response.json().get("data", [])
            return data[0] if data else None
            
        except TwitchAPIError as e:
            logger.error(f"Failed to fetch predictions: {str(e)}")
            return None
        except Exception as e:
            logger.error(f"Unexpected error fetching predictions: {str(e)}")
            return None
    
    def post_prediction(self, title: str, outcomes: List[str], window: int = None) -> bool:
        """Create a new prediction.
        
        Args:
            title: Title for the prediction
            outcomes: List of outcome titles
            window: Prediction window in seconds (uses config default if None)
            
        Returns:
            True if successful, False otherwise
        """
        broadcaster_id = self.config.get_broadcaster_id()
        headers = self.config.get_api_headers()
        headers["Content-Type"] = "application/json"
        
        if window is None:
            window = self.config.getint('TSH', 'prediction_time', fallback=600)
        
        payload = {
            "broadcaster_id": broadcaster_id,
            "title": title,
            "outcomes": [{"title": o} for o in outcomes],
            "prediction_window": window,
        }
        
        try:
            response = self.session.post("https://api.twitch.tv/helix/predictions", 
                                        headers=headers, 
                                        json=payload)
            
            if not response.ok:
                logger.error(f"Failed to create prediction: {response.status_code} - {response.text}")
                return False
                
            logger.info(f"Prediction created: '{title}' with options: {', '.join(outcomes)}")
            return True
            
        except Exception as e:
            logger.error(f"Error creating prediction: {str(e)}")
            return False
    
    def resolve_prediction(self, pred_id: str, winner_id: str) -> bool:
        """Resolve a prediction with a winner.
        
        Args:
            pred_id: Prediction ID
            winner_id: Winning outcome ID
            
        Returns:
            True if successful, False otherwise
        """
        broadcaster_id = self.config.get_broadcaster_id()
        headers = self.config.get_api_headers()
        headers["Content-Type"] = "application/json"
        
        payload = {
            "broadcaster_id": broadcaster_id,
            "id": pred_id,
            "status": "RESOLVED",
            "winning_outcome_id": winner_id,
        }
        
        try:
            response = self.session.patch("https://api.twitch.tv/helix/predictions", 
                                         headers=headers, 
                                         json=payload)
            
            if not response.ok:
                logger.error(f"Failed to resolve prediction: {response.status_code} - {response.text}")
                return False
                
            logger.info(f"Prediction {pred_id} resolved with winner {winner_id}")
            return True
            
        except Exception as e:
            logger.error(f"Error resolving prediction: {str(e)}")
            return False
    
    def cancel_prediction(self, pred_id: str) -> bool:
        """Cancel an active prediction.
        
        Args:
            pred_id: Prediction ID
            
        Returns:
            True if successful, False otherwise
        """
        broadcaster_id = self.config.get_broadcaster_id()
        headers = self.config.get_api_headers()
        headers["Content-Type"] = "application/json"
        
        payload = {
            "broadcaster_id": broadcaster_id,
            "id": pred_id,
            "status": "CANCELED",
        }
        
        try:
            response = self.session.patch("https://api.twitch.tv/helix/predictions", 
                                         headers=headers, 
                                         json=payload)
            
            if not response.ok:
                logger.error(f"Failed to cancel prediction: {response.status_code} - {response.text}")
                return False
                
            logger.info(f"Prediction {pred_id} canceled")
            return True
            
        except Exception as e:
            logger.error(f"Error canceling prediction: {str(e)}")
            return False
    
    def get_active_prediction_and_outcomes(self) -> Tuple[Optional[str], Dict[str, str]]:
        """Get the active prediction ID and outcome IDs.
        
        Returns:
            (prediction_id, {outcome_title: outcome_id}) tuple
        """
        prediction = self.fetch_current_prediction()
        
        if not prediction:
            return None, {}
            
        pred_id = prediction["id"]
        outcomes = {o["title"]: o["id"] for o in prediction["outcomes"]}
        
        return pred_id, outcomes