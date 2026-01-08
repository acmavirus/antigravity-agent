import psutil
import subprocess
import os
import time
import pathlib
from typing import List, Optional, Tuple
from app.core.config import get_antigravity_path

class ProcessManager:
    PROCESS_NAME = "Antigravity.exe" if os.name == 'nt' else "antigravity"

    @staticmethod
    def is_running() -> bool:
        """Check if Antigravity is currently running."""
        for proc in psutil.process_iter(['name']):
            if proc.info['name'] == ProcessManager.PROCESS_NAME:
                return True
        return False

    @staticmethod
    def kill_all() -> List[int]:
        """Terminate all Antigravity processes."""
        killed_pids = []
        for proc in psutil.process_iter(['pid', 'name']):
            if proc.info['name'] == ProcessManager.PROCESS_NAME:
                try:
                    proc.terminate()
                    killed_pids.append(proc.info['pid'])
                except (psutil.NoSuchProcess, psutil.AccessDenied):
                    pass
        
        # Give it a moment to close
        if killed_pids:
            time.sleep(1)
            # Force kill if still alive
            for pid in killed_pids:
                try:
                    p = psutil.Process(pid)
                    p.kill()
                except:
                    pass
        
        return killed_pids

    @staticmethod
    def detect_executable_path() -> Optional[str]:
        """Tự động tìm kiếm đường dẫn file thực thi của Antigravity."""
        if os.name == 'nt':  # Windows
            local_app_data = os.environ.get('LOCALAPPDATA', '')
            # Các đường dẫn cài đặt thông thường của Antigravity
            possible_paths = [
                pathlib.Path(local_app_data) / "Programs" / "Antigravity" / "Antigravity.exe",
                pathlib.Path(local_app_data) / "Programs" / "Antigravity" / "bin" / "antigravity.cmd",
                pathlib.Path(os.environ.get('ProgramFiles', '')) / "Antigravity" / "Antigravity.exe",
                # Thêm đường dẫn trên ổ D
                pathlib.Path("D:/Program Files/Antigravity/Antigravity.exe"),
                pathlib.Path("D:/Program Files (x86)/Antigravity/Antigravity.exe"),
            ]
            for p in possible_paths:
                if p.exists():
                    return str(p)
        return None

    @staticmethod
    def get_effective_path() -> Tuple[Optional[str], str]:
        """
        Lấy đường dẫn Antigravity hiệu lực.
        Returns: (path, source) - path là đường dẫn, source là nguồn (saved/detected/none)
        """
        # 1. Ưu tiên đường dẫn đã lưu
        saved_path = get_antigravity_path()
        if saved_path and pathlib.Path(saved_path).exists():
            return saved_path, "saved"
        
        # 2. Tự động phát hiện
        detected_path = ProcessManager.detect_executable_path()
        if detected_path:
            return detected_path, "detected"
        
        return None, "none"

    @staticmethod
    def start_app(path: Optional[str] = None) -> Tuple[bool, str]:
        """Khởi động ứng dụng Antigravity."""
        if path:
            target_path = path
        else:
            target_path, source = ProcessManager.get_effective_path()
        
        if not target_path:
            return False, "Không tìm thấy đường dẫn Antigravity. Vui lòng cấu hình đường dẫn trong Cài đặt."
        
        if not pathlib.Path(target_path).exists():
            return False, f"Đường dẫn không tồn tại: {target_path}"
        
        try:
            print(f"🚀 Đang khởi động Antigravity từ: {target_path}")
            if os.name == 'nt':
                # Sử dụng os.startfile để khởi động tách biệt với tiến trình Agent
                os.startfile(target_path)
            else:
                subprocess.Popen([target_path], start_new_session=True)
            return True, f"Đã khởi động Antigravity từ: {target_path}"
        except Exception as e:
            return False, f"Lỗi khởi động app: {e}"

