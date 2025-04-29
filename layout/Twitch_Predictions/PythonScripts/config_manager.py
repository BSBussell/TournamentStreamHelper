#!/usr/bin/env python3
# -*- coding: utf-8 -*-
"""
Configuration Manager for Twitch Prediction Tool
Handles configuration loading, validation, and updates
"""

import os
import logging
from configparser import ConfigParser
from pathlib import Path

logger = logging.getLogger(__name__)


class ConfigManager:
    """Manages configuration settings for the application."""
    
    DEFAULT_CONFIG = {
        'Twitch': {
            'access_token': '',
            'client_id': '',
            'broadcaster_id': ''
        },
        'TSH': {
            'tsh_out': '../../../out/',
            'prediction_time': '600'
        },
        'App': {
            'log_level': 'INFO',
            'refresh_interval': '2',
            'auto_reconnect': 'True',
            'watchdog_interval': '30'
        }
    }
    
    def __init__(self, config_path=None):
        """Initialize the configuration manager.
        
        Args:
            config_path: Path to the configuration file. If None, uses default path.
        """
        if config_path is None:
            script_dir = Path(__file__).parent.absolute()
            self.config_path = script_dir / "config.ini"
        else:
            self.config_path = Path(config_path)
            
        self.config = ConfigParser()
        self.load_config()
    
    def load_config(self):
        """Load configuration from file, creating it with defaults if not found."""
        if not self.config_path.exists():
            self._create_default_config()
            logger.warning(f"Created default config at {self.config_path}")
            return False
        
        self.config.read(self.config_path)
        self._ensure_sections()
        return True
    
    def _create_default_config(self):
        """Create a default configuration file."""
        for section, values in self.DEFAULT_CONFIG.items():
            self.config[section] = values
        
        with open(self.config_path, 'w') as configfile:
            self.config.write(configfile)
    
    def _ensure_sections(self):
        """Ensure all required sections and options exist."""
        updated = False
        
        for section, values in self.DEFAULT_CONFIG.items():
            if section not in self.config:
                self.config[section] = values
                updated = True
            else:
                for key, default in values.items():
                    if key not in self.config[section]:
                        self.config[section][key] = default
                        updated = True
        
        if updated:
            self.save_config()
    
    def save_config(self):
        """Save the current configuration to file."""
        with open(self.config_path, 'w') as configfile:
            self.config.write(configfile)
        logger.debug(f"Configuration saved to {self.config_path}")
    
    def get(self, section, option, fallback=None):
        """Get a configuration value."""
        return self.config.get(section, option, fallback=fallback)
    
    def getint(self, section, option, fallback=None):
        """Get a configuration value as integer."""
        return self.config.getint(section, option, fallback=fallback)
    
    def getfloat(self, section, option, fallback=None):
        """Get a configuration value as float."""
        return self.config.getfloat(section, option, fallback=fallback)
    
    def getboolean(self, section, option, fallback=None):
        """Get a configuration value as boolean."""
        return self.config.getboolean(section, option, fallback=fallback)
    
    def set(self, section, option, value):
        """Set a configuration value."""
        if section not in self.config:
            self.config[section] = {}
        self.config[section][option] = str(value)
    
    def is_valid(self):
        """Check if the configuration has all required values set."""
        if not self.get('Twitch', 'access_token'):
            logger.error("Missing Twitch access_token")
            return False
        
        if not self.get('Twitch', 'client_id'):
            logger.error("Missing Twitch client_id")
            return False
        
        return True
    
    def get_api_headers(self):
        """Get the headers needed for Twitch API calls."""
        return {
            "Authorization": f"Bearer {self.get('Twitch', 'access_token')}",
            "Client-Id": self.get('Twitch', 'client_id'),
        }
    
    def get_broadcaster_id(self):
        """Get the broadcaster ID."""
        return self.get('Twitch', 'broadcaster_id')
    
    def set_broadcaster_id(self, broadcaster_id):
        """Set and save the broadcaster ID."""
        self.set('Twitch', 'broadcaster_id', broadcaster_id)
        self.save_config()