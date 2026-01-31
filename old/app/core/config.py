import os
import pathlib
import json

# Thư mục cấu hình của Agent (Python version)
# Giữ nguyên đường dẫn giống bản Rust để dùng chung dữ liệu nếu cần
HOME_DIR = pathlib.Path.home() / ".antigravity-agent"
ACCOUNTS_DIR = HOME_DIR / "antigravity-accounts"
CONFIG_FILE = HOME_DIR / "config.json"

# Tạo thư mục nếu chưa có
os.makedirs(ACCOUNTS_DIR, exist_ok=True)

# Port cho Local API
API_PORT = 18888
API_HOST = "127.0.0.1"

def load_config() -> dict:
    """Load configuration from config file."""
    if CONFIG_FILE.exists():
        try:
            with open(CONFIG_FILE, 'r', encoding='utf-8') as f:
                return json.load(f)
        except:
            pass
    return {}

def save_config(config: dict):
    """Save configuration to config file."""
    try:
        with open(CONFIG_FILE, 'w', encoding='utf-8') as f:
            json.dump(config, f, indent=4)
    except Exception as e:
        print(f"Lỗi lưu config: {e}")

def get_antigravity_path() -> str:
    """Get saved Antigravity executable path."""
    config = load_config()
    return config.get("antigravity_path", "")

def set_antigravity_path(path: str):
    """Save Antigravity executable path."""
    config = load_config()
    config["antigravity_path"] = path
    save_config(config)
