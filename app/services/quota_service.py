"""
Quota Service - Lấy thông tin hạn mức AI thực tế (Real-time) từ API Google Cloud Code
Dựa trên logic của phiên bản Rust (antigravity-agent-master)
"""
import httpx
import base64
import json
import struct
from typing import Dict, Optional, List, Tuple
from dataclasses import dataclass, field
from datetime import datetime
from app.core.auth_handler import AuthHandler


@dataclass
class ModelQuota:
    """Thông tin quota của một model."""
    model_name: str
    percentage: float = 0.0  # Phần trăm còn lại (0-100)
    reset_text: str = ""     # Thời gian reset (chuỗi từ API)
    
    def get_reset_time_str(self) -> str:
        """Trả về chuỗi hiển thị thời gian reset."""
        return self.reset_text if self.reset_text else "Không rõ"


@dataclass
class AccountQuota:
    """Thông tin quota của một tài khoản."""
    email: str
    plan: str
    models: List[ModelQuota] = field(default_factory=list)
    error: Optional[str] = None
    
    @property
    def is_valid(self) -> bool:
        return self.error is None


class QuotaService:
    """Service lấy quota realtime từ Google Cloud Code API."""
    
    # Cloudcode API endpoints (Dựa trên bản Rust)
    BASE_URL = "https://daily-cloudcode-pa.sandbox.googleapis.com"
    TOKEN_URL = "https://oauth2.googleapis.com/token"
    
    # Google OAuth2 client ID (Dựa trên bản Rust)
    CLIENT_ID = "1071006060591-tmhssin2h21lcre235vtolojh4g403ep.apps.googleusercontent.com"
    CLIENT_SECRET = "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"
    
    # Model Mapping (Dựa trên bản Rust)
    TARGET_MODELS = {
        "gemini-3-pro-high": "Gemini 3 Pro (High)",
        "gemini-3-pro-low": "Gemini 3 Pro (Low)",
        "gemini-3-flash": "Gemini 3 Flash",
        "claude-sonnet-4-5": "Claude Sonnet 4.5",
        "claude-sonnet-4-5-thinking": "Claude Sonnet 4.5 (Thinking)",
        "claude-opus-4-5-thinking": "Claude Opus 4.5 (Thinking)",
        "gpt-oss-120b-medium": "GPT-OSS 120B (Medium)",
    }

    @staticmethod
    async def refresh_access_token(id_token: str) -> Optional[str]:
        """Lấy access token mới từ id_token (refresh token)."""
        try:
            async with httpx.AsyncClient() as client:
                response = await client.post(
                    QuotaService.TOKEN_URL,
                    data={
                        "client_id": QuotaService.CLIENT_ID,
                        "client_secret": QuotaService.CLIENT_SECRET,
                        "refresh_token": id_token,
                        "grant_type": "refresh_token",
                    },
                    timeout=10.0
                )
                if response.status_code == 200:
                    return response.json().get("access_token")
            return None
        except Exception as e:
            print(f"Token refresh error: {e}")
            return None

    @staticmethod
    async def fetch_project_id(access_token: str) -> Optional[str]:
        """Lấy Project ID từ loadCodeAssist."""
        try:
            async with httpx.AsyncClient() as client:
                response = await client.post(
                    f"{QuotaService.BASE_URL}/v1internal:loadCodeAssist",
                    headers={
                        "Authorization": f"Bearer {access_token}",
                        "Content-Type": "application/json",
                        "User-Agent": "antigravity/windows/amd64",
                    },
                    json={"metadata": {"ideType": "ANTIGRAVITY"}},
                    timeout=10.0
                )
                if response.status_code == 200:
                    data = response.json()
                    return data.get("cloudaicompanionProject") or data.get("project") or data.get("projectId")
            return None
        except Exception as e:
            print(f"Load project error: {e}")
            return None

    @staticmethod
    async def fetch_realtime_models(access_token: str, project_id: str) -> Optional[Dict]:
        """Lấy danh sách model và quota realtime."""
        try:
            async with httpx.AsyncClient() as client:
                response = await client.post(
                    f"{QuotaService.BASE_URL}/v1internal:fetchAvailableModels",
                    headers={
                        "Authorization": f"Bearer {access_token}",
                        "Content-Type": "application/json",
                        "User-Agent": "antigravity/windows/amd64",
                    },
                    json={"project": project_id},
                    timeout=10.0
                )
                if response.status_code == 200:
                    return response.json()
            return None
        except Exception as e:
            print(f"Fetch models error: {e}")
            return None

    @staticmethod
    def format_reset_time(iso_string: str) -> str:
        """Chuyển đổi ISO string sang định dạng H:i dd/mm/YYYY (GMT+7)."""
        if not iso_string:
            return ""
        try:
            from datetime import datetime, timedelta, timezone
            # Google API thường trả về ISO format "2026-01-08T22:13:00Z"
            dt = datetime.fromisoformat(iso_string.replace('Z', '+00:00'))
            # Chuyển sang GMT+7
            gmt7 = timezone(timedelta(hours=7))
            dt_gmt7 = dt.astimezone(gmt7)
            return dt_gmt7.strftime("%H:%M %d/%m/%Y")
        except Exception as e:
            print(f"Format time error: {e}")
            return iso_string

    @staticmethod
    async def get_account_quota(b64_state: str) -> AccountQuota:
        """Lấy quota realtime cho một tài khoản (Dùng API Cloud Code)."""
        session = AuthHandler.decode_session_state(b64_state)
        if not session:
            return AccountQuota(email="Unknown", plan="Unknown", error="Lỗi giải mã session")

        email = session.context.email if session.context else "Unknown"
        plan = session.context.plan_name if session.context else "Unknown"
        
        # 1. Lấy token
        if not session.auth or not session.auth.id_token:
            return AccountQuota(email=email, plan=plan, error="Thiếu thông tin Auth")
            
        access_token = session.auth.access_token
        refresh_token = session.auth.id_token
        
        # 2. Refresh token nếu cần (thử load project để test token)
        project_id = await QuotaService.fetch_project_id(access_token)
        if not project_id:
            # Token có vẻ hết hạn, thử refresh
            access_token = await QuotaService.refresh_access_token(refresh_token)
            if access_token:
                project_id = await QuotaService.fetch_project_id(access_token)
        
        if not project_id:
            return AccountQuota(email=email, plan=plan, error="Không thể lấy Project ID")

        # 3. Lấy metrics thực tế
        models_data = await QuotaService.fetch_realtime_models(access_token, project_id)
        if not models_data or "models" not in models_data:
            return AccountQuota(email=email, plan=plan, error="Không thể lấy dữ liệu models")

        # 4. Parse quota
        models_list = []
        raw_models = models_data.get("models", {})
        
        for key, display_name in QuotaService.TARGET_MODELS.items():
            model_info = raw_models.get(key)
            if model_info and "quotaInfo" in model_info:
                qi = model_info["quotaInfo"]
                # remainingFraction: 0.0 - 1.0 (ví dụ 0.1867)
                fraction = qi.get("remainingFraction", 0.0)
                reset_time_raw = qi.get("resetTime", "")
                
                # Format thời gian reset sang GMT+7
                reset_time_formatted = QuotaService.format_reset_time(reset_time_raw)
                
                models_list.append(ModelQuota(
                    model_name=display_name,
                    percentage=fraction * 100.0,
                    reset_text=reset_time_formatted
                ))

        return AccountQuota(email=email, plan=plan, models=models_list)

    @staticmethod
    async def get_current_session_quota() -> Optional[AccountQuota]:
        """Tài khoản hiện tại từ DB."""
        import os
        import sqlite3
        try:
            db_path = os.path.join(os.environ.get('APPDATA', ''), 'Antigravity', 'User', 'globalStorage', 'state.vscdb')
            if not os.path.exists(db_path): return None
            conn = sqlite3.connect(db_path)
            cursor = conn.cursor()
            cursor.execute("SELECT value FROM ItemTable WHERE key = 'jetskiStateSync.agentManagerInitState'")
            row = cursor.fetchone()
            conn.close()
            if not row: return None
            return await QuotaService.get_account_quota(row[0])
        except Exception as e:
            print(f"Error reading current session: {e}")
            return None

    @staticmethod
    async def get_all_accounts_quota(accounts_data: List[Dict]) -> List[AccountQuota]:
        """Lấy quota realtime cho tất cả."""
        import asyncio
        tasks = [QuotaService.get_account_quota(acc.get("state", "")) for acc in accounts_data if acc.get("state")]
        return await asyncio.gather(*tasks)
