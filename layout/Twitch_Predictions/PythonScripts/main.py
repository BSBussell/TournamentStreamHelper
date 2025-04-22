# main.py

import sys
from PyQt5.QtWidgets import (
    QApplication, QMainWindow, QWidget,
    QVBoxLayout, QHBoxLayout,
    QLabel, QPushButton, QMessageBox, QInputDialog
)
from PyQt5.QtCore import QTimer, Qt

import TwitchPredictionMethods as backend

class PredictionWindow(QMainWindow):
    def __init__(self):
        super().__init__()
        self.setWindowTitle("Twitch Prediction Manager")
        self.resize(400, 200)

        # Central widget + layouts
        central = QWidget()
        self.setCentralWidget(central)
        main_layout = QVBoxLayout()
        central.setLayout(main_layout)

        # --- Prediction display ---
        self.name_layout = QHBoxLayout()
        self.name1 = QLabel("P1")
        self.name1.setAlignment(Qt.AlignCenter)
        self.name2 = QLabel("P2")
        self.name2.setAlignment(Qt.AlignCenter)
        self.name_layout.addWidget(self.name1)
        self.name_layout.addWidget(self.name2)
        main_layout.addLayout(self.name_layout)

        self.percent_layout = QHBoxLayout()
        self.pct1 = QLabel("—%")
        self.pct1.setAlignment(Qt.AlignCenter)
        self.pct2 = QLabel("—%")
        self.pct2.setAlignment(Qt.AlignCenter)
        self.percent_layout.addWidget(self.pct1)
        self.percent_layout.addWidget(self.pct2)
        main_layout.addLayout(self.percent_layout)

        # --- Buttons ---
        btn_layout = QVBoxLayout()
        btn_start    = QPushButton("Start Prediction")
        btn_decide   = QPushButton("Decide Winner")
        btn_delete   = QPushButton("Delete Prediction")
        btn_verify   = QPushButton("Verify Files")
        btn_quit     = QPushButton("Quit")
        for btn in (btn_start, btn_decide, btn_delete, btn_verify, btn_quit):
            btn_layout.addWidget(btn)
        main_layout.addLayout(btn_layout)

        # Connect signals
        btn_start.clicked.connect(self.on_start)
        btn_decide.clicked.connect(self.on_decide)
        btn_verify.clicked.connect(self.on_verify)
        btn_delete.clicked.connect(self.on_delete)
        btn_quit.clicked.connect(self.close)

        # Begin background poller
        backend.get_user_id()  # ensure broadcaster_id is set
        backend.start_poller()

        # UI timer to refresh display
        self.timer = QTimer(self)
        self.timer.timeout.connect(self.refresh_display)
        self.timer.start(2000)  # every 2 seconds

        # store last outcomes for Decide Winner dialog
        self.current_pred_id = None
        self.current_outcomes = {}

    def refresh_display(self):
        pred = backend.fetch_current_prediction()
        if not pred:
            self.name1.setText("No active prediction")
            self.name2.setText("")
            self.pct1.setText("—")
            self.pct2.setText("—")
            self.current_pred_id = None
            self.current_outcomes = {}
            return

        # grab outcomes list (expecting two)
        outs = pred.get("outcomes", [])
        if len(outs) >= 2:
            o1, o2 = outs[0], outs[1]
            self.name1.setText(o1["title"])
            self.name2.setText(o2["title"])
            total = o1["channel_points"] + o2["channel_points"] or 1
            p1 = round(100 * o1["channel_points"]/total)
            p2 = 100 - p1
            self.pct1.setText(f"{p1}%")
            self.pct2.setText(f"{p2}%")
            self.current_pred_id = pred["id"]
            self.current_outcomes = {o["title"]: o["id"] for o in outs}
        else:
            # fallback if only one or unexpected
            self.name1.setText(pred.get("title",""))
            self.name2.setText("")
            self.pct1.setText("")
            self.pct2.setText("")
            self.current_pred_id = pred["id"]
            self.current_outcomes = {}

    def on_start(self):
        tags = backend.get_player_tags()
        round_name = backend.get_round_name()
        if not tags or not round_name:
            QMessageBox.warning(self, "Start Prediction", "Missing player tags or round name.")
            return

        prefix = "Who will win "
        suffix = "???"
        title = f"{prefix}{round_name}{suffix}"
        out1, out2 = tags
        window = backend.get_prediction_window()

        success = backend.post_prediction(title, [out1, out2], window)
        QMessageBox.information(self, "Start Prediction", "Success!" if success else "Failed.")

    def on_decide(self):
        if not self.current_pred_id or len(self.current_outcomes) < 2:
            QMessageBox.warning(self, "Decide Winner", "No active two-way prediction to resolve.")
            return

        # Get scores and reorder players based on scores
        items = list(self.current_outcomes.keys())
        scores = backend.get_scores()
        if scores and len(scores) == 2:
            if scores[1] > scores[0]:
                items.reverse()  # Ensure the player with the higher score is first

        # Default to selecting the player with the leading score
        default_winner = items[0]

        winner, ok = QInputDialog.getItem(
            self, "Decide Winner", "Select winning outcome:", items, editable=False
        )
        if not ok:
            return

        winner_id = self.current_outcomes[winner]
        success = backend.resolve_prediction(self.current_pred_id, winner_id)
        QMessageBox.information(self, "Resolve Prediction", "Resolved!" if success else "Failed.")

    def on_delete(self):
        if not self.current_pred_id:
            QMessageBox.warning(self, "Delete Prediction", "No active prediction to delete.")
            return
        success = backend.cancel_prediction(self.current_pred_id)
        QMessageBox.information(self, "Delete Prediction", "Deleted!" if success else "Failed to delete.")

    def on_verify(self):
        tags  = backend.get_player_tags()
        rnd   = backend.get_round_name()
        scores= backend.get_scores()

        missing = []
        if not tags:   missing.append("player tags")
        if not rnd:    missing.append("round name")
        if not scores: missing.append("scores")

        if missing:
            QMessageBox.critical(
                self, "Verify Files",
                "Missing or unreadable: " + ", ".join(missing)
            )
        else:
            QMessageBox.information(
                self, "Verify Files",
                f"Players: {tags[0]} vs {tags[1]}\nRound: {rnd}\nScore: {scores[0]}–{scores[1]}"
            )

if __name__ == "__main__":
    app = QApplication(sys.argv)
    w = PredictionWindow()
    w.show()
    sys.exit(app.exec_())