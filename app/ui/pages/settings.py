"""
Settings Page
Application settings and configuration
"""
import flet as ft
from typing import Callable, Optional
from app.ui.theme import ThemeManager, Spacing, Typography, AnimationDuration
from app.ui.components.dialogs import ConfirmDialog


class SettingsPage(ft.Container):
    """Settings page with configuration options."""
    
    def __init__(
        self,
        antigravity_path: str = "",
        path_source: str = "none",  # saved, detected, none
        auto_sync_enabled: bool = False,
        auto_sync_interval: int = 5,
        on_save_path: Callable[[str], None] = None,
        on_browse_path: Callable = None,
        on_toggle_auto_sync: Callable[[bool], None] = None,
        on_change_interval: Callable[[int], None] = None,
        on_preheat_all: Callable = None,
        theme: ThemeManager = None
    ):
        super().__init__()
        
        self.antigravity_path = antigravity_path
        self.path_source = path_source
        self.auto_sync_enabled = auto_sync_enabled
        self.auto_sync_interval = auto_sync_interval
        self.on_save_path = on_save_path
        self.on_browse_path = on_browse_path
        self.on_toggle_auto_sync = on_toggle_auto_sync
        self.on_change_interval = on_change_interval
        self.on_preheat_all = on_preheat_all
        self.tm = theme or ThemeManager.get_instance()
        
        self._build()
    
    def _build(self):
        """Build the settings page."""
        colors = self.tm.colors
        
        # Header
        header = ft.Column([
            ft.Text(
                "Cài đặt",
                size=Typography.DISPLAY,
                weight=Typography.BOLD,
                color=colors.text_primary
            ),
            ft.Text(
                "Cấu hình ứng dụng và tùy chọn",
                size=Typography.BODY,
                color=colors.text_secondary
            )
        ], spacing=Spacing.XS)
        
        # Path configuration section
        path_section = self._build_path_section()
        
        # Auto-sync section
        sync_section = self._build_sync_section()
        
        # Preheat section
        preheat_section = self._build_preheat_section()
        
        # Theme section
        theme_section = self._build_theme_section()
        
        # About section
        about_section = self._build_about_section()
        
        # Main layout
        self.content = ft.ListView(
            controls=[
                header,
                ft.Container(height=Spacing.XL),
                path_section,
                ft.Container(height=Spacing.LG),
                sync_section,
                ft.Container(height=Spacing.LG),
                preheat_section,
                ft.Container(height=Spacing.LG),
                theme_section,
                ft.Container(height=Spacing.LG),
                about_section
            ],
            spacing=0,
            expand=True
        )
        
        self.expand = True
        self.padding = Spacing.XL
    
    def _build_section_card(self, title: str, icon: str, content: ft.Control) -> ft.Container:
        """Build a settings section card."""
        colors = self.tm.colors
        
        return ft.Container(
            content=ft.Column([
                ft.Row([
                    ft.Icon(icon, color=colors.primary, size=24),
                    ft.Text(title, size=Typography.SUBTITLE, weight=Typography.SEMI_BOLD, color=colors.text_primary)
                ], spacing=Spacing.MD),
                ft.Divider(height=1, color=colors.divider),
                content
            ], spacing=Spacing.MD),
            bgcolor=colors.card,
            border=ft.border.all(1, colors.border),
            border_radius=Spacing.RADIUS_LG,
            padding=Spacing.LG
        )
    
    def _build_path_section(self) -> ft.Container:
        """Build path configuration section."""
        colors = self.tm.colors
        
        # Path status
        if self.path_source == "saved":
            status_icon = ft.Icons.CHECK_CIRCLE
            status_color = colors.success
            status_text = "Đường dẫn đã lưu"
        elif self.path_source == "detected":
            status_icon = ft.Icons.SEARCH
            status_color = colors.info
            status_text = "Tự động phát hiện"
        else:
            status_icon = ft.Icons.ERROR
            status_color = colors.danger
            status_text = "Chưa cấu hình"
        
        # Path input
        self.path_input = ft.TextField(
            value=self.antigravity_path,
            label="Đường dẫn Antigravity.exe",
            hint_text="VD: D:\\Program Files\\Antigravity\\Antigravity.exe",
            border_color=colors.border,
            focused_border_color=colors.primary,
            text_style=ft.TextStyle(color=colors.text_primary),
            label_style=ft.TextStyle(color=colors.text_secondary),
            expand=True
        )
        
        content = ft.Column([
            ft.Text(
                "Cần thiết để tự động khởi động lại ứng dụng khi chuyển tài khoản",
                size=Typography.CAPTION,
                color=colors.text_muted
            ),
            ft.Row([
                self.path_input,
                ft.IconButton(
                    icon=ft.Icons.FOLDER_OPEN,
                    icon_color=colors.primary,
                    tooltip="Chọn file",
                    on_click=lambda e: self.on_browse_path() if self.on_browse_path else None
                ),
                ft.ElevatedButton(
                    "Lưu",
                    icon=ft.Icons.SAVE,
                    bgcolor=colors.primary,
                    color=colors.on_primary,
                    on_click=lambda e: self._handle_save_path()
                )
            ], spacing=Spacing.SM),
            ft.Row([
                ft.Icon(status_icon, color=status_color, size=16),
                ft.Text(status_text, size=Typography.CAPTION, color=status_color)
            ], spacing=Spacing.XS)
        ], spacing=Spacing.MD)
        
        return self._build_section_card("Đường dẫn ứng dụng", ft.Icons.FOLDER, content)
    
    def _build_sync_section(self) -> ft.Container:
        """Build auto-sync configuration section."""
        colors = self.tm.colors
        
        content = ft.Column([
            ft.Row([
                ft.Column([
                    ft.Text("Tự động đồng bộ", size=Typography.BODY, color=colors.text_primary),
                    ft.Text("Cập nhật quota định kỳ", size=Typography.CAPTION, color=colors.text_muted)
                ], spacing=0, expand=True),
                ft.Switch(
                    value=self.auto_sync_enabled,
                    active_color=colors.primary,
                    on_change=lambda e: self._handle_toggle_sync(e)
                )
            ]),
            ft.Row([
                ft.Text("Chu kỳ cập nhật:", size=Typography.BODY, color=colors.text_secondary),
                ft.Dropdown(
                    value=str(self.auto_sync_interval),
                    options=[
                        ft.dropdown.Option("1", "1 phút"),
                        ft.dropdown.Option("5", "5 phút"),
                        ft.dropdown.Option("10", "10 phút"),
                        ft.dropdown.Option("30", "30 phút"),
                    ],
                    width=150,
                    border_color=colors.border,
                    focused_border_color=colors.primary,
                    on_change=lambda e: self._handle_change_interval(e),
                    disabled=not self.auto_sync_enabled
                )
            ], spacing=Spacing.MD)
        ], spacing=Spacing.LG)
        
        return self._build_section_card("Đồng bộ tự động", ft.Icons.SYNC, content)
    
    def _build_preheat_section(self) -> ft.Container:
        """Build preheat section."""
        colors = self.tm.colors
        
        content = ft.Column([
            ft.Text(
                "Gửi tin nhắn 'Hi' đến tất cả model để bắt đầu chu kỳ quota ngay lập tức",
                size=Typography.CAPTION,
                color=colors.text_muted
            ),
            ft.ElevatedButton(
                "🔥 Preheat tất cả Model",
                icon=ft.Icons.FLASH_ON,
                bgcolor=colors.warning,
                color=colors.on_primary,
                on_click=lambda e: self.on_preheat_all() if self.on_preheat_all else None
            )
        ], spacing=Spacing.MD)
        
        return self._build_section_card("Preheat Models", ft.Icons.ROCKET_LAUNCH, content)
    
    def _build_theme_section(self) -> ft.Container:
        """Build theme configuration section."""
        colors = self.tm.colors
        
        content = ft.Row([
            ft.Column([
                ft.Text("Chế độ tối", size=Typography.BODY, color=colors.text_primary),
                ft.Text("Giao diện dark mode", size=Typography.CAPTION, color=colors.text_muted)
            ], spacing=0, expand=True),
            ft.Switch(
                value=self.tm.is_dark,
                active_color=colors.primary,
                on_change=lambda e: self._handle_toggle_theme(e)
            )
        ])
        
        return self._build_section_card("Giao diện", ft.Icons.PALETTE, content)
    
    def _build_about_section(self) -> ft.Container:
        """Build about section."""
        colors = self.tm.colors
        
        content = ft.Column([
            ft.Row([
                ft.Text("Phiên bản:", size=Typography.BODY, color=colors.text_secondary),
                ft.Text("v2.0.0 (Python Rebuild)", size=Typography.BODY, color=colors.text_primary)
            ]),
            ft.Row([
                ft.Text("Hỗ trợ:", size=Typography.BODY, color=colors.text_secondary),
                ft.Text("Real-time Quota, GMT+7 Timezone", size=Typography.BODY, color=colors.text_primary)
            ]),
            ft.Divider(height=1, color=colors.divider),
            ft.Row([
                ft.Text("Các tính năng:", size=Typography.CAPTION, color=colors.text_muted),
            ]),
            ft.Row([
                ft.Chip(label=ft.Text("Modern UI", size=10), bgcolor=colors.surface_variant),
                ft.Chip(label=ft.Text("Dark Mode", size=10), bgcolor=colors.surface_variant),
                ft.Chip(label=ft.Text("Auto Sync", size=10), bgcolor=colors.surface_variant),
                ft.Chip(label=ft.Text("Notifications", size=10), bgcolor=colors.surface_variant),
            ], spacing=Spacing.XS, wrap=True)
        ], spacing=Spacing.SM)
        
        return self._build_section_card("Thông tin", ft.Icons.INFO, content)
    
    def _handle_save_path(self):
        """Handle save path button click."""
        if self.on_save_path:
            self.on_save_path(self.path_input.value)
    
    def _handle_toggle_sync(self, e):
        """Handle auto-sync toggle."""
        self.auto_sync_enabled = e.control.value
        if self.on_toggle_auto_sync:
            self.on_toggle_auto_sync(self.auto_sync_enabled)
        self._build()
        self.update()
    
    def _handle_change_interval(self, e):
        """Handle interval change."""
        self.auto_sync_interval = int(e.control.value)
        if self.on_change_interval:
            self.on_change_interval(self.auto_sync_interval)
    
    def _handle_toggle_theme(self, e):
        """Handle theme toggle."""
        self.tm.toggle_theme()
        self._build()
        self.update()
    
    def update_path(self, path: str, source: str):
        """Update path display."""
        self.antigravity_path = path
        self.path_source = source
        self._build()
        self.update()
