import os
import sqlite3
import pathlib
from typing import Optional, List, Tuple

class DBHandler:
    def __init__(self):
        self.db_path = self.detect_db_path()

    def detect_db_path(self) -> Optional[pathlib.Path]:
        """Detect the Antigravity SQLite database path based on OS."""
        if os.name == 'nt':  # Windows
            path = pathlib.Path(os.environ.get('APPDATA', '')) / "Antigravity" / "User" / "globalStorage" / "state.vscdb"
        else:  # macOS / Linux
            path = pathlib.Path.home() / ".config" / "Antigravity" / "User" / "globalStorage" / "state.vscdb"
        
        if path.exists():
            return path
        return None

    def read_key(self, key_name: str) -> Optional[str]:
        """Read a value from the ItemTable for a given key."""
        if not self.db_path:
            return None
        
        try:
            # Using a uri for read-only access to avoid locking issues
            conn = sqlite3.connect(f"file:{self.db_path}?mode=ro", uri=True)
            cursor = conn.cursor()
            cursor.execute("SELECT value FROM ItemTable WHERE key = ?", (key_name,))
            result = cursor.fetchone()
            conn.close()
            return result[0] if result else None
        except Exception as e:
            print(f"Error reading database: {e}")
            return None

    def write_key(self, key_name: str, value: str) -> bool:
        """Write/Update a key in the ItemTable."""
        if not self.db_path:
            return False
        
        try:
            conn = sqlite3.connect(self.db_path)
            cursor = conn.cursor()
            cursor.execute("INSERT OR REPLACE INTO ItemTable (key, value) VALUES (?, ?)", (key_name, value))
            conn.commit()
            conn.close()
            return True
        except Exception as e:
            print(f"Error writing to database: {e}")
            return False

    def delete_key(self, key_name: str) -> bool:
        """Delete a key from the ItemTable."""
        if not self.db_path:
            return False
        
        try:
            conn = sqlite3.connect(self.db_path)
            cursor = conn.cursor()
            cursor.execute("DELETE FROM ItemTable WHERE key = ?", (key_name,))
            conn.commit()
            conn.close()
            return True
        except Exception as e:
            print(f"Error deleting key: {e}")
            return False

# Constants for keys
AGENT_STATE_KEY = "jetskiStateSync.agentManagerInitState"
AUTH_STATUS_KEY = "antigravityAuthStatus"
