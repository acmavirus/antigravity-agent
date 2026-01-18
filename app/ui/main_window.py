"""
Antigravity Agent - Main Window
Modern UI with sidebar navigation and page-based layout
"""
import flet as ft
import asyncio
import threading
from typing import Optional

# Theme and components
from app.ui.theme import ThemeManager, Spacing, Typography, AnimationDuration

# Components
from app.ui.components.sidebar import Sidebar, NavItem
from app.ui.components.toast import ToastManager
from app.ui.components.dialogs import ConfirmDialog, LoadingOverlay

# Pages
from app.ui.pages.dashboard import DashboardPage
from app.ui.pages.accounts import AccountsPage
from app.ui.pages.quota_detail import QuotaDetailPage
from app.ui.pages.notifications import NotificationsPage
from app.ui.pages.settings import SettingsPage

# Core services
from app.core.db_handler import DBHandler, AGENT_STATE_KEY
from app.core.process_manager import ProcessManager
from app.core.account_manager import AccountManager
from app.core.auth_handler import AuthHandler
from app.core.config import get_antigravity_path, set_antigravity_path
from app.services.quota_service import QuotaService, AccountQuota, ModelQuota
from app.services.notification_service import NotificationService


def main(page: ft.Page):
    """Main application entry point."""
    
    # === Page Configuration ===
    page.title = "Antigravity Agent"
    page.window.width = 1100
    page.window.height = 750
    page.window.min_width = 900
    page.window.min_height = 600
    page.theme_mode = ft.ThemeMode.DARK
    page.padding = 0
    page.bgcolor = "#0d1117"
    
    # Try to set window icon
    try:
        page.window.icon = "icon.png"
    except:
        pass
    
    # === Initialize Services ===
    tm = ThemeManager.get_instance()
    tm.set_page(page)
    
    db = DBHandler()
    toast_manager = ToastManager.get_instance(page)
    notification_svc = NotificationService.get_instance()
    
    # === State Variables ===
    current_page_id = "dashboard"
    account_quotas: dict = {}  # email -> AccountQuota
    notifications_list: list = []
    loading_overlay = LoadingOverlay(theme=tm)
    
    # === Toast Container ===
    toast_container = ft.Column(
        controls=[],
        spacing=Spacing.SM,
        scroll=ft.ScrollMode.AUTO
    )
    toast_manager.set_container(toast_container)
    
    # === Notification Callback ===
    def add_notification(title: str, message: str, notif_type: str = "info"):
        """Add notification to the list and show toast."""
        from datetime import datetime
        notifications_list.insert(0, {
            "id": f"notif_{len(notifications_list)}",
            "title": title,
            "message": message,
            "type": notif_type,
            "timestamp": datetime.now()
        })
        
        # Show toast
        toast_manager.show(title, message, notif_type, duration=5000)
        
        # Update sidebar badge
        update_sidebar_badges()
        
        # Update notifications page if visible
        if current_page_id == "notifications" and notifications_page:
            notifications_page.update_notifications(notifications_list)
    
    notification_svc.set_ui_callback(add_notification)
    
    # === Helper Functions ===
    def get_current_account_info() -> tuple:
        """Get current account email and plan."""
        state = db.read_key(AGENT_STATE_KEY)
        if state:
            summary = AuthHandler.get_account_summary(state)
            return summary.get("email", "Chưa đăng nhập"), summary.get("plan", "Unknown")
        return "Chưa đăng nhập", "Unknown"
    
    def get_accounts_list(include_quota: bool = False) -> list:
        """Get list of saved accounts with optional quota data."""
        accounts = AccountManager.list_accounts(include_state=True)
        current_email, _ = get_current_account_info()
        
        result = []
        for acc in accounts:
            email = acc.get("email", "Unknown")
            quota_data = account_quotas.get(email)
            
            result.append({
                "email": email,
                "plan": acc.get("plan", "Unknown"),
                "is_active": email == current_email,
                "quota_data": quota_data.models if quota_data else []
            })
        
        return result
    
    def update_sidebar_badges():
        """Update notification badge on sidebar."""
        unread_count = len(notifications_list)
        sidebar.update_badge("notifications", unread_count)
    
    # === Page Instances ===
    dashboard_page: Optional[DashboardPage] = None
    accounts_page: Optional[AccountsPage] = None
    quota_page: Optional[QuotaDetailPage] = None
    notifications_page: Optional[NotificationsPage] = None
    settings_page: Optional[SettingsPage] = None
    
    # === Page Builders ===
    def build_dashboard() -> DashboardPage:
        """Build the dashboard page."""
        current_email, current_plan = get_current_account_info()
        is_running = ProcessManager.is_running()
        accounts = get_accounts_list()
        
        # Get current account quota
        quota_data = []
        if current_email in account_quotas:
            quota_data = [{
                "model_name": m.model_name,
                "percentage": m.percentage,
                "reset_text": m.reset_text
            } for m in account_quotas[current_email].models]
        
        return DashboardPage(
            current_email=current_email,
            current_plan=current_plan,
            is_running=is_running,
            total_accounts=len(accounts),
            quota_data=quota_data,
            on_save_account=handle_save_account,
            on_stop_app=handle_stop_app,
            on_refresh_quota=handle_refresh_quotas,
            on_switch_to_accounts=lambda: handle_nav_change("accounts"),
            theme=tm
        )
    
    def build_accounts() -> AccountsPage:
        """Build the accounts page."""
        accounts = get_accounts_list(include_quota=True)
        
        return AccountsPage(
            accounts=accounts,
            on_switch=handle_switch_account,
            on_delete=handle_delete_account,
            on_refresh=handle_refresh_single_quota,
            on_refresh_all=handle_refresh_quotas,
            on_clear_all=handle_clear_all,
            on_save_current=handle_save_account,
            theme=tm
        )
    
    def build_quota() -> QuotaDetailPage:
        """Build the quota detail page."""
        accounts_quota = {}
        for email, quota in account_quotas.items():
            if quota.models:
                accounts_quota[email] = quota.models
        
        return QuotaDetailPage(
            accounts_quota=accounts_quota,
            on_preheat=handle_preheat_model,
            on_refresh=handle_refresh_quotas,
            theme=tm
        )
    
    def build_notifications() -> NotificationsPage:
        """Build the notifications page."""
        return NotificationsPage(
            notifications=notifications_list,
            on_clear_all=lambda: notifications_list.clear(),
            theme=tm
        )
    
    def build_settings() -> SettingsPage:
        """Build the settings page."""
        effective_path, path_source = ProcessManager.get_effective_path()
        
        return SettingsPage(
            antigravity_path=effective_path or "",
            path_source=path_source,
            on_save_path=handle_save_path,
            on_browse_path=handle_browse_path,
            on_preheat_all=handle_preheat_all,
            on_test_notification=handle_test_notification,
            theme=tm
        )
    
    # === Event Handlers ===
    def handle_nav_change(page_id: str):
        """Handle sidebar navigation change."""
        nonlocal current_page_id, dashboard_page, accounts_page, quota_page, notifications_page, settings_page
        
        current_page_id = page_id
        
        # Build and show appropriate page
        if page_id == "dashboard":
            dashboard_page = build_dashboard()
            content_container.content = dashboard_page
        elif page_id == "accounts":
            accounts_page = build_accounts()
            content_container.content = accounts_page
        elif page_id == "quota":
            quota_page = build_quota()
            content_container.content = quota_page
        elif page_id == "notifications":
            notifications_page = build_notifications()
            content_container.content = notifications_page
        elif page_id == "settings":
            settings_page = build_settings()
            content_container.content = settings_page
        
        page.update()
    
    def handle_save_account():
        """Handle save current account."""
        success, msg = AccountManager.save_current_account()
        if success:
            toast_manager.success("Đã lưu", msg)
        else:
            toast_manager.danger("Lỗi", msg)
        refresh_current_page()
    
    def handle_stop_app():
        """Handle stop Antigravity app."""
        killed = ProcessManager.kill_all()
        if killed:
            toast_manager.success("Đã dừng", f"Đã tắt {len(killed)} tiến trình")
        else:
            toast_manager.info("Thông báo", "Không có tiến trình nào đang chạy")
        refresh_current_page()
    
    def handle_switch_account(email: str):
        """Handle switch to account."""
        # Check path first
        effective_path, _ = ProcessManager.get_effective_path()
        if not effective_path:
            toast_manager.warning(
                "Cấu hình thiếu",
                "Vui lòng cấu hình đường dẫn Antigravity trong Cài đặt"
            )
            return
        
        toast_manager.info("Đang chuyển", f"Đang chuyển sang {email}...")
        
        # Kill current processes
        ProcessManager.kill_all()
        
        # Switch account
        success, msg = AccountManager.switch_to_account(email)
        
        if success:
            # Start app
            start_success, start_msg = ProcessManager.start_app()
            if start_success:
                toast_manager.success("Thành công", f"{msg}. {start_msg}")
            else:
                toast_manager.warning("Chuyển thành công", f"{msg}. Nhưng: {start_msg}")
        else:
            toast_manager.danger("Lỗi", msg)
        
        refresh_current_page()
    
    def handle_delete_account(email: str):
        """Handle delete account."""
        def confirm_delete():
            success, msg = AccountManager.delete_account(email)
            if success:
                toast_manager.success("Đã xóa", msg)
            else:
                toast_manager.danger("Lỗi", msg)
            refresh_current_page()
        
        dialog = ConfirmDialog(
            title="Xóa tài khoản",
            message=f"Bạn có chắc chắn muốn xóa tài khoản {email}?",
            confirm_text="Xóa",
            on_confirm=confirm_delete,
            danger=True,
            theme=tm
        )
        page.overlay.append(dialog)
        dialog.open = True
        page.update()
    
    def handle_clear_all():
        """Handle clear all accounts."""
        def confirm_clear():
            count, msg = AccountManager.clear_all_accounts()
            toast_manager.info("Đã xóa", msg)
            refresh_current_page()
        
        dialog = ConfirmDialog(
            title="Xóa tất cả",
            message="Bạn có chắc chắn muốn xóa tất cả tài khoản đã lưu?",
            confirm_text="Xóa tất cả",
            on_confirm=confirm_clear,
            danger=True,
            theme=tm
        )
        page.overlay.append(dialog)
        dialog.open = True
        page.update()
    
    def handle_refresh_quotas():
        """Handle refresh all quotas."""
        async def do_refresh():
            nonlocal account_quotas
            
            toast_manager.info("Đang tải", "Đang làm mới quota...")
            
            accounts = AccountManager.list_accounts(include_state=True)
            
            for acc in accounts:
                email = acc.get("email")
                state = acc.get("state")
                if state:
                    try:
                        quota = await QuotaService.get_account_quota(state)
                        account_quotas[email] = quota
                        
                        # Update reset schedules
                        if quota.models:
                            for model in quota.models:
                                if model.reset_text:
                                    notification_svc.update_reset_schedule(
                                        email=email,
                                        model_id=model.model_id,
                                        model_name=model.model_name,
                                        reset_time_str=model.reset_text
                                    )
                    except Exception as e:
                        print(f"Error fetching quota for {email}: {e}")
            
            notification_svc.clear_old_schedules()
            
            toast_manager.success("Hoàn tất", f"Đã cập nhật quota cho {len(accounts)} tài khoản")
            refresh_current_page()
        
        # Run async in thread
        def run_async():
            loop = asyncio.new_event_loop()
            asyncio.set_event_loop(loop)
            loop.run_until_complete(do_refresh())
            loop.close()
        
        threading.Thread(target=run_async, daemon=True).start()
    
    def handle_refresh_single_quota(email: str):
        """Handle refresh quota for single account."""
        async def do_refresh():
            accounts = AccountManager.list_accounts(include_state=True)
            target = next((a for a in accounts if a.get("email") == email), None)
            
            if target and target.get("state"):
                try:
                    quota = await QuotaService.get_account_quota(target["state"])
                    account_quotas[email] = quota
                    toast_manager.success("Cập nhật", f"Đã cập nhật quota cho {email}")
                except Exception as e:
                    toast_manager.danger("Lỗi", str(e))
            
            refresh_current_page()
        
        def run_async():
            loop = asyncio.new_event_loop()
            asyncio.set_event_loop(loop)
            loop.run_until_complete(do_refresh())
            loop.close()
        
        threading.Thread(target=run_async, daemon=True).start()
    
    def handle_preheat_model(email: str, model_id: str):
        """Handle preheat single model."""
        async def do_preheat():
            accounts = AccountManager.list_accounts(include_state=True)
            target = next((a for a in accounts if a.get("email") == email), None)
            
            if target and target.get("state"):
                success = await QuotaService.trigger_model_preheat_by_state(target["state"], model_id)
                if success:
                    toast_manager.success("Preheat OK", f"Đã preheat {model_id}")
                else:
                    toast_manager.warning("Thất bại", f"Không thể preheat {model_id}")
        
        def run_async():
            loop = asyncio.new_event_loop()
            asyncio.set_event_loop(loop)
            loop.run_until_complete(do_preheat())
            loop.close()
        
        threading.Thread(target=run_async, daemon=True).start()
    
    def handle_preheat_all():
        """Handle preheat all models for all accounts."""
        async def do_preheat_all():
            accounts = AccountManager.list_accounts(include_state=True)
            total_success = 0
            total_failed = 0
            
            for acc in accounts:
                email = acc.get("email", "Unknown")
                state = acc.get("state")
                if not state:
                    continue
                
                add_notification("Đang Preheat", f"Tài khoản: {email}", "info")
                
                for model_id, model_name in QuotaService.TARGET_MODELS.items():
                    try:
                        success = await QuotaService.trigger_model_preheat_by_state(state, model_id)
                        if success:
                            total_success += 1
                        else:
                            total_failed += 1
                    except:
                        total_failed += 1
            
            add_notification(
                "Preheat hoàn tất",
                f"Thành công: {total_success}, Thất bại: {total_failed}",
                "success" if total_failed == 0 else "warning"
            )
        
        def run_async():
            loop = asyncio.new_event_loop()
            asyncio.set_event_loop(loop)
            loop.run_until_complete(do_preheat_all())
            loop.close()
        
        toast_manager.info("Đang preheat", "Đang preheat tất cả models...")
        threading.Thread(target=run_async, daemon=True).start()
    
    def handle_test_notification():
        """Handle test notification button."""
        # Get current account for testing
        current_email, _ = get_current_account_info()
        
        if current_email == "Chưa đăng nhập":
            toast_manager.warning("Lỗi", "Vui lòng đăng nhập trước khi test")
            return
        
        # Call the notification service test method
        notification_svc.test_notification(
            email=current_email,
            model_id="gemini-2.0-flash-exp",
            model_name="Gemini 2.0 Flash (TEST)"
        )
        
        toast_manager.success("Test", "Đã gửi thông báo test! Kiểm tra tab Thông báo.")
    
    def handle_save_path(path: str):
        """Handle save Antigravity path."""
        import pathlib
        if not path:
            toast_manager.warning("Lỗi", "Vui lòng nhập đường dẫn")
            return
        
        if not pathlib.Path(path).exists():
            toast_manager.danger("Lỗi", f"Đường dẫn không tồn tại: {path}")
            return
        
        set_antigravity_path(path)
        toast_manager.success("Đã lưu", f"Đường dẫn: {path}")
        
        if settings_page:
            settings_page.update_path(path, "saved")
    
    async def handle_browse_path():
        """Handle browse for path."""
        file_picker = ft.FilePicker()
        result = await file_picker.pick_files(
            dialog_title="Chọn Antigravity.exe",
            allowed_extensions=["exe"],
            allow_multiple=False
        )
        
        if result and len(result) > 0:
            selected_path = result[0].path
            if settings_page:
                settings_page.path_input.value = selected_path
                settings_page.update()
    
    def refresh_current_page():
        """Refresh the current page."""
        handle_nav_change(current_page_id)
    
    # === Build Navigation Items ===
    nav_items = [
        NavItem(ft.Icons.DASHBOARD_OUTLINED, "Dashboard", "dashboard", ft.Icons.DASHBOARD),
        NavItem(ft.Icons.PEOPLE_OUTLINE, "Tài khoản", "accounts", ft.Icons.PEOPLE),
        NavItem(ft.Icons.ANALYTICS_OUTLINED, "Quota", "quota", ft.Icons.ANALYTICS),
        NavItem(ft.Icons.NOTIFICATIONS_OUTLINED, "Thông báo", "notifications", ft.Icons.NOTIFICATIONS, badge_count=0),
        NavItem(ft.Icons.SETTINGS_OUTLINED, "Cài đặt", "settings", ft.Icons.SETTINGS),
    ]
    
    # === Build Sidebar ===
    sidebar = Sidebar(
        nav_items=nav_items,
        on_nav_change=handle_nav_change,
        selected_index=0,
        theme=tm
    )
    
    # === Content Container ===
    content_container = ft.Container(
        content=None,
        expand=True,
        bgcolor=tm.colors.background
    )
    
    # === Toast Overlay Container ===
    toast_overlay = ft.Container(
        content=toast_container,
        right=20,
        top=20,
        width=350,
    )
    
    # === Main Layout ===
    main_layout = ft.Stack(
        controls=[
            ft.Row([
                sidebar,
                content_container
            ], spacing=0, expand=True, vertical_alignment=ft.CrossAxisAlignment.START),
            toast_overlay,
            loading_overlay
        ],
        expand=True
    )
    
    page.add(main_layout)
    
    # === Theme Change Handler ===
    def on_theme_change():
        """Handle theme change - rebuild all UI components."""
        nonlocal sidebar
        # Update content container background
        content_container.bgcolor = tm.colors.background
        # Rebuild sidebar
        sidebar._build()
        sidebar.update()
        # Rebuild current page
        refresh_current_page()
    
    # Register theme change callback
    tm.add_theme_change_callback(on_theme_change)
    
    # === Initialize ===
    # Build initial page
    dashboard_page = build_dashboard()
    content_container.content = dashboard_page
    page.update()
    
    # Start notification monitor
    notification_svc.start_monitor(interval_seconds=30)
    
    # === Keyboard Shortcuts ===
    def handle_keyboard(e: ft.KeyboardEvent):
        if e.ctrl:
            if e.key == "1":
                handle_nav_change("dashboard")
                sidebar.set_selected(0)
            elif e.key == "2":
                handle_nav_change("accounts")
                sidebar.set_selected(1)
            elif e.key == "3":
                handle_nav_change("quota")
                sidebar.set_selected(2)
            elif e.key == "4":
                handle_nav_change("notifications")
                sidebar.set_selected(3)
            elif e.key == "5":
                handle_nav_change("settings")
                sidebar.set_selected(4)
            elif e.key == "R":
                handle_refresh_quotas()
            elif e.key == "S":
                handle_save_account()
    
    page.on_keyboard_event = handle_keyboard


if __name__ == "__main__":
    ft.app(target=main, assets_dir="assets")
