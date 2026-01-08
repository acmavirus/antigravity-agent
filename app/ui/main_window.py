import flet as ft
import asyncio
from app.core.db_handler import DBHandler, AGENT_STATE_KEY
from app.core.process_manager import ProcessManager
from app.core.account_manager import AccountManager
from app.core.auth_handler import AuthHandler
from app.core.config import get_antigravity_path, set_antigravity_path
from app.services.quota_service import QuotaService, AccountQuota, ModelQuota

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
            
            quota_loading.value = f"✅ Đã cập nhật quota ({len(accounts)} tài khoản)"
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
        )
    ])

    # --- Content Container ---
    content_container = ft.Container(content=accounts_view, expand=True)

    def handle_tab_change(e):
        selected = list(e.control.selected)[0]
        if selected == 0:
            content_container.content = accounts_view
        else:
            content_container.content = settings_view
        page.update()

    # --- Tab Selection (SegmentedButton) ---
    tab_switcher = ft.SegmentedButton(
        selected=[0],
        on_change=handle_tab_change,
        allow_empty_selection=False,
        allow_multiple_selection=False,
        segments=[
            ft.Segment(
                value=0,
                label=ft.Text("Tài khoản"),
                icon=ft.Icon(ft.Icons.PEOPLE_OUTLINE),
            ),
            ft.Segment(
                value=1,
                label=ft.Text("Cài đặt"),
                icon=ft.Icon(ft.Icons.SETTINGS_OUTLINED),
            ),
        ],
    )

    page.add(
        ft.Row([
            ft.Image(src="/icon.png", width=35, height=35, border_radius=5), 
            ft.Text("Antigravity Agent", size=24, weight="bold", expand=True),
            status_indicator,
            ft.IconButton(ft.Icons.REFRESH, on_click=refresh_ui, tooltip="Làm mới trạng thái")
        ]),
        ft.Divider(height=1, color="grey700"),
        ft.Container(content=tab_switcher, margin=ft.margin.only(bottom=10)),
        content_container
    )
    
    refresh_ui()

if __name__ == "__main__":
    ft.app(target=main)

