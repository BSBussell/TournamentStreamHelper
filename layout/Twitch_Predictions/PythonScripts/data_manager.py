#!/usr/bin/env python3
# -*- coding: utf-8 -*-
"""
Data Manager for Twitch Prediction Tool
Handles all file operations and local data management
"""

import os
import json
import logging
from pathlib import Path
from typing import Dict, List, Tuple, Optional, Union

logger = logging.getLogger(__name__)


class DataManager:
    """Manages data files and operations."""
    
    def __init__(self, config_manager, prediction_info_path=None):
        """Initialize the data manager.
        
        Args:
            config_manager: ConfigManager instance
            prediction_info_path: Path to prediction info JSON file
        """
        self.config = config_manager
        
        if prediction_info_path is None:
            script_dir = Path(__file__).parent.absolute()
            self.prediction_info_path = script_dir / "prediction_info.json"
        else:
            self.prediction_info_path = Path(prediction_info_path)
    
    def get_file_path(self, relative_path: str) -> Path:
        """Convert a relative path from config to an absolute path.
        
        Args:
            relative_path: Relative file path
            
        Returns:
            Absolute file path
        """
        base_dir = self.config.get('TSH', 'tsh_out')
        script_dir = Path(__file__).parent.absolute()
        
        if str(relative_path).startswith(base_dir):
            # Path is already relative to TSH_OUT
            full_path = script_dir / relative_path
        else:
            # Create full path
            full_path = script_dir / base_dir / relative_path.lstrip('/')
        
        return full_path.resolve()
    
    def read_file_content(self, file_path: Union[str, Path]) -> Optional[str]:
        """Read content from a file, handling errors gracefully.
        
        Args:
            file_path: Path to the file
            
        Returns:
            File content as string, or None if error
        """
        try:
            path = Path(file_path)
            if not path.exists():
                logger.warning(f"File not found: {path}")
                return None
                
            with open(path, "r") as f:
                return f.read().strip()
                
        except Exception as e:
            logger.error(f"Error reading {file_path}: {str(e)}")
            return None
    
    def get_player_tags(self) -> Optional[List[str]]:
        """Get player tags from TSH files.
        
        Returns:
            List of player tags, or None if not found
        """
        p1_file = self.get_file_path('score/1/team/1/player/1/name.txt')
        p2_file = self.get_file_path('score/1/team/2/player/1/name.txt')
        
        p1 = self.read_file_content(p1_file)
        p2 = self.read_file_content(p2_file)
        
        if not p1 or not p2:
            return None
        
        return [p1, p2]
    
    def get_round_name(self) -> Optional[str]:
        """Get the current round name from TSH files.
        
        Returns:
            Round name, or None if not found
        """
        round_file = self.get_file_path('score/1/match.txt')
        return self.read_file_content(round_file)
    
    def get_scores(self) -> Optional[Tuple[int, int]]:
        """Get current scores from TSH files.
        
        Returns:
            (score1, score2) tuple, or None if error
        """
        p1_score_file = self.get_file_path('score/1/team/1/score.txt')
        p2_score_file = self.get_file_path('score/1/team/2/score.txt')
        
        p1_score_text = self.read_file_content(p1_score_file)
        p2_score_text = self.read_file_content(p2_score_file)
        
        if not p1_score_text or not p2_score_text:
            return None
        
        try:
            p1_score = int(p1_score_text)
            p2_score = int(p2_score_text)
            return p1_score, p2_score
        except ValueError as e:
            logger.error(f"Error parsing scores: {str(e)}")
            return None
    
    def write_prediction_to_file(self, prediction: Optional[Dict]) -> bool:
        """Write prediction data to JSON file for overlays.
        
        Args:
            prediction: Prediction data dict
            
        Returns:
            True if successful, False otherwise
        """
        if not prediction:
            logger.debug("No prediction data to write")
            return False
        
        try:
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
            
            with open(self.prediction_info_path, "w", encoding="utf-8") as f:
                json.dump(output, f, indent=2)
                
            logger.debug(f"Prediction data written to {self.prediction_info_path}")
            return True
            
        except Exception as e:
            logger.error(f"Error writing prediction data: {str(e)}")
            return False