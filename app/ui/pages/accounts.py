"""
Accounts Page
Account management with cards, search, and actions
"""
import flet as ft
from typing import Callable, List, Optional
from app.ui.theme import ThemeManager, Spacing, Typography, AnimationDuration
from app.ui.components.account_card import AccountCard


class AccountsPage(ft.Container):
    """Account management page."""
    
    def __init__(
        self,
        accounts: List[dict] = None,  # [{email, plan, quota_data, is_active}]
        on_switch: Callable[[str], None] = None,
        on_delete: Callable[[str], None] = None,
        on_refresh: Callable[[str], None] = None,
        on_refresh_all: Callable = None,
        on_clear_all: Callable = None,
        on_save_current: Callable = None,
        theme: ThemeManager = None
    ):
        super().__init__()
        
        self.accounts = accounts or []
        self.on_switch = on_switch
        self.on_delete = on_delete
        self.on_refresh = on_refresh
        self.on_refresh_all = on_refresh_all
        self.on_clear_all = on_clear_all
        self.on_save_current = on_save_current
        self.tm = theme or ThemeManager.get_instance()
        
        self._search_query = ""
        self._build()
    
    def _build(self):
        """Build the accounts page."""
        colors = self.tm.colors
        
        # Header
        header = ft.Row([
            ft.Column([
                ft.Text(
                    "Quản lý Tài khoản",
                    size=Typography.DISPLAY,
                    weight=Typography.BOLD,
                    color=colors.text_primary
                ),
                ft.Text(
                    f"{len(self.accounts)} tài khoản đã lưu",
                    size=Typography.BODY,
                    color=colors.text_secondary
                )
            ], spacing=Spacing.XS),
            ft.Container(expand=True),
            ft.ElevatedButton(
                "Sao lưu hiện tại",
                icon=ft.Icons.ADD,
                bgcolor=colors.primary,
                color=colors.on_primary,
                on_click=lambda e: self.on_save_current() if self.on_save_current else None
            )
        ])
        
        # Search and filter bar
        self.search_field = ft.TextField(
            hint_text="Tìm kiếm tài khoản...",
            prefix_icon=ft.Icons.SEARCH,
            border_color=colors.border,
            focused_border_color=colors.primary,
            border_radius=Spacing.RADIUS_MD,
            height=42,
            expand=True,
            on_change=self._handle_search,
            text_style=ft.TextStyle(color=colors.text_primary),
            hint_style=ft.TextStyle(color=colors.text_muted)
        )
        
        search_bar = ft.Row([
            self.search_field,
            ft.Container(width=Spacing.MD),
            ft.ElevatedButton(
                "Làm mới tất cả",
                icon=ft.Icons.REFRESH,
                bgcolor=colors.accent,
                color=colors.on_primary,
                height=42,
                on_click=lambda e: self.on_refresh_all() if self.on_refresh_all else None
            ),
            ft.PopupMenuButton(
                icon=ft.Icons.MORE_VERT,
                icon_color=colors.text_secondary,
                items=[
                    ft.PopupMenuItem(
                        content=ft.Row([
                            ft.Icon(ft.Icons.DELETE_SWEEP, size=18, color=colors.danger),
                            ft.Text("Xóa tất cả", color=colors.text_primary)
                        ], spacing=Spacing.SM),
                        on_click=lambda e: self.on_clear_all() if self.on_clear_all else None
                    )
                ]
            )
        ])
        
        # Account cards list
        account_cards = self._build_account_cards()
        
        # Empty state
        if not self.accounts:
            empty_state = ft.Container(
                content=ft.Column([
                    ft.Icon(ft.Icons.PERSON_OFF, color=colors.text_muted, size=64),
                    ft.Text(
                        "Chưa có tài khoản nào",
                        size=Typography.TITLE,
                        weight=Typography.SEMI_BOLD,
                        color=colors.text_secondary
                    ),
                    ft.Text(
                        "Nhấn 'Sao lưu hiện tại' để lưu tài khoản đang đăng nhập",
                        size=Typography.BODY,
                        color=colors.text_muted
                    ),
                    ft.Container(height=Spacing.MD),
                    ft.ElevatedButton(
                        "Sao lưu tài khoản hiện tại",
                        icon=ft.Icons.ADD,
                        bgcolor=colors.primary,
                        color=colors.on_primary,
                        on_click=lambda e: self.on_save_current() if self.on_save_current else None
                    )
                ], alignment=ft.MainAxisAlignment.CENTER, horizontal_alignment=ft.CrossAxisAlignment.CENTER, spacing=Spacing.SM),
                alignment=ft.Alignment(0, 0),
                expand=True
            )
            content = empty_state
        else:
            content = ft.ListView(
                controls=account_cards,
                spacing=Spacing.MD,
                expand=True,
                padding=ft.padding.only(top=Spacing.MD)
            )
        
        # Main layout
        self.content = ft.Column([
            header,
            ft.Container(height=Spacing.LG),
            search_bar,
            content
        ], spacing=0, expand=True, scroll=ft.ScrollMode.AUTO)
        
        self.expand = True
        self.padding = Spacing.XL
    
    def _build_account_cards(self) -> List[AccountCard]:
        """Build account card components."""
        cards = []
        
        # Filter by search query
        filtered_accounts = self.accounts
        if self._search_query:
            query = self._search_query.lower()
            filtered_accounts = [a for a in self.accounts if query in a.get("email", "").lower()]
        
        for acc in filtered_accounts:
            email = acc.get("email", "Unknown")
            plan = acc.get("plan", "Unknown")
            is_active = acc.get("is_active", False)
            quota_data = acc.get("quota_data", [])
            
            # Convert quota data to expected format
            quota_list = []
            if quota_data:
                for q in quota_data:
                    quota_list.append({
                        "model_name": q.model_name if hasattr(q, 'model_name') else q.get("model_name", "Unknown"),
                        "percentage": q.percentage if hasattr(q, 'percentage') else q.get("percentage", 0),
                        "reset_text": q.reset_text if hasattr(q, 'reset_text') else q.get("reset_text", "")
                    })
            
            card = AccountCard(
                email=email,
                plan=plan,
                is_active=is_active,
                quota_data=quota_list,
                on_switch=self.on_switch,
                on_delete=self.on_delete,
                on_refresh=self.on_refresh,
                theme=self.tm
            )
            cards.append(card)
        
        return cards
    
    def _handle_search(self, e):
        """Handle search input change."""
        self._search_query = e.control.value
        self._build()
        self.update()
    
    def update_accounts(self, accounts: List[dict]):
        """Update accounts list."""
        self.accounts = accounts
        self._build()
        self.update()
