#!/usr/bin/env python3
# -*- coding: utf-8 -*-
"""
Twitch Prediction Manager GUI
A reliable and maintainable interface for managing Twitch predictions
"""

import sys
import logging
import traceback
from pathlib import Path
from typing import Dict, List, Tuple, Optional

from PyQt5.QtWidgets import (
    QApplication, QMainWindow, QWidget, QMessageBox,
    QVBoxLayout, QHBoxLayout, QFormLayout, QGroupBox,
    QLabel, QPushButton, QInputDialog, QDialog, QLineEdit, 
    QDialogButtonBox, QStatusBar, QSystemTrayIcon, QMenu, QAction
)
from PyQt5.QtCore import QTimer, Qt, pyqtSlot, QSettings
from PyQt5.QtGui import QPalette, QColor, QIcon, QFont

from prediction_manager import PredictionManager

# Configure logging
logging.basicConfig(
    level=logging.INFO,
    format='%(asctime)s - %(name)s - %(levelname)s - %(message)s',
    handlers=[
        logging.FileHandler('prediction_manager.log'),
        logging.StreamHandler()
    ]
)

logger = logging.getLogger(__name__)

# Global exception handler
def global_exception_handler(exctype, value, tb):
    """Log uncaught exceptions"""
    trace = ''.join(traceback.format_exception(exctype, value, tb))
    logger.critical(f"Uncaught exception: {trace}")
    sys.__excepthook__(exctype, value, tb)  # Call the original handler

sys.excepthook = global_exception_handler


class PredictionWindow(QMainWindow):
    """Main application window for Twitch Prediction Manager."""
    
    def __init__(self):
        super().__init__()
        
        # Initialize the prediction manager
        self.manager = PredictionManager()
        
        # UI setup
        self.setWindowTitle("Twitch Prediction Manager")
        self.resize(450, 600)
        self.setup_ui()
        
        # Load window state
        self.settings = QSettings("TwitchPredictionManager", "GUI")
        self.restoreGeometry(self.settings.value("geometry", bytearray()))
        
        # Current prediction tracking
        self.current_pred_id = None
        self.current_outcomes = {}
        
        # Connect to prediction manager events
        self.manager.register_callback(self.on_prediction_update)
        
        # Start prediction polling
        self.manager.start_poller()
        
        # Refresh UI timer
        self.ui_timer = QTimer(self)
        self.ui_timer.timeout.connect(self.refresh_display)
        self.ui_timer.start(1000)  # Update UI every second
    
    def setup_ui(self):
        """Set up the user interface."""
        central_widget = QWidget()
        self.setCentralWidget(central_widget)
        main_layout = QVBoxLayout(central_widget)
        main_layout.setContentsMargins(20, 20, 20, 20)
        main_layout.setSpacing(15)
        
        # Status box
        status_group = QGroupBox("Current Prediction Status")
        status_group.setFont(QFont(status_group.font().family(), 10, QFont.Bold))
        status_layout = QVBoxLayout(status_group)
        
        # Create status displays
        self.lbl_title = QLabel("No active prediction")
        self.lbl_title.setStyleSheet("font-size: 14px; font-weight: bold;")
        self.lbl_title.setAlignment(Qt.AlignCenter)
        status_layout.addWidget(self.lbl_title)
        
        # Prediction players
        self.setup_prediction_display(status_layout)
        main_layout.addWidget(status_group)
        
        # Player info group
        info_group = QGroupBox("Tournament Information")
        info_group.setFont(QFont(info_group.font().family(), 10, QFont.Bold))
        info_layout = QFormLayout(info_group)
        
        self.lbl_round = QLabel("—")
        self.lbl_players = QLabel("—")
        self.lbl_scores = QLabel("—")
        
        info_layout.addRow("Round:", self.lbl_round)
        info_layout.addRow("Players:", self.lbl_players)
        info_layout.addRow("Score:", self.lbl_scores)
        main_layout.addWidget(info_group)
        
        # Action buttons
        self.setup_buttons(main_layout)
        
        # Status bar
        self.status_bar = QStatusBar(self)
        self.setStatusBar(self.status_bar)
        self.status_bar.showMessage("Ready")
    
    def setup_prediction_display(self, layout):
        """Set up the prediction display UI elements."""
        self.name_layout = QHBoxLayout()
        self.name1 = QLabel("—")
        self.name1.setAlignment(Qt.AlignCenter)
        self.name1.setStyleSheet("font-size: 16px; font-weight: bold;")
        self.name2 = QLabel("—")
        self.name2.setAlignment(Qt.AlignCenter)
        self.name2.setStyleSheet("font-size: 16px; font-weight: bold;")
        self.name_layout.addWidget(self.name1)
        self.name_layout.addWidget(self.name2)
        layout.addLayout(self.name_layout)
        
        self.percent_layout = QHBoxLayout()
        self.pct1 = QLabel("—%")
        self.pct1.setAlignment(Qt.AlignCenter)
        self.pct1.setStyleSheet("font-size: 16px;")
        self.pct2 = QLabel("—%")
        self.pct2.setAlignment(Qt.AlignCenter)
        self.pct2.setStyleSheet("font-size: 16px;")
        self.percent_layout.addWidget(self.pct1)
        self.percent_layout.addWidget(self.pct2)
        layout.addLayout(self.percent_layout)
    
    def setup_buttons(self, layout):
        """Set up action buttons."""
        buttons_layout = QVBoxLayout()
        buttons_layout.setSpacing(10)
        
        btn_verify = QPushButton("Verify Tournament Data")
        btn_start = QPushButton("Create Prediction")
        btn_decide = QPushButton("Decide Winner")
        btn_delete = QPushButton("Delete Prediction")
        btn_quit = QPushButton("Quit")
        
        buttons = (btn_verify, btn_start, btn_decide, btn_delete, btn_quit)
        for btn in buttons:
            btn.setMinimumHeight(50)  # Increased height for taller buttons
            btn.setStyleSheet("")
            btn.setFont(QFont("System", 13))
            buttons_layout.addWidget(btn)
        
        # Connect signals
        btn_verify.clicked.connect(self.on_verify)
        btn_start.clicked.connect(self.on_start)
        btn_decide.clicked.connect(self.on_decide)
        btn_delete.clicked.connect(self.on_delete)
        btn_quit.clicked.connect(self.on_quit)
        
        layout.addLayout(buttons_layout)
    
    def refresh_display(self):
        """Update the UI with the latest prediction and tournament data."""
        # Update tournament info
        self.refresh_tournament_info()
        
        # Current prediction info is updated through the callback
    
    def refresh_tournament_info(self):
        """Update the tournament info display."""
        # Round name
        round_name = self.manager.get_round_name()
        if round_name:
            self.lbl_round.setText(round_name)
        else:
            self.lbl_round.setText("—")
        
        # Player tags
        player_tags = self.manager.get_player_tags()
        if player_tags and len(player_tags) >= 2:
            self.lbl_players.setText(f"{player_tags[0]} vs {player_tags[1]}")
        else:
            self.lbl_players.setText("—")
        
        # Scores
        scores = self.manager.get_scores()
        if scores and len(scores) == 2:
            self.lbl_scores.setText(f"{scores[0]} – {scores[1]}")
        else:
            self.lbl_scores.setText("—")
    
    @pyqtSlot(dict)
    def on_prediction_update(self, prediction):
        """Handle prediction updates from the manager.
        
        Args:
            prediction: Prediction data dictionary
        """
        if not prediction:
            self.clear_prediction_display()
            return
        
        status = prediction.get("status")
        title = prediction.get("title", "Unknown")
        self.lbl_title.setText(title)
        
        if status != "ACTIVE":
            self.clear_prediction_display()
            self.current_pred_id = None
            self.current_outcomes = {}
            return
        
        # Extract outcome information
        outcomes = prediction.get("outcomes", [])
        if len(outcomes) >= 2:
            o1, o2 = outcomes[0], outcomes[1]
            self.name1.setText(o1["title"])
            self.name2.setText(o2["title"])
            
            total = o1["channel_points"] + o2["channel_points"]
            if total == 0:
                p1, p2 = 50, 50
            else:
                p1 = round(100 * o1["channel_points"] / total)
                p2 = 100 - p1
            
            self.pct1.setText(f"{p1}%")
            self.pct2.setText(f"{p2}%")
            
            # Store for future use
            self.current_pred_id = prediction["id"]
            self.current_outcomes = {o["title"]: o["id"] for o in outcomes}
            
            # Set status message
            self.status_bar.showMessage(f"Active prediction: {title}")
    
    def clear_prediction_display(self):
        """Clear the prediction display."""
        self.name1.setText("—")
        self.name2.setText("—")
        self.pct1.setText("—")
        self.pct2.setText("—")
        self.status_bar.showMessage("No active prediction")
    
    def get_prediction_inputs(self, default_title="", default_p1="", default_p2=""):
        """Show dialog to get prediction inputs.
        
        Returns:
            (title, player1, player2) tuple if accepted, None if cancelled
        """
        dialog = QDialog(self)
        dialog.setWindowTitle("Prediction Details")
        layout = QFormLayout(dialog)
        
        title_input = QLineEdit(default_title)
        p1_input = QLineEdit(default_p1)
        p2_input = QLineEdit(default_p2)
        
        title_input.setMinimumWidth(300)
        p1_input.setMinimumWidth(300)
        p2_input.setMinimumWidth(300)
        
        layout.addRow("Title:", title_input)
        layout.addRow("Player 1:", p1_input)
        layout.addRow("Player 2:", p2_input)
        
        buttons = QDialogButtonBox(QDialogButtonBox.Ok | QDialogButtonBox.Cancel)
        buttons.accepted.connect(dialog.accept)
        buttons.rejected.connect(dialog.reject)
        layout.addWidget(buttons)
        
        if dialog.exec_() == QDialog.Accepted:
            return title_input.text(), p1_input.text(), p2_input.text()
        return None
    
    @pyqtSlot()
    def on_start(self):
        """Handle Start Prediction button click."""
        tags = self.manager.get_player_tags()
        round_name = self.manager.get_round_name()
        
        if not tags or not round_name:
            QMessageBox.warning(self, "Start Prediction", 
                               "Missing player tags or round name.")
            return
        
        prefix = "Who will win "
        suffix = "?"
        default_title = f"{prefix}{round_name}{suffix}"
        out1, out2 = tags
        
        result = self.get_prediction_inputs(default_title, out1, out2)
        if not result:
            return
        
        title, player1, player2 = result
        success = self.manager.post_prediction(title, [player1, player2])
        
        if success:
            QMessageBox.information(self, "Start Prediction", "Prediction started successfully!")
        else:
            QMessageBox.critical(self, "Start Prediction", "Failed to start prediction.")
    
    @pyqtSlot()
    def on_decide(self):
        """Handle Decide Winner button click."""
        if not self.current_pred_id or len(self.current_outcomes) < 2:
            QMessageBox.warning(self, "Decide Winner", 
                               "No active two-way prediction to resolve.")
            return
        
        # Get scores and reorder players based on scores
        items = list(self.current_outcomes.keys())
        scores = self.manager.get_scores()
        
        if scores and len(scores) == 2:
            if scores[1] > scores[0]:
                items.reverse()  # Ensure the player with the higher score is first
        
        winner, ok = QInputDialog.getItem(
            self, "Decide Winner", "Select winning outcome:", 
            items, 0, False  # default to the first item (leading player)
        )
        
        if not ok:
            return
        
        winner_id = self.current_outcomes[winner]
        success = self.manager.resolve_prediction(self.current_pred_id, winner_id)
        
        if success:
            QMessageBox.information(self, "Resolve Prediction", "Prediction resolved successfully!")
        else:
            QMessageBox.critical(self, "Resolve Prediction", "Failed to resolve prediction.")
    
    @pyqtSlot()
    def on_delete(self):
        """Handle Delete Prediction button click."""
        if not self.current_pred_id:
            QMessageBox.warning(self, "Delete Prediction", 
                               "No active prediction to delete.")
            return
        
        reply = QMessageBox.question(
            self, "Confirm Delete", 
            "Are you sure you want to delete the current prediction?",
            QMessageBox.Yes | QMessageBox.No, QMessageBox.No
        )
        
        if reply != QMessageBox.Yes:
            return
        
        success = self.manager.cancel_prediction(self.current_pred_id)
        
        if success:
            QMessageBox.information(self, "Delete Prediction", "Prediction deleted successfully!")
        else:
            QMessageBox.critical(self, "Delete Prediction", "Failed to delete prediction.")
    
    @pyqtSlot()
    def on_verify(self):
        """Handle Verify Tournament Data button click."""
        tags = self.manager.get_player_tags()
        round_name = self.manager.get_round_name()
        scores = self.manager.get_scores()
        
        missing = []
        if not tags:
            missing.append("player tags")
        if not round_name:
            missing.append("round name")
        if not scores:
            missing.append("scores")
        
        if missing:
            QMessageBox.critical(
                self, "Verify Files",
                "Missing or unreadable: " + ", ".join(missing)
            )
        else:
            QMessageBox.information(
                self, "Verify Files",
                f"Players: {tags[0]} vs {tags[1]}\nRound: {round_name}\nScore: {scores[0]}–{scores[1]}"
            )
    
    @pyqtSlot()
    def on_quit(self):
        """Handle Quit button click."""
        self.close()
    
    def closeEvent(self, event):
        """Handle window close event."""
        # Save window position and size
        self.settings.setValue("geometry", self.saveGeometry())
        
        # Clean up resources
        self.ui_timer.stop()
        self.manager.stop_poller()
        
        # Accept the close event
        event.accept()


def apply_dark_style(app):
    """Apply macOS native styling to the application."""
    app.setStyle("macintosh")



def main():
    """Main application entry point."""
    app = QApplication(sys.argv)
    
    # Apply application style
    apply_dark_style(app)
    
    # Create and show the main window
    main_window = PredictionWindow()
    main_window.show()
    
    # Run the application
    sys.exit(app.exec_())


if __name__ == "__main__":
    main()