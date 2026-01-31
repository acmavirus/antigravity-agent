"""
Main Window for CustomTkinter Rewrite
Fully integrated with backend services.
"""
import customtkinter as ctk
import asyncio
import threading
import pathlib
import os
import pystray
from PIL import Image
from tkinter import filedialog
from datetime import datetime
from typing import Optional

from .theme import CTKColors, CTKTypography
from .components.sidebar import Sidebar

# Pages
from .pages.dashboard import DashboardPage
from .pages.accounts import AccountsPage
from .pages.quota_detail import QuotaDetailPage
from .pages.notifications import NotificationsPage
from .pages.settings import SettingsPage

# Core Services
from app.core.db_handler import DBHandler, AGENT_STATE_KEY
from app.core.process_manager import ProcessManager
from app.core.account_manager import AccountManager
from app.core.auth_handler import AuthHandler
from app.core.config import get_antigravity_path, set_antigravity_path
from app.services.quota_service import QuotaService
from app.services.notification_service import NotificationService

class AntigravityApp(ctk.CTk):
    def __init__(self):
        super().__init__()
        
        # Window Setup
        self.title("Antigravity Agent")
        self.geometry("1100x750")
        self.configure(fg_color=CTKColors.BACKGROUND)
        self.protocol("WM_DELETE_WINDOW", self.hide_window)
        
        # Tray Icon
        self.tray_icon = None
        self.setup_tray()
        
        # Services
        self.db = DBHandler()
        self.notification_svc = NotificationService.get_instance()
        self.pages = {}
        self.current_page_id = None
        self.notifications_list = []
        
        # Layout
        self.grid_columnconfigure(1, weight=1)
        self.grid_rowconfigure(0, weight=1)
        
        # Sidebar
        self.sidebar = Sidebar(self, on_nav_change=self.handle_nav_change)
        self.sidebar.grid(row=0, column=0, sticky="nsew")
        
        # Content Area
        self.content_container = ctk.CTkFrame(self, fg_color="transparent")
        self.content_area = ctk.CTkFrame(self.content_container, fg_color="transparent")
        self.content_container.grid(row=0, column=1, sticky="nsew", padx=20, pady=20)
        self.content_container.grid_columnconfigure(0, weight=1)
        self.content_container.grid_rowconfigure(0, weight=1)
        self.content_area.grid(row=0, column=0, sticky="nsew")

        # Async setup
        self.loop = asyncio.new_event_loop()
        threading.Thread(target=self._run_async_loop, daemon=True).start()
        
        # Initial Nav
        self.handle_nav_change("dashboard")
        
        # Start background components
        self.notification_svc.set_ui_callback(self.add_notification)
        self.notification_svc.start_monitor(interval_seconds=30)
        self.start_refresh_loop()

    def _run_async_loop(self):
        asyncio.set_event_loop(self.loop)
        self.loop.run_forever()

    def run_async(self, coro):
        return asyncio.run_coroutine_threadsafe(coro, self.loop)

    def setup_tray(self):
        try:
            icon_path = os.path.join(os.path.dirname(os.path.dirname(os.path.dirname(__file__))), "assets", "icon.ico")
            if not os.path.exists(icon_path):
                image = Image.new('RGB', (64, 64), color=(59, 130, 246))
            else:
                image = Image.open(icon_path)
            
            menu = (
                pystray.MenuItem('Show Window', self.show_window),
                pystray.MenuItem('Quit', self.quit_app)
            )
            self.tray_icon = pystray.Icon("antigravity", image, "Antigravity Agent", menu)
            threading.Thread(target=self.tray_icon.run, daemon=True).start()
        except Exception as e:
            print(f"Tray setup error: {e}")

    def hide_window(self):
        self.withdraw()
        if self.tray_icon:
            self.tray_icon.notify("Antigravity is still running in the background", "Agent Active")

    def show_window(self, icon=None, item=None):
        self.after(0, self.deiconify)
        self.after(0, self.focus_force)

    def quit_app(self, icon=None, item=None):
        if self.tray_icon:
            self.tray_icon.stop()
        self.quit()
        os._exit(0)

    def get_current_account_info(self):
        state = self.db.read_key(AGENT_STATE_KEY)
        if state:
            summary = AuthHandler.get_account_summary(state)
            return summary.get("email", "Unknown"), summary.get("plan", "Unknown")
        return "Unknown", "Unknown"

    def get_accounts_list(self):
        accounts = AccountManager.list_accounts()
        current_email, _ = self.get_current_account_info()
        for acc in accounts:
            acc["is_active"] = (acc["email"] == current_email)
        return accounts

    def handle_nav_change(self, page_id):
        if self.current_page_id:
            self.pages[self.current_page_id].pack_forget()
        
        self.current_page_id = page_id
        if page_id == "dashboard":
            if page_id not in self.pages:
                self.pages[page_id] = DashboardPage(self.content_area)
                self.pages[page_id].save_btn.configure(command=self.handle_save_account)
                self.pages[page_id].stop_btn.configure(command=self.handle_stop_all)
            self.refresh_dashboard()
            
        elif page_id == "accounts":
            if page_id not in self.pages:
                self.pages[page_id] = AccountsPage(
                    self.content_area, 
                    on_switch=self.handle_switch_account,
                    on_delete=self.handle_delete_account,
                    on_import=self.handle_import_accounts,
                    on_export=self.handle_export_accounts
                )
            self.refresh_accounts()
            
        elif page_id == "quota":
            if page_id not in self.pages:
                self.pages[page_id] = QuotaDetailPage(self.content_area)
            self.refresh_quotas()
            
        elif page_id == "notifications":
            if page_id not in self.pages:
                self.pages[page_id] = NotificationsPage(self.content_area)
            self.pages[page_id].update_notifications(self.notifications_list)
            
        elif page_id == "settings":
            if page_id not in self.pages:
                self.pages[page_id] = SettingsPage(self.content_area, on_save_path=self.handle_save_path)
            path, _ = ProcessManager.get_effective_path()
            self.pages[page_id].path_entry.delete(0, 'end')
            self.pages[page_id].path_entry.insert(0, path or "")

        self.pages[page_id].pack(fill="both", expand=True)

    def handle_switch_account(self, email):
        self.add_notification("Switching Account", f"Setting active session to {email}", "info")
        success, msg = AccountManager.switch_to_account(email)
        if success:
            self.add_notification("Switch Successful", msg, "success")
            self.handle_stop_all() # Stop processes for changes to take effect
            self.refresh_dashboard()
            if self.current_page_id == "accounts": self.refresh_accounts()
        else:
            self.add_notification("Switch Failed", msg, "danger")

    def handle_delete_account(self, email):
        success, msg = AccountManager.delete_account(email)
        if success:
            self.add_notification("Account Deleted", msg, "success")
            self.refresh_accounts()
        else:
            self.add_notification("Error", msg, "danger")

    def handle_import_accounts(self):
        file_path = filedialog.askopenfilename(
            title="Import Accounts",
            filetypes=[("Antigravity Backup", "*.agb"), ("All Files", "*.*")]
        )
        if file_path:
            success, msg = AccountManager.import_accounts(file_path)
            self.add_notification("Import" if success else "Error", msg, "success" if success else "danger")
            if success: self.refresh_accounts()

    def handle_export_accounts(self):
        file_path = filedialog.asksaveasfilename(
            title="Export Accounts",
            defaultextension=".agb",
            filetypes=[("Antigravity Backup", "*.agb")]
        )
        if file_path:
            success, msg = AccountManager.export_accounts(file_path)
            self.add_notification("Export" if success else "Error", msg, "success" if success else "danger")

    def handle_save_account(self):
        success, msg = AccountManager.save_current_account()
        if success:
            self.add_notification("Account Saved", msg, "success")
            if self.current_page_id == "accounts": self.refresh_accounts()
        else:
            self.add_notification("Save Failed", msg, "danger")

    def handle_stop_all(self):
        killed = ProcessManager.kill_all()
        if killed:
            self.add_notification("Processes Stopped", f"Terminated {len(killed)} Antigravity instances.", "success")
        else:
            self.add_notification("Status", "No active processes found.", "info")

    def handle_save_path(self, path):
        if path and pathlib.Path(path).exists():
            set_antigravity_path(path)
            self.add_notification("Settings Saved", "Antigravity path updated.", "success")
        else:
            self.add_notification("Invalid Path", "The specified folder does not exist.", "danger")

    def refresh_dashboard(self):
        email, plan = self.get_current_account_info()
        if "dashboard" in self.pages:
            self.pages["dashboard"].update_session(email, plan)
            self.run_async(self._async_refresh_quotas_dashboard())

    def refresh_accounts(self):
        if "accounts" in self.pages:
            accounts = self.get_accounts_list()
            self.pages["accounts"].update_accounts(accounts)

    async def _async_refresh_quotas_dashboard(self):
        state = self.db.read_key(AGENT_STATE_KEY)
        if state:
            try:
                quota = await QuotaService.get_account_quota(state)
                model_data = [{"model_name": m.model_name, "percentage": m.percentage} for m in quota.models]
                self.after(0, lambda: self.pages["dashboard"].update_quotas(model_data))
            except: pass

    async def _async_refresh_quotas(self):
        accounts = AccountManager.list_accounts(include_state=True)
        updated_quotas = []
        for acc in accounts:
            state = acc.get("state")
            if state:
                try:
                    quota = await QuotaService.get_account_quota(state)
                    for m in quota.models:
                        updated_quotas.append({
                            "model_name": m.model_name,
                            "percentage": m.percentage
                        })
                except: pass
        if "quota" in self.pages:
            self.after(0, lambda: self.pages["quota"].update_quotas(updated_quotas))

    def refresh_quotas(self):
        if "quota" in self.pages:
            self.run_async(self._async_refresh_quotas())

    def add_notification(self, title, message, notif_type="info"):
        notif = {
            "title": title,
            "message": message,
            "type": notif_type,
            "time": datetime.now().strftime("%H:%M:%S")
        }
        self.notifications_list.insert(0, notif)
        self.after(0, self._update_notification_ui)
        
        if notif_type in ["success", "danger"] and self.tray_icon:
            self.tray_icon.notify(message, title)

    def _update_notification_ui(self):
        self.sidebar.update_badge("notifications", len(self.notifications_list))
        if self.current_page_id == "notifications" and "notifications" in self.pages:
            self.pages["notifications"].update_notifications(self.notifications_list)

    def start_refresh_loop(self):
        def loop():
            import time
            while True:
                time.sleep(60)
                self.after(0, self.refresh_dashboard)
                if self.current_page_id == "accounts": self.after(0, self.refresh_accounts)
                if self.current_page_id == "quota": self.after(0, self.refresh_quotas)
        threading.Thread(target=loop, daemon=True).start()

if __name__ == "__main__":
    app = AntigravityApp()
    app.mainloop()
