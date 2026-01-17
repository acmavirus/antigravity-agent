import sys
import os
from app.api.server import start_api_thread
import flet as ft
from app.ui.main_window import main as ui_main

if __name__ == "__main__":
    print("STARTING: Antigravity Agent (Python)...")
    
    # 1. Khởi động API Server chạy ngầm
    try:
        start_api_thread()
        print("SUCCESS: API Server started at http://127.0.0.1:18888")
    except Exception as e:
        print(f"ERROR: Could not start API Server: {e}")

    # 2. Khởi động Giao diện người dùng
    ft.app(ui_main, assets_dir="assets")
