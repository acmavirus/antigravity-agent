"""
Dashboard Page
Main overview page with stats, current account, and quick actions
"""
import flet as ft
from typing import Callable, Optional
from app.ui.theme import ThemeManager, Spacing, Typography, AnimationDuration, Gradients, create_card
from app.ui.components.quota_display import QuotaMiniBars


class DashboardPage(ft.Container):
    """Main dashboard with overview and quick actions."""
    
    def __init__(
        self,
        current_email: str = "Chưa đăng nhập",
        current_plan: str = "Unknown",
        is_running: bool = False,
        total_accounts: int = 0,
        quota_data: list = None,
        on_save_account: Callable = None,
        on_stop_app: Callable = None,
        on_refresh_quota: Callable = None,
        on_switch_to_accounts: Callable = None,
        theme: ThemeManager = None
    ):
        super().__init__()
        
        self.current_email = current_email
        self.current_plan = current_plan
        self.is_running = is_running
        self.total_accounts = total_accounts
        self.quota_data = quota_data or []
        self.on_save_account = on_save_account
        self.on_stop_app = on_stop_app
        self.on_refresh_quota = on_refresh_quota
        self.on_switch_to_accounts = on_switch_to_accounts
        self.tm = theme or ThemeManager.get_instance()
        
        self._build()
    
    def _build(self):
        """Build the dashboard page."""
        colors = self.tm.colors
        
        # Welcome Header with gradient
        welcome_section = ft.Container(
            content=ft.Column([
                ft.Text(
                    "Dashboard",
                    size=Typography.DISPLAY,
                    weight=Typography.BOLD,
                    color=colors.text_primary
                ),
                ft.Text(
                    "Tổng quan tài khoản và hạn mức AI",
                    size=Typography.BODY,
                    color=colors.text_secondary
                )
            ], spacing=Spacing.XS),
            padding=ft.padding.only(bottom=Spacing.XL)
        )
        
        # Stats Cards Row
        stats_row = ft.Row([
            self._build_stat_card(
                icon=ft.Icons.PERSON,
                label="Tài khoản",
                value=str(self.total_accounts),
                color=colors.primary,
                on_click=self.on_switch_to_accounts
            ),
            self._build_stat_card(
                icon=ft.Icons.POWER_SETTINGS_NEW,
                label="Trạng thái",
                value="Đang chạy" if self.is_running else "Đã tắt",
                color=colors.success if self.is_running else colors.text_muted
            ),
            self._build_stat_card(
                icon=ft.Icons.AUTO_AWESOME,
                label="Models",
                value=str(len(self.quota_data)),
                color=colors.accent
            )
        ], spacing=Spacing.LG, expand=False)
        
        # Current Account Card (Hero)
        current_account_card = self._build_current_account_card()
        
        # Quick Actions
        quick_actions = self._build_quick_actions()
        
        # Quota Overview
        quota_section = self._build_quota_section()
        
        # Main layout
        self.content = ft.Column([
            welcome_section,
            stats_row,
            ft.Container(height=Spacing.LG),
            ft.Row([
                ft.Container(content=current_account_card, expand=2),
                ft.Container(content=quick_actions, expand=1)
            ], spacing=Spacing.LG),
            ft.Container(height=Spacing.LG),
            quota_section
        ], spacing=0, scroll=ft.ScrollMode.AUTO)
        
        self.expand = True
        self.padding = Spacing.XL
    
    def _build_stat_card(self, icon, label, value, color, on_click=None) -> ft.Container:
        """Build a stat card."""
        colors = self.tm.colors
        
        return ft.Container(
            content=ft.Row([
                ft.Container(
                    content=ft.Icon(icon, color=color, size=24),
                    width=48,
                    height=48,
                    border_radius=Spacing.RADIUS_MD,
                    bgcolor=ft.Colors.with_opacity(0.1, color),
                    alignment=ft.Alignment(0, 0)
                ),
                ft.Column([
                    ft.Text(value, size=Typography.TITLE, weight=Typography.BOLD, color=colors.text_primary),
                    ft.Text(label, size=Typography.CAPTION, color=colors.text_muted)
                ], spacing=0)
            ], spacing=Spacing.MD),
            bgcolor=colors.card,
            border=ft.border.all(1, colors.border),
            border_radius=Spacing.RADIUS_LG,
            padding=Spacing.LG,
            expand=True,
            on_click=on_click,
            on_hover=self._handle_card_hover if on_click else None,
            ink=True if on_click else False
        )
    
    def _build_current_account_card(self) -> ft.Container:
        """Build the current account hero card."""
        colors = self.tm.colors
        
        # Status badge
        status_badge = ft.Container(
            content=ft.Row([
                ft.Container(
                    width=8,
                    height=8,
                    border_radius=4,
                    bgcolor=colors.success if self.is_running else colors.text_muted
                ),
                ft.Text(
                    "Online" if self.is_running else "Offline",
                    size=Typography.SMALL,
                    color=colors.on_primary
                )
            ], spacing=Spacing.XS),
            bgcolor=ft.Colors.with_opacity(0.2, ft.Colors.WHITE),
            border_radius=Spacing.RADIUS_FULL,
            padding=ft.padding.symmetric(horizontal=Spacing.SM, vertical=4)
        )
        
        return ft.Container(
            content=ft.Column([
                ft.Row([
                    ft.Text("Tài khoản hiện tại", size=Typography.CAPTION, color=ft.Colors.with_opacity(0.8, ft.Colors.WHITE)),
                    ft.Container(expand=True),
                    status_badge
                ]),
                ft.Container(height=Spacing.MD),
                ft.Text(
                    self.current_email,
                    size=Typography.HEADLINE,
                    weight=Typography.BOLD,
                    color=ft.Colors.WHITE
                ),
                ft.Container(
                    content=ft.Text(self.current_plan, size=Typography.SMALL, color=ft.Colors.WHITE),
                    bgcolor=ft.Colors.with_opacity(0.2, ft.Colors.WHITE),
                    border_radius=Spacing.RADIUS_FULL,
                    padding=ft.padding.symmetric(horizontal=Spacing.SM, vertical=2)
                ),
                ft.Container(expand=True),
                ft.Row([
                    ft.ElevatedButton(
                        "Sao lưu tài khoản",
                        icon=ft.Icons.SAVE,
                        bgcolor=ft.Colors.with_opacity(0.2, ft.Colors.WHITE),
                        color=ft.Colors.WHITE,
                        on_click=lambda e: self.on_save_account() if self.on_save_account else None
                    ),
                    ft.OutlinedButton(
                        "Dừng ứng dụng" if self.is_running else "Ứng dụng đã tắt",
                        icon=ft.Icons.STOP if self.is_running else ft.Icons.CHECK,
                        style=ft.ButtonStyle(
                            color=ft.Colors.WHITE,
                            side=ft.BorderSide(1, ft.Colors.with_opacity(0.5, ft.Colors.WHITE))
                        ),
                        on_click=lambda e: self.on_stop_app() if self.on_stop_app else None,
                        disabled=not self.is_running
                    )
                ], spacing=Spacing.SM)
            ], spacing=Spacing.XS),
            gradient=Gradients.linear(Gradients.BLUE_PURPLE),
            border_radius=Spacing.RADIUS_XL,
            padding=Spacing.XL,
            height=220
        )
    
    def _build_quick_actions(self) -> ft.Container:
        """Build quick actions panel."""
        colors = self.tm.colors
        
        actions = [
            {"icon": ft.Icons.REFRESH, "label": "Làm mới Quota", "action": self.on_refresh_quota},
            {"icon": ft.Icons.PEOPLE, "label": "Quản lý tài khoản", "action": self.on_switch_to_accounts},
            {"icon": ft.Icons.FLASH_ON, "label": "Preheat All", "action": None},
        ]
        
        action_buttons = []
        for act in actions:
            action_buttons.append(
                ft.Container(
                    content=ft.Row([
                        ft.Icon(act["icon"], color=colors.primary, size=20),
                        ft.Text(act["label"], size=Typography.BODY, color=colors.text_primary, expand=True),
                        ft.Icon(ft.Icons.CHEVRON_RIGHT, color=colors.text_muted, size=18)
                    ], spacing=Spacing.MD),
                    padding=Spacing.MD,
                    border_radius=Spacing.RADIUS_MD,
                    on_click=lambda e, a=act["action"]: a() if a else None,
                    on_hover=self._handle_card_hover,
                    ink=True
                )
            )
        
        return ft.Container(
            content=ft.Column([
                ft.Text("Thao tác nhanh", size=Typography.SUBTITLE, weight=Typography.SEMI_BOLD, color=colors.text_primary),
                ft.Divider(height=1, color=colors.divider),
                ft.Column(action_buttons, spacing=Spacing.XS)
            ], spacing=Spacing.MD),
            bgcolor=colors.card,
            border=ft.border.all(1, colors.border),
            border_radius=Spacing.RADIUS_LG,
            padding=Spacing.LG,
            height=220
        )
    
    def _build_quota_section(self) -> ft.Container:
        """Build quota overview section."""
        colors = self.tm.colors
        
        if not self.quota_data:
            content = ft.Container(
                content=ft.Column([
                    ft.Icon(ft.Icons.ANALYTICS, color=colors.text_muted, size=48),
                    ft.Text(
                        "Chưa có dữ liệu quota",
                        size=Typography.BODY,
                        color=colors.text_secondary
                    ),
                    ft.Text(
                        "Nhấn 'Làm mới Quota' để tải dữ liệu",
                        size=Typography.CAPTION,
                        color=colors.text_muted
                    )
                ], alignment=ft.MainAxisAlignment.CENTER, horizontal_alignment=ft.CrossAxisAlignment.CENTER, spacing=Spacing.SM),
                alignment=ft.Alignment(0, 0),
                height=150
            )
        else:
            content = QuotaMiniBars(
                quotas=[{
                    "model_name": q.get("model_name", "Unknown"),
                    "percentage": q.get("percentage", 0),
                    "reset_text": q.get("reset_text", "")
                } for q in self.quota_data],
                theme=self.tm
            )
        
        return ft.Container(
            content=ft.Column([
                ft.Row([
                    ft.Text("Tổng quan Quota", size=Typography.SUBTITLE, weight=Typography.SEMI_BOLD, color=colors.text_primary),
                    ft.Container(expand=True),
                    ft.TextButton(
                        "Xem tất cả",
                        icon=ft.Icons.ARROW_FORWARD,
                        style=ft.ButtonStyle(color=colors.primary)
                    )
                ]),
                ft.Divider(height=1, color=colors.divider),
                content
            ], spacing=Spacing.MD),
            bgcolor=colors.card,
            border=ft.border.all(1, colors.border),
            border_radius=Spacing.RADIUS_LG,
            padding=Spacing.LG
        )
    
    def _handle_card_hover(self, e: ft.ControlEvent):
        """Handle hover effect on cards."""
        colors = self.tm.colors
        if e.data == "true":
            e.control.bgcolor = ft.Colors.with_opacity(0.03, colors.primary)
        else:
            e.control.bgcolor = None
        e.control.update()
    
    def update_data(
        self,
        current_email: str = None,
        current_plan: str = None,
        is_running: bool = None,
        total_accounts: int = None,
        quota_data: list = None
    ):
        """Update dashboard data."""
        if current_email is not None:
            self.current_email = current_email
        if current_plan is not None:
            self.current_plan = current_plan
        if is_running is not None:
            self.is_running = is_running
        if total_accounts is not None:
            self.total_accounts = total_accounts
        if quota_data is not None:
            self.quota_data = quota_data
        
        self._build()
        self.update()
