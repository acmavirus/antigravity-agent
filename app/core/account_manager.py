import os
import json
import glob
from typing import List, Dict, Tuple
from app.core.config import ACCOUNTS_DIR
from app.core.auth_handler import AuthHandler
from app.core.db_handler import DBHandler, AGENT_STATE_KEY

class AccountManager:
    @staticmethod
    def list_accounts(include_state: bool = False) -> List[Dict]:
        """Danh sách tất cả tài khoản đã lưu trong thư mục backup.
        
        Args:
            include_state: Nếu True, bao gồm cả dữ liệu state (để fetch quota)
        """
        accounts = []
        pattern = os.path.join(ACCOUNTS_DIR, "*.json")
        for file_path in glob.glob(pattern):
            try:
                with open(file_path, 'r', encoding='utf-8') as f:
                    data = json.load(f)
                    b64_state = data.get(AGENT_STATE_KEY)
                    if b64_state:
                        summary = AuthHandler.get_account_summary(b64_state)
                        account_info = {
                            "filename": os.path.basename(file_path),
                            "email": summary["email"],
                            "plan": summary["plan"]
                        }
                        if include_state:
                            account_info["state"] = b64_state
                        accounts.append(account_info)
            except Exception as e:
                print(f"Lỗi đọc file {file_path}: {e}")
        return accounts

    @staticmethod
    def save_current_account():
        """Lấy tài khoản hiện tại từ DB và lưu vào thư mục backup."""
        db = DBHandler()
        state = db.read_key(AGENT_STATE_KEY)
        if not state:
            return False, "Không tìm thấy phiên đăng nhập hiện tại."
        
        summary = AuthHandler.get_account_summary(state)
        email = summary["email"]
        if email == "Unknown":
            return False, "Không thể xác định email tài khoản."
        
        file_path = os.path.join(ACCOUNTS_DIR, f"{email}.json")
        try:
            with open(file_path, 'w', encoding='utf-8') as f:
                json.dump({AGENT_STATE_KEY: state}, f, indent=4)
            return True, f"Đã lưu tài khoản {email}"
        except Exception as e:
            return False, str(e)

    @staticmethod
    def switch_to_account(email: str):
        """Chuyển đổi sang tài khoản dựa trên email."""
        file_path = os.path.join(ACCOUNTS_DIR, f"{email}.json")
        if not os.path.exists(file_path):
            return False, "Tài khoản không tồn tại."
        
        try:
            with open(file_path, 'r', encoding='utf-8') as f:
                data = json.load(f)
                state = data.get(AGENT_STATE_KEY)
                
            if not state:
                return False, "Dữ liệu tài khoản không hợp lệ."
            
            db = DBHandler()
            # 1. Ghi session mới
            db.write_key(AGENT_STATE_KEY, state)
            # 2. Xóa trạng thái auth cũ để force nhận diện mới
            from app.core.db_handler import AUTH_STATUS_KEY
            db.delete_key(AUTH_STATUS_KEY)
            
            return True, f"Đã chuyển sang {email}"
        except Exception as e:
            return False, str(e)

    @staticmethod
    def delete_account(email: str) -> Tuple[bool, str]:
        """Xóa một tài khoản đã lưu."""
        file_path = os.path.join(ACCOUNTS_DIR, f"{email}.json")
        if os.path.exists(file_path):
            try:
                os.remove(file_path)
                return True, f"Đã xóa tài khoản {email}"
            except Exception as e:
                return False, str(e)
        return False, "Tài khoản không tồn tại."

    @staticmethod
    def clear_all_accounts() -> Tuple[int, str]:
        """Xóa tất cả tài khoản trong thư mục backup."""
        pattern = os.path.join(ACCOUNTS_DIR, "*.json")
        count = 0
        for file_path in glob.glob(pattern):
            try:
                os.remove(file_path)
                count += 1
            except:
                pass
        return count, f"Đã dọn dẹp {count} tài khoản."
