"""
Notification Service - Quản lý thông báo reset quota
Sử dụng Windows Toast Notifications
"""
import threading
import json
import os
from datetime import datetime, timedelta, timezone
from typing import Dict, List, Optional
from dataclasses import dataclass, field

# File lưu trữ thời gian reset đã theo dõi
RESET_TRACKER_FILE = os.path.join(os.environ.get('APPDATA', ''), 'AntigravityAgent', 'reset_tracker.json')


@dataclass
class ResetSchedule:
    """Thông tin lịch reset của một model."""
    email: str
    model_id: str     # ID kỹ thuật (ví dụ: gemini-3-pro-high)
    model_name: str   # Tên hiển thị (ví dụ: Gemini 3 Pro High)
    reset_time: datetime  # Thời gian reset (UTC+7)
    notified: bool = False  # Đã thông báo chưa
    triggered: bool = False # Đã gửi tin nhắn 'Hi' chưa


class NotificationService:
    """Service quản lý thông báo desktop."""
    
    _instance = None
    _lock = threading.Lock()
    _schedules: Dict[str, ResetSchedule] = {}  # key = "email|model_name"
    _monitor_thread: Optional[threading.Thread] = None
    _running = False
    _ui_callback = None  # Callback để gửi thông báo lên UI
    
    @classmethod
    def get_instance(cls):
        if cls._instance is None:
            with cls._lock:
                if cls._instance is None:
                    cls._instance = cls()
        return cls._instance
    
    def __init__(self):
        self._load_schedules()
    
    def set_ui_callback(self, callback):
        """Đăng ký callback function để gửi thông báo lên UI."""
        NotificationService._ui_callback = callback
        print(f"[Notification] UI callback registered")
    
    def _get_schedule_key(self, email: str, model_name: str) -> str:
        return f"{email}|{model_name}"
    
    def _load_schedules(self):
        """Load lịch reset từ file."""
        try:
            if os.path.exists(RESET_TRACKER_FILE):
                with open(RESET_TRACKER_FILE, 'r', encoding='utf-8') as f:
                    data = json.load(f)
                    for key, item in data.items():
                        self._schedules[key] = ResetSchedule(
                            email=item['email'],
                            model_id=item.get('model_id', ''),
                            model_name=item['model_name'],
                            reset_time=datetime.fromisoformat(item['reset_time']),
                            notified=item.get('notified', False),
                            triggered=item.get('triggered', False)
                        )
        except Exception as e:
            print(f"Error loading reset schedules: {e}")
    
    def _save_schedules(self):
        """Lưu lịch reset vào file."""
        try:
            os.makedirs(os.path.dirname(RESET_TRACKER_FILE), exist_ok=True)
            data = {}
            for key, schedule in self._schedules.items():
                data[key] = {
                    'email': schedule.email,
                    'model_id': schedule.model_id,
                    'model_name': schedule.model_name,
                    'reset_time': schedule.reset_time.isoformat(),
                    'notified': schedule.notified,
                    'triggered': schedule.triggered
                }
            with open(RESET_TRACKER_FILE, 'w', encoding='utf-8') as f:
                json.dump(data, f, ensure_ascii=False, indent=2)
        except Exception as e:
            print(f"Error saving reset schedules: {e}")
    
    def update_reset_schedule(self, email: str, model_id: str, model_name: str, reset_time_str: str):
        """Cập nhật lịch reset cho một model."""
        if not reset_time_str:
            return
        
        try:
            # Parse thời gian reset (định dạng "HH:MM dd/mm/YYYY" hoặc ISO)
            gmt7 = timezone(timedelta(hours=7))
            
            # Thử parse định dạng đã format
            try:
                reset_dt = datetime.strptime(reset_time_str, "%H:%M %d/%m/%Y")
                reset_dt = reset_dt.replace(tzinfo=gmt7)
            except ValueError:
                # Thử ISO format
                reset_dt = datetime.fromisoformat(reset_time_str.replace('Z', '+00:00'))
            
            key = self._get_schedule_key(email, model_name)
            
            # Nếu thời gian reset mới xa hơn thời gian hiện tại ít nhất 1 phút, reset flag triggered
            is_new_cycle = False
            if key in self._schedules:
                if reset_dt > self._schedules[key].reset_time + timedelta(minutes=5):
                    is_new_cycle = True

            # Cập nhật hoặc thêm mới
            if key not in self._schedules or is_new_cycle or self._schedules[key].reset_time != reset_dt:
                self._schedules[key] = ResetSchedule(
                    email=email,
                    model_id=model_id,
                    model_name=model_name,
                    reset_time=reset_dt,
                    notified=False,
                    triggered=False
                )
                self._save_schedules()
                print(f"[Notification] Scheduled reset for {model_name} ({email}) at {reset_time_str}")
        except Exception as e:
            print(f"Error updating reset schedule: {e}")
    
    def send_notification(self, title: str, message: str, notif_type: str = "reset"):
        """Gửi thông báo Desktop + UI trong app."""
        
        # 1. Gửi thông báo lên UI trong app (luôn hoạt động)
        if NotificationService._ui_callback:
            try:
                NotificationService._ui_callback(title, message, notif_type)
                print(f"[Notification] Sent to UI: {title}")
            except Exception as e:
                print(f"[Notification] UI callback error: {e}")
        
        # 2. Thử gửi Windows Toast (có thể không hoạt động trong exe)
        try:
            from plyer import notification
            notification.notify(
                title=title,
                message=message,
                app_name="Antigravity Agent",
                app_icon=None,
                timeout=10
            )
        except Exception as e:
            print(f"[Notification] Windows toast skipped: {e}")
    
    def check_and_notify(self):
        """Kiểm tra và gửi thông báo + tự động preheat cho các model đã reset."""
        now = datetime.now(timezone(timedelta(hours=7)))
        
        if len(self._schedules) > 0:
            print(f"[Monitor] Checking {len(self._schedules)} schedules at {now.strftime('%H:%M:%S %d/%m/%Y')}")
        
        for key, schedule in list(self._schedules.items()):
            # So sánh thời gian
            reset_time = schedule.reset_time
            if reset_time.tzinfo is None:
                reset_time = reset_time.replace(tzinfo=timezone(timedelta(hours=7)))
            
            # Debug log
            time_diff = (reset_time - now).total_seconds()
            if time_diff > 0:
                print(f"  - {schedule.model_name}: {int(time_diff/60)} mins remaining")
            else:
                print(f"  - {schedule.model_name}: READY (notified={schedule.notified}, triggered={schedule.triggered})")
            
            # 1. Gửi thông báo khi đến giờ reset
            if now >= reset_time and not schedule.notified:
                print(f"[Notification] Sending notification for {schedule.model_name}...")
                self.send_notification(
                    title=f"Model da Reset!",
                    message=f"{schedule.model_name}\nTai khoan: {schedule.email}\nHe thong se tu dong gui 'Hi' de bat dau chu ky moi."
                )
                schedule.notified = True
                self._save_schedules()
                print(f"[Notification] Sent reset notification for {schedule.model_name} ({schedule.email})")

            # 2. Tự động gửi 'Hi' để kích hoạt chu kỳ mới (Preheat)
            if now >= reset_time and not schedule.triggered:
                print(f"[Trigger] Starting preheat for {schedule.model_name} (model_id={schedule.model_id})...")
                # Thực hiện preheat trong thread riêng để không block monitor
                threading.Thread(target=self._perform_preheat, args=(schedule,), daemon=True).start()
                schedule.triggered = True
                self._save_schedules()

    def _perform_preheat(self, schedule: ResetSchedule):
        """Thực hiện gọi API để gửi tin nhắn 'Hi'."""
        try:
            from app.services.quota_service import QuotaService
            from app.core.account_manager import AccountManager
            import asyncio

            async def do_trigger():
                # Lấy state mới nhất của email này
                accounts = AccountManager.list_accounts(include_state=True)
                target_acc = next((a for a in accounts if a["email"] == schedule.email), None)
                
                if target_acc and target_acc.get("state"):
                    success = await QuotaService.trigger_model_preheat_by_state(
                        target_acc["state"], 
                        schedule.model_id
                    )
                    if success:
                        print(f"[Trigger] Successfully preheated {schedule.model_name} for {schedule.email}")
                    else:
                        print(f"[Trigger] Failed to preheat {schedule.model_name} for {schedule.email}")
                else:
                    print(f"[Trigger] Could not find state for {schedule.email}")

            loop = asyncio.new_event_loop()
            asyncio.set_event_loop(loop)
            loop.run_until_complete(do_trigger())
            loop.close()

        except Exception as e:
            print(f"Error in _perform_preheat: {e}")
    
    def start_monitor(self, interval_seconds: int = 60):
        """Bắt đầu thread kiểm tra thông báo."""
        if self._monitor_thread and self._monitor_thread.is_alive():
            return
        
        self._running = True
        
        def monitor_loop():
            import time
            while self._running:
                try:
                    self.check_and_notify()
                except Exception as e:
                    print(f"Monitor error: {e}")
                time.sleep(interval_seconds)
        
        self._monitor_thread = threading.Thread(target=monitor_loop, daemon=True)
        self._monitor_thread.start()
        print(f"[Notification] Monitor started (checking every {interval_seconds}s)")
    
    def stop_monitor(self):
        """Dừng thread kiểm tra."""
        self._running = False
    
    def get_pending_resets(self) -> List[ResetSchedule]:
        """Lấy danh sách các lịch reset chưa được thông báo."""
        return [s for s in self._schedules.values() if not s.notified]
    
    def test_notification(self, email: str = "test@test.com", model_id: str = "gemini-3-flash", model_name: str = "TEST Model"):
        """Test thông báo bằng cách gửi trực tiếp."""
        import time
        
        print(f"[TEST] Starting notification test for {model_name}...")
        
        # 1. Gửi thông báo trực tiếp
        self.send_notification(
            title="Model da Reset!",
            message=f"{model_name}\nTai khoan: {email}\nDay la thong bao TEST!"
        )
        print(f"[TEST] Notification sent!")
        
        # 2. Thử gọi preheat
        print(f"[TEST] Attempting preheat for {model_id}...")
        schedule = ResetSchedule(
            email=email,
            model_id=model_id,
            model_name=model_name,
            reset_time=datetime.now(timezone(timedelta(hours=7))),
            notified=True,
            triggered=False
        )
        
        # Gọi preheat trong thread riêng
        threading.Thread(target=self._perform_preheat, args=(schedule,), daemon=True).start()
        print(f"[TEST] Preheat thread started!")
    
    def clear_old_schedules(self):
        """Xóa các lịch reset đã cũ (đã thông báo và quá 24h)."""
        now = datetime.now(timezone(timedelta(hours=7)))
        old_keys = []
        
        for key, schedule in self._schedules.items():
            if schedule.notified:
                reset_time = schedule.reset_time
                if reset_time.tzinfo is None:
                    reset_time = reset_time.replace(tzinfo=timezone(timedelta(hours=7)))
                
                if now - reset_time > timedelta(hours=24):
                    old_keys.append(key)
        
        for key in old_keys:
            del self._schedules[key]
        
        if old_keys:
            self._save_schedules()
