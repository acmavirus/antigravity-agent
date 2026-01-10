import flet as ft
import asyncio
from app.core.db_handler import DBHandler, AGENT_STATE_KEY
from app.core.process_manager import ProcessManager
from app.core.account_manager import AccountManager
from app.core.auth_handler import AuthHandler
from app.core.config import get_antigravity_path, set_antigravity_path
from app.services.quota_service import QuotaService, AccountQuota, ModelQuota
from app.services.notification_service import NotificationService

def main(page: ft.Page):
    page.title = "Antigravity Agent"
    page.window_width = 900
    page.window_height = 700
    page.theme_mode = ft.ThemeMode.DARK
    page.padding = 20
    page.window_icon = "icon.png" # Trỏ trực tiếp vào file trong assets

    db = DBHandler()
    
    # Components
    account_list = ft.ListView(expand=1, spacing=10, padding=10)
    status_indicator = ft.Container(content=ft.Text("Đã tắt", size=12), bgcolor="grey", border_radius=5, padding=ft.padding.symmetric(horizontal=10, vertical=5))
    current_account_text = ft.Text("Chưa có tài khoản", size=20, weight="bold", color="blue200")
    
    # In-app notification list
    notification_list = ft.ListView(expand=1, spacing=5, padding=5, auto_scroll=True)
    notification_count = ft.Text("0", size=12, color="white")
    
    # Quota data storage
    account_quotas: dict = {}  # email -> AccountQuota
    quota_loading = ft.Text("", size=12, color="grey")
    
    # Path configuration components
    path_input = ft.TextField(
        label="Đường dẫn Antigravity.exe",
        hint_text="VD: D:\\Program Files\\Antigravity\\Antigravity.exe",
        expand=True,
        read_only=False
    )
    path_status = ft.Text("", size=12, color="grey")
    
    def update_path_display():
        """Cập nhật hiển thị đường dẫn hiện tại."""
        effective_path, source = ProcessManager.get_effective_path()
        if effective_path:
            path_input.value = effective_path
            if source == "saved":
                path_status.value = "✅ Đường dẫn đã lưu"
                path_status.color = "green"
            else:
                path_status.value = "🔍 Tự động phát hiện"
                path_status.color = "blue"
        else:
            path_input.value = ""
            path_status.value = "❌ Chưa cấu hình đường dẫn"
            path_status.color = "red"
    
    def handle_save_path(e):
        """Lưu đường dẫn đã nhập."""
        new_path = path_input.value.strip()
        if not new_path:
            page.snack_bar = ft.SnackBar(ft.Text("Vui lòng nhập đường dẫn"), bgcolor="red")
            page.snack_bar.open = True
            page.update()
            return
        
        import pathlib
        if not pathlib.Path(new_path).exists():
            page.snack_bar = ft.SnackBar(ft.Text(f"Đường dẫn không tồn tại: {new_path}"), bgcolor="red")
            page.snack_bar.open = True
            page.update()
            return
        
        set_antigravity_path(new_path)
        page.snack_bar = ft.SnackBar(ft.Text(f"Đã lưu đường dẫn: {new_path}"), bgcolor="green")
        page.snack_bar.open = True
        update_path_display()
        page.update()
    
    def add_notification(title: str, message: str, notif_type: str = "info"):
        """Thêm thông báo vào danh sách trong app."""
        from datetime import datetime
        now = datetime.now().strftime("%H:%M:%S")
        
        # Chọn màu theo loại thông báo
        colors = {
            "info": "blue",
            "success": "green", 
            "warning": "orange",
            "reset": "purple"
        }
        bg_color = colors.get(notif_type, "blue")
        
        notif_card = ft.Container(
            content=ft.Row([
                ft.Icon(ft.Icons.NOTIFICATIONS, color=bg_color, size=20),
                ft.Column([
                    ft.Text(title, size=13, weight="bold", color=bg_color),
                    ft.Text(message, size=11, color="grey300"),
                    ft.Text(now, size=10, color="grey500"),
                ], spacing=2, expand=True),
                ft.IconButton(
                    ft.Icons.CLOSE, 
                    icon_size=14,
                    on_click=lambda e, c=None: remove_notification(e, notif_card)
                )
            ], spacing=10),
            bgcolor="grey900",
            border_radius=8,
            padding=10,
            border=ft.border.all(1, bg_color)
        )
        
        notification_list.controls.insert(0, notif_card)
        notification_count.value = str(len(notification_list.controls))
        
        try:
            page.update()
        except:
            pass
    
    def remove_notification(e, card):
        """Xóa một thông báo."""
        if card in notification_list.controls:
            notification_list.controls.remove(card)
            notification_count.value = str(len(notification_list.controls))
            page.update()
    
    # Đăng ký callback cho NotificationService
    notification_svc = NotificationService.get_instance()
    notification_svc.set_ui_callback(add_notification)

    async def handle_browse_path(e):
        """Mở hộp thoại chọn file."""
        # In Flet 0.80.x, FilePicker is a Service, not a Control
        # Just create and use it directly without adding to overlay
        file_picker = ft.FilePicker()
        
        # pick_files() is async and returns results directly
        result = await file_picker.pick_files(
            dialog_title="Chọn Antigravity.exe",
            allowed_extensions=["exe"],
            allow_multiple=False
        )
        
        if result and len(result) > 0:
            selected_path = result[0].path
            path_input.value = selected_path
            page.update()

    def handle_switch(e, email):
        # Kiểm tra đường dẫn trước khi switch
        effective_path, source = ProcessManager.get_effective_path()
        if not effective_path:
            page.snack_bar = ft.SnackBar(
                ft.Text("⚠️ Không tìm thấy đường dẫn Antigravity. Vui lòng cấu hình trong phần Cài đặt bên dưới."),
                bgcolor="orange",
                duration=5000
            )
            page.snack_bar.open = True
            page.update()
            return
        
        page.snack_bar = ft.SnackBar(ft.Text(f"Đang chuyển sang {email}..."))
        page.snack_bar.open = True
        page.update()
        
        ProcessManager.kill_all()
        success, msg = AccountManager.switch_to_account(email)
        
        if success:
            # Khởi động lại ứng dụng
            start_success, start_msg = ProcessManager.start_app()
            if start_success:
                page.snack_bar = ft.SnackBar(ft.Text(f"✅ {msg}. {start_msg}"), bgcolor="green")
            else:
                page.snack_bar = ft.SnackBar(ft.Text(f"⚠️ {msg}. Nhưng: {start_msg}"), bgcolor="orange")
        else:
            page.snack_bar = ft.SnackBar(ft.Text(f"❌ Lỗi: {msg}"), bgcolor="red")
        
        page.snack_bar.open = True
        refresh_ui()

    def handle_delete(e, email):
        success, msg = AccountManager.delete_account(email)
        page.snack_bar = ft.SnackBar(ft.Text(msg), bgcolor="green" if success else "red")
        page.snack_bar.open = True
        refresh_ui()

    def handle_clear_all(e):
        def close_dlg(e):
            confirm_dlg.open = False
            page.update()

        def confirm_clear(e):
            count, msg = AccountManager.clear_all_accounts()
            page.snack_bar = ft.SnackBar(ft.Text(msg), bgcolor="blue")
            page.snack_bar.open = True
            confirm_dlg.open = False
            refresh_ui()

        confirm_dlg = ft.AlertDialog(
            title=ft.Text("Xác nhận xóa sạch"),
            content=ft.Text("Bạn có chắc chắn muốn xóa tất cả các bản sao lưu tài khoản không?"),
            actions=[
                ft.TextButton("Hủy", on_click=close_dlg),
                ft.TextButton("Xóa tất cả", on_click=confirm_clear, color="red"),
            ],
        )
        page.dialog = confirm_dlg
        confirm_dlg.open = True
        page.update()

    def refresh_ui(e=None):
        # 1. Update Status
        is_running = ProcessManager.is_running()
        status_indicator.content.value = "Đang chạy" if is_running else "Đã tắt"
        status_indicator.bgcolor = "green" if is_running else "grey"
        
        # 2. Update Current Account
        state = db.read_key(AGENT_STATE_KEY)
        if state:
            summary = AuthHandler.get_account_summary(state)
            current_account_text.value = summary["email"]
        else:
            current_account_text.value = "Chưa đăng nhập"

        # 3. Update Account List with Quota info
        accounts = AccountManager.list_accounts()
        account_list.controls.clear()
        for acc in accounts:
            email = acc["email"]
            quota_info = account_quotas.get(email)
            
            # Create quota display widgets
            quota_widgets = []
            if quota_info and quota_info.models:
                for model in quota_info.models:
                    pct = model.percentage
                    progress_color = "red" if pct < 15 else ("orange" if pct < 50 else "green")
                    pct_display = f"{pct:.2f}%"
                    reset_info = model.reset_text
                    
                    quota_widgets.append(
                        ft.Container(
                            content=ft.Column([
                                ft.Row([
                                    ft.Text(model.model_name, size=11, weight="w500"),
                                    ft.Row([
                                        ft.Text(reset_info, size=10, color="grey", italic=True) if reset_info else ft.Container(),
                                        ft.Text(pct_display, size=11, color=progress_color, weight="bold"),
                                    ], spacing=10),
                                ], alignment=ft.MainAxisAlignment.SPACE_BETWEEN),
                                ft.ProgressBar(
                                    value=pct / 100 if pct <= 100 else 1.0,
                                    color=progress_color,
                                    bgcolor="grey800",
                                    height=6,
                                ),
                            ], spacing=2),
                            padding=ft.padding.only(bottom=8),
                        )
                    )
            elif quota_info and quota_info.error:
                quota_widgets.append(ft.Text(f"⚠️ {quota_info.error}", color="orange", size=10))

            # Create subtitle
            subtitle_text = f"Gói: {acc['plan']}"
            
            # Create expandable account card
            account_card = ft.ExpansionTile(
                leading=ft.Icon(ft.Icons.PERSON, color="blue200"),
                title=ft.Text(email, weight="bold"),
                subtitle=ft.Text(subtitle_text, size=12, color="grey"),
                trailing=ft.Row([
                    ft.ElevatedButton("Switch", on_click=lambda e, em=email: handle_switch(e, em), height=32),
                    ft.IconButton(ft.Icons.DELETE_OUTLINE, icon_color="red400", on_click=lambda e, em=email: handle_delete(e, em)),
                ], tight=True, spacing=5),
                controls=[
                    ft.Container(
                        content=ft.Column(
                            quota_widgets if quota_widgets else [
                                ft.Text("Nhấn 'Làm mới Quota' để xem hạn mức", size=12, color="grey", italic=True)
                            ],
                            spacing=5,
                        ),
                        padding=ft.padding.only(left=50, right=20, bottom=10),
                    )
                ],
                expanded=False,
            )
            account_list.controls.append(account_card)
        
        # 4. Update path display
        update_path_display()
        
        page.update()

    def save_current(e):
        success, msg = AccountManager.save_current_account()
        page.snack_bar = ft.SnackBar(ft.Text(msg), bgcolor="green" if success else "red")
        page.snack_bar.open = True
        refresh_ui()
    
    async def refresh_quotas(e):
        """Làm mới quota cho tất cả tài khoản."""
        quota_loading.value = "⏳ Đang tải quota..."
        page.update()
        
        notification_svc = NotificationService.get_instance()
        
        try:
            # Get accounts with state data
            accounts = AccountManager.list_accounts(include_state=True)
            
            # Fetch quotas for all accounts
            for acc in accounts:
                email = acc["email"]
                state = acc.get("state")
                if state:
                    quota = await QuotaService.get_account_quota(state)
                    account_quotas[email] = quota
                    
                    # Lưu thời gian reset để theo dõi thông báo
                    if quota.models:
                        for model in quota.models:
                            if model.reset_text:
                                notification_svc.update_reset_schedule(
                                    email=email,
                                    model_id=model.model_id,
                                    model_name=model.model_name,
                                    reset_time_str=model.reset_text
                                )
            
            # Xóa các lịch cũ đã thông báo
            notification_svc.clear_old_schedules()
            
            pending = len(notification_svc.get_pending_resets())
            quota_loading.value = f"✅ Đã cập nhật quota ({len(accounts)} tài khoản, {pending} lịch reset)"
            quota_loading.color = "green"
        except Exception as ex:
            quota_loading.value = f"❌ Lỗi: {str(ex)}"
            quota_loading.color = "red"
        
        refresh_ui()

    # --- UI Layout Reorganization ---
    
    # 1. Accounts Tab Content
    accounts_view = ft.Column([
        ft.Card(
            content=ft.Container(
                content=ft.Column([
                    ft.Text("Tài khoản hiện tại", size=14, color="grey"),
                    current_account_text,
                    ft.Row([
                        ft.ElevatedButton("Sao lưu tài khoản này", icon=ft.Icons.SAVE, on_click=save_current),
                        ft.OutlinedButton("Tắt Antigravity", icon=ft.Icons.STOP, on_click=lambda _: [ProcessManager.kill_all(), refresh_ui()])
                    ])
                ]),
                padding=15
            )
        ),
        ft.Row([
            ft.Text("Danh sách tài khoản", size=16, weight="bold", expand=True),
            ft.ElevatedButton("Làm mới Quota", icon=ft.Icons.ANALYTICS, on_click=refresh_quotas, height=35),
            ft.TextButton("Xóa tất cả", icon=ft.Icons.DELETE_SWEEP, icon_color="red400", on_click=handle_clear_all)
        ], spacing=10),
        quota_loading,
        account_list,
    ], expand=True)

    # 2. Settings Tab Content
    settings_view = ft.Column([
        ft.Card(
            content=ft.Container(
                content=ft.Column([
                    ft.Row([
                        ft.Icon(ft.Icons.SETTINGS, color="blue200"),
                        ft.Text("Cấu hình hệ thống", size=18, weight="bold"),
                    ]),
                    ft.Divider(),
                    ft.Text("Đường dẫn ứng dụng Antigravity", size=14, weight="500"),
                    ft.Text("Cần thiết để tự động khởi động lại ứng dụng khi chuyển tài khoản", size=12, color="grey"),
                    ft.Row([
                        path_input,
                        ft.IconButton(ft.Icons.FOLDER_OPEN, tooltip="Chọn file", on_click=handle_browse_path),
                        ft.ElevatedButton("Lưu đường dẫn", icon=ft.Icons.SAVE, on_click=handle_save_path),
                    ]),
                    path_status,
                ]),
                padding=20
            )
        ),
        ft.Card(
            content=ft.Container(
                content=ft.Column([
                    ft.Text("Thông tin phiên bản", size=14, weight="bold"),
                    ft.Text("Antigravity Agent v2.0 (Python Rebuild)", size=12),
                    ft.Text("Hỗ trợ: Real-time Quota, GMT+7 Timezone", size=12, color="grey"),
                ]),
                padding=20
            )
        ),
        ft.Card(
            content=ft.Container(
                content=ft.Column([
                    ft.Row([
                        ft.Icon(ft.Icons.ROCKET_LAUNCH, color="orange"),
                        ft.Text("Preheat tất cả Model", size=14, weight="bold"),
                    ]),
                    ft.Text("Gửi tin nhắn 'Hi' đến tất cả model để bắt đầu chu kỳ quota ngay lập tức.", size=12, color="grey"),
                    preheat_status := ft.Text("", size=12, color="grey"),
                    ft.ElevatedButton(
                        "🔥 Preheat Ngay", 
                        icon=ft.Icons.FLASH_ON,
                        on_click=lambda e: trigger_preheat_all(e),
                        bgcolor="orange",
                        color="white"
                    ),
                ]),
                padding=20
            )
        )
    ])
    
    async def do_preheat_all():
        """Thực hiện preheat cho tất cả model."""
        accounts = AccountManager.list_accounts(include_state=True)
        if not accounts:
            add_notification("Lỗi Preheat", "Không có tài khoản nào!", "warning")
            return
        
        total_success = 0
        total_failed = 0
        
        for acc in accounts:
            email = acc.get("email", "Unknown")
            state = acc.get("state")
            if not state:
                continue
            
            add_notification("Đang Preheat", f"Tài khoản: {email}", "info")
            
            # Preheat cho từng model
            for model_id, model_name in QuotaService.TARGET_MODELS.items():
                try:
                    success = await QuotaService.trigger_model_preheat_by_state(state, model_id)
                    if success:
                        total_success += 1
                        add_notification("Preheat OK", f"{model_name} - {email}", "success")
                    else:
                        total_failed += 1
                except Exception as ex:
                    total_failed += 1
                    print(f"Preheat error: {ex}")
        
        add_notification(
            "Preheat Hoàn tất", 
            f"Thành công: {total_success}, Thất bại: {total_failed}",
            "success" if total_failed == 0 else "warning"
        )
    
    def trigger_preheat_all(e):
        """Trigger preheat từ nút bấm."""
        import asyncio
        
        preheat_status.value = "⏳ Đang thực hiện preheat..."
        page.update()
        
        # Chạy async trong thread riêng
        def run_async():
            loop = asyncio.new_event_loop()
            asyncio.set_event_loop(loop)
            loop.run_until_complete(do_preheat_all())
            loop.close()
            
            preheat_status.value = "✅ Hoàn tất!"
            try:
                page.update()
            except:
                pass
        
        import threading
        threading.Thread(target=run_async, daemon=True).start()
        
        page.snack_bar = ft.SnackBar(ft.Text("Đang preheat tất cả model... Kiểm tra tab Thông báo."), bgcolor="orange")
        page.snack_bar.open = True
        page.update()

    # --- Content Container ---
    content_container = ft.Container(content=accounts_view, expand=True)

    def switch_tab(tab_index):
        # Reset all button styles
        btn_accounts.style = ft.ButtonStyle(color="grey", bgcolor="transparent")
        btn_settings.style = ft.ButtonStyle(color="grey", bgcolor="transparent")
        btn_notifications.style = ft.ButtonStyle(color="grey", bgcolor="transparent")
        
        if tab_index == 0:
            content_container.content = accounts_view
            btn_accounts.style = ft.ButtonStyle(color="blue200", bgcolor="grey900")
        elif tab_index == 1:
            content_container.content = settings_view
            btn_settings.style = ft.ButtonStyle(color="blue200", bgcolor="grey900")
        else:
            content_container.content = notifications_view
            btn_notifications.style = ft.ButtonStyle(color="blue200", bgcolor="grey900")
        page.update()

    # --- Custom Tab Buttons ---
    btn_accounts = ft.TextButton(
        content=ft.Row([ft.Icon(ft.Icons.PEOPLE_OUTLINE, size=16), ft.Text("Tài khoản", size=13)], spacing=8),
        style=ft.ButtonStyle(color="blue200", bgcolor="grey900"),
        on_click=lambda _: switch_tab(0),
        width=130,
        height=35
    )
    
    btn_settings = ft.TextButton(
        content=ft.Row([ft.Icon(ft.Icons.SETTINGS_OUTLINED, size=16), ft.Text("Cài đặt", size=13)], spacing=8),
        style=ft.ButtonStyle(color="grey", bgcolor="transparent"),
        on_click=lambda _: switch_tab(1),
        width=130,
        height=35
    )
    
    btn_notifications = ft.TextButton(
        content=ft.Row([
            ft.Icon(ft.Icons.NOTIFICATIONS_OUTLINED, size=16), 
            ft.Text("Thông báo", size=13),
            ft.Container(
                content=notification_count,
                bgcolor="red",
                border_radius=10,
                padding=ft.padding.symmetric(horizontal=6, vertical=2)
            )
        ], spacing=6),
        style=ft.ButtonStyle(color="grey", bgcolor="transparent"),
        on_click=lambda _: switch_tab(2),
        width=150,
        height=35
    )
    
    # Notifications View
    notifications_view = ft.Column([
        ft.Card(
            content=ft.Container(
                content=ft.Column([
                    ft.Row([
                        ft.Icon(ft.Icons.NOTIFICATIONS_ACTIVE, color="purple"),
                        ft.Text("Lịch sử thông báo", size=16, weight="bold"),
                        ft.Container(expand=True),
                        ft.TextButton("Xóa tất cả", icon=ft.Icons.DELETE_SWEEP, 
                                      on_click=lambda e: clear_all_notifications())
                    ]),
                    ft.Divider(),
                    ft.Container(
                        content=notification_list,
                        height=400,
                        border=ft.border.all(1, "grey800"),
                        border_radius=8
                    )
                ]),
                padding=15
            )
        )
    ])
    
    def clear_all_notifications():
        notification_list.controls.clear()
        notification_count.value = "0"
        page.update()

    tab_row = ft.Container(
        content=ft.Row([btn_accounts, btn_settings, btn_notifications], spacing=0),
        bgcolor="black",
        border_radius=8,
        padding=2
    )

    page.add(
        ft.Row([
            ft.Image(src="icon.png", width=30, height=30, border_radius=5), 
            ft.Text("Antigravity Agent", size=20, weight="bold"),
            ft.VerticalDivider(width=20, color="transparent"), # Khoảng cách nhỏ
            tab_row,
            ft.Container(expand=True), # Đẩy các phần tử còn lại sang phải
            status_indicator,
            ft.IconButton(ft.Icons.REFRESH, on_click=refresh_ui, tooltip="Làm mới trạng thái", icon_size=18)
        ], vertical_alignment=ft.CrossAxisAlignment.CENTER),
        ft.Divider(height=1, color="grey700"),
        content_container
    )
    
    refresh_ui()
    
    # Khởi động monitor thông báo reset
    notification_svc = NotificationService.get_instance()
    notification_svc.start_monitor(interval_seconds=60)  # Kiểm tra mỗi 60 giây

if __name__ == "__main__":
    ft.app(target=main)

