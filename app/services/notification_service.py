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
    pre_notified: bool = False  # Đã thông báo trước 5 phút chưa
    retry_count: int = 0  # Số lần retry preheat
    last_retry: Optional[datetime] = None  # Thời gian retry cuối


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
                        # Parse last_retry if exists
                        last_retry = None
                        if item.get('last_retry'):
                            try:
                                last_retry = datetime.fromisoformat(item['last_retry'])
                            except:
                                pass
                        
                        self._schedules[key] = ResetSchedule(
                            email=item['email'],
                            model_id=item.get('model_id', ''),
                            model_name=item['model_name'],
                            reset_time=datetime.fromisoformat(item['reset_time']),
                            notified=item.get('notified', False),
                            triggered=item.get('triggered', False),
                            pre_notified=item.get('pre_notified', False),
                            retry_count=item.get('retry_count', 0),
                            last_retry=last_retry
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
                    'triggered': schedule.triggered,
                    'pre_notified': schedule.pre_notified,
                    'retry_count': schedule.retry_count,
                    'last_retry': schedule.last_retry.isoformat() if schedule.last_retry else None
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
    
    def send_notification(self, title: str, message: str, notif_type: str = "reset", play_sound: bool = True):
        """Gửi thông báo Desktop + UI trong app."""
        
        # 1. Gửi thông báo lên UI trong app (luôn hoạt động)
        if NotificationService._ui_callback:
            try:
                NotificationService._ui_callback(title, message, notif_type)
                print(f"[Notification] Sent to UI: {title}")
            except Exception as e:
                print(f"[Notification] UI callback error: {e}")
        
        # 2. Phát âm thanh cho thông báo quan trọng
        if play_sound and notif_type in ["reset", "warning", "danger"]:
            try:
                import winsound
                # Beep: frequency=1000Hz, duration=500ms
                winsound.Beep(1000, 500)
            except Exception as e:
                print(f"[Notification] Sound playback failed: {e}")
        
        # 3. Thử gửi Windows Toast (có thể không hoạt động trong exe)
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
            
            # Tính thời gian còn lại
            time_diff = (reset_time - now).total_seconds()
            
            # Debug log
            if time_diff > 0:
                mins_remaining = int(time_diff / 60)
                if mins_remaining > 60:
                    print(f"  - {schedule.model_name}: {mins_remaining // 60}h {mins_remaining % 60}m remaining")
                else:
                    print(f"  - {schedule.model_name}: {mins_remaining} mins remaining")
            else:
                print(f"  - {schedule.model_name}: READY (notified={schedule.notified}, triggered={schedule.triggered})")
            
            # 1. Gửi thông báo trước 5 phút
            if 0 < time_diff <= 300 and not schedule.pre_notified:  # 300s = 5 phút
                mins_left = int(time_diff / 60)
                print(f"[Notification] Sending pre-notification for {schedule.model_name} ({mins_left} mins left)...")
                self.send_notification(
                    title=f"Sắp Reset!",
                    message=f"{schedule.model_name}\nTài khoản: {schedule.email}\nCòn {mins_left} phút nữa sẽ reset quota.",
                    notif_type="warning"
                )
                schedule.pre_notified = True
                self._save_schedules()
                print(f"[Notification] Sent pre-notification for {schedule.model_name}")
            
            # 2. Gửi thông báo khi đến giờ reset
            if now >= reset_time and not schedule.notified:
                print(f"[Notification] Sending reset notification for {schedule.model_name}...")
                self.send_notification(
                    title=f"Model đã Reset!",
                    message=f"{schedule.model_name}\nTài khoản: {schedule.email}\nHệ thống sẽ tự động gửi 'Hi' để bắt đầu chu kỳ mới."
                )
                schedule.notified = True
                self._save_schedules()
                print(f"[Notification] Sent reset notification for {schedule.model_name} ({schedule.email})")

            # 3. Tự động gửi 'Hi' để kích hoạt chu kỳ mới (Preheat)
            if now >= reset_time and not schedule.triggered:
                print(f"[Trigger] Starting preheat for {schedule.model_name} (model_id={schedule.model_id})...")
                # Thực hiện preheat trong thread riêng để không block monitor
                threading.Thread(target=self._perform_preheat_with_retry, args=(schedule,), daemon=True).start()
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
    
    def _perform_preheat_with_retry(self, schedule: ResetSchedule):
        """Thực hiện gọi API để gửi tin nhắn 'Hi' với retry logic."""
        import time
        
        max_retries = 3
        retry_delays = [5, 15, 30]  # Exponential backoff: 5s, 15s, 30s
        
        for attempt in range(max_retries):
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
                        return success, target_acc
                    else:
                        print(f"[Trigger] Could not find state for {schedule.email}")
                        return False, None

                loop = asyncio.new_event_loop()
                asyncio.set_event_loop(loop)
                success, target_acc = loop.run_until_complete(do_trigger())
                loop.close()
                
                if success:
                    print(f"[Trigger] Successfully preheated {schedule.model_name} for {schedule.email} (attempt {attempt + 1})")
                    # Gửi thông báo thành công
                    self.send_notification(
                        title="Preheat Thành công",
                        message=f"{schedule.model_name}\nTài khoản: {schedule.email}\nĐã kích hoạt chu kỳ mới.",
                        notif_type="success",
                        play_sound=False  # Không phát âm thanh cho success
                    )
                    schedule.retry_count = attempt + 1
                    schedule.last_retry = datetime.now(timezone(timedelta(hours=7)))
                    self._save_schedules()
                    return  # Success, exit
                else:
                    print(f"[Trigger] Failed to preheat {schedule.model_name} for {schedule.email} (attempt {attempt + 1})")
                    
                    # Retry nếu chưa hết số lần
                    if attempt < max_retries - 1:
                        delay = retry_delays[attempt]
                        print(f"[Trigger] Retrying in {delay} seconds...")
                        time.sleep(delay)
                    else:
                        # Hết retry, gửi thông báo thất bại
                        self.send_notification(
                            title="Preheat Thất bại",
                            message=f"{schedule.model_name}\nTài khoản: {schedule.email}\nKhông thể kích hoạt sau {max_retries} lần thử.",
                            notif_type="danger"
                        )
                        schedule.retry_count = max_retries
                        schedule.last_retry = datetime.now(timezone(timedelta(hours=7)))
                        self._save_schedules()

            except Exception as e:
                print(f"[Trigger] Error in preheat attempt {attempt + 1}: {e}")
                if attempt < max_retries - 1:
                    delay = retry_delays[attempt]
                    print(f"[Trigger] Retrying in {delay} seconds...")
                    time.sleep(delay)
                else:
                    # Hết retry, gửi thông báo lỗi
                    self.send_notification(
                        title="Preheat Lỗi",
                        message=f"{schedule.model_name}\nTài khoản: {schedule.email}\nLỗi: {str(e)}",
                        notif_type="danger"
                    )
                    schedule.retry_count = max_retries
                    schedule.last_retry = datetime.now(timezone(timedelta(hours=7)))
                    self._save_schedules()
    
    def start_monitor(self, interval_seconds: int = 30):
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
        """Xóa các lịch reset đã cũ (đã thông báo và quá 48h)."""
        now = datetime.now(timezone(timedelta(hours=7)))
        old_keys = []
        
        for key, schedule in self._schedules.items():
            if schedule.notified:
                reset_time = schedule.reset_time
                if reset_time.tzinfo is None:
                    reset_time = reset_time.replace(tzinfo=timezone(timedelta(hours=7)))
                
                if now - reset_time > timedelta(hours=48):
                    old_keys.append(key)
        
        for key in old_keys:
            del self._schedules[key]
        
        if old_keys:
            self._save_schedules()
            print(f"[Notification] Cleaned up {len(old_keys)} old schedules")
