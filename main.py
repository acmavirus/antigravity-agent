"""
Antigravity Agent
Main entry point for the application.
"""
import sys
import os

# Add the project root to sys.path
sys.path.append(os.path.dirname(os.path.abspath(__file__)))

from app.ui.main_window import AntigravityApp
from app.api.server import run_api
from app.core.logger import logger
import threading

def start_api():
    logger.info("STARTING: API Server for Antigravity Agent...")
    run_api()

if __name__ == "__main__":
    # Start API server in a separate thread
    api_thread = threading.Thread(target=start_api, daemon=True)
    api_thread.start()
    
    logger.info("STARTING: Antigravity Agent...")
    app = AntigravityApp()
    app.mainloop()
