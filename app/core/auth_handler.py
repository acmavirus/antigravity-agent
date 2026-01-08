import base64
import sys
import pathlib

# Thêm thư mục proto vào path để import
sys.path.append(str(pathlib.Path(__file__).parent.parent.parent / "proto"))
import antigravity_pb2

class AuthHandler:
    @staticmethod
    def decode_session_state(b64_data: str):
        """Giải mã Protobuf session của Antigravity."""
        if not b64_data:
            return None
        
        try:
            raw_bytes = base64.b64decode(b64_data.strip())
            session = antigravity_pb2.SessionResponse()
            session.ParseFromString(raw_bytes)
            return session
        except Exception as e:
            print(f"Lỗi giải mã Protobuf: {e}")
            return None

    @staticmethod
    def get_account_summary(b64_data: str) -> dict:
        """Lấy thông tin tóm tắt của tài khoản."""
        session = AuthHandler.decode_session_state(b64_data)
        if not session:
            return {"email": "Unknown", "plan": "Unknown"}
        
        return {
            "email": session.context.email,
            "plan": session.context.plan_name,
            "status": session.context.status,
            "user_id": base64.b64encode(session.user_id_raw).decode('utf-8') if session.user_id_raw else ""
        }
