"""
Quota Detail Page
Detailed view of quotas across all accounts
"""
import flet as ft
from typing import Callable, List, Optional, Dict
from app.ui.theme import ThemeManager, Spacing, Typography
from app.ui.components.quota_display import QuotaCard, QuotaMiniBars


class QuotaDetailPage(ft.Container):
    """Detailed quota view page."""
    
    def __init__(
        self,
        accounts_quota: Dict[str, list] = None,  # {email: [quota_data]}
        on_preheat: Callable[[str, str], None] = None,  # (email, model_id)
        on_refresh: Callable = None,
        loading: bool = False,
        theme: ThemeManager = None
    ):
        super().__init__()
        
        self.accounts_quota = accounts_quota or {}
        self.on_preheat = on_preheat
        self.on_refresh = on_refresh
        self.loading = loading
        self.tm = theme or ThemeManager.get_instance()
        
        self._build()
    
    def _build(self):
        """Build the quota detail page."""
        colors = self.tm.colors
        
        # Header
        header = ft.Row([
            ft.Column([
                ft.Text(
                    "Chi tiết Quota",
                    size=Typography.DISPLAY,
                    weight=Typography.BOLD,
                    color=colors.text_primary
                ),
                ft.Text(
                    "Theo dõi hạn mức sử dụng AI của tất cả tài khoản",
                    size=Typography.BODY,
                    color=colors.text_secondary
                )
            ], spacing=Spacing.XS),
            ft.Container(expand=True),
            ft.ElevatedButton(
                "Làm mới",
                icon=ft.Icons.REFRESH,
                bgcolor=colors.primary,
                color=colors.on_primary,
                on_click=lambda e: self.on_refresh() if self.on_refresh else None
            )
        ])
        
        # Loading state
        if self.loading:
            content = ft.Container(
                content=ft.Column([
                    ft.ProgressRing(color=colors.primary),
                    ft.Text("Đang tải quota...", color=colors.text_secondary)
                ], alignment=ft.MainAxisAlignment.CENTER, horizontal_alignment=ft.CrossAxisAlignment.CENTER, spacing=Spacing.MD),
                alignment=ft.Alignment(0, 0),
                expand=True
            )
        elif not self.accounts_quota:
            # Empty state
            content = ft.Container(
                content=ft.Column([
                    ft.Icon(ft.Icons.ANALYTICS_OUTLINED, color=colors.text_muted, size=64),
                    ft.Text(
                        "Chưa có dữ liệu quota",
                        size=Typography.TITLE,
                        weight=Typography.SEMI_BOLD,
                        color=colors.text_secondary
                    ),
                    ft.Text(
                        "Nhấn 'Làm mới' để tải dữ liệu quota",
                        size=Typography.BODY,
                        color=colors.text_muted
                    ),
                    ft.Container(height=Spacing.MD),
                    ft.ElevatedButton(
                        "Tải dữ liệu Quota",
                        icon=ft.Icons.REFRESH,
                        bgcolor=colors.primary,
                        color=colors.on_primary,
                        on_click=lambda e: self.on_refresh() if self.on_refresh else None
                    )
                ], alignment=ft.MainAxisAlignment.CENTER, horizontal_alignment=ft.CrossAxisAlignment.CENTER, spacing=Spacing.SM),
                alignment=ft.Alignment(0, 0),
                expand=True
            )
        else:
            # Quota sections by account
            sections = []
            for email, quotas in self.accounts_quota.items():
                sections.append(self._build_account_section(email, quotas))
            
            content = ft.ListView(
                controls=sections,
                spacing=Spacing.XL,
                expand=True,
                padding=ft.padding.only(top=Spacing.LG)
            )
        
        # Main layout
        self.content = ft.Column([
            header,
            content
        ], spacing=0, expand=True)
        
        self.expand = True
        self.padding = Spacing.XL
    
    def _build_account_section(self, email: str, quotas: list) -> ft.Container:
        """Build quota section for an account."""
        colors = self.tm.colors
        
        # Account header
        account_header = ft.Row([
            ft.Container(
                content=ft.Text(
                    email[:2].upper(),
                    size=Typography.BODY,
                    weight=Typography.BOLD,
                    color=colors.on_primary
                ),
                width=36,
                height=36,
                border_radius=Spacing.RADIUS_FULL,
                bgcolor=colors.primary,
                alignment=ft.Alignment(0, 0)
            ),
            ft.Column([
                ft.Text(email, size=Typography.SUBTITLE, weight=Typography.SEMI_BOLD, color=colors.text_primary),
                ft.Text(f"{len(quotas)} models", size=Typography.CAPTION, color=colors.text_muted)
            ], spacing=0),
            ft.Container(expand=True),
            ft.TextButton(
                "Preheat All",
                icon=ft.Icons.FLASH_ON,
                style=ft.ButtonStyle(color=colors.warning)
            )
        ], spacing=Spacing.MD)
        
        # Quota cards in a scrollable grid
        quota_cards = []
        for q in quotas:
            model_id = q.model_id if hasattr(q, 'model_id') else q.get("model_id", "")
            model_name = q.model_name if hasattr(q, 'model_name') else q.get("model_name", "Unknown")
            percentage = q.percentage if hasattr(q, 'percentage') else q.get("percentage", 0)
            reset_text = q.reset_text if hasattr(q, 'reset_text') else q.get("reset_text", "")
            
            card = QuotaCard(
                model_id=model_id,
                model_name=model_name,
                percentage=percentage,
                reset_text=reset_text,
                on_preheat=lambda mid, e=email: self.on_preheat(e, mid) if self.on_preheat else None,
                theme=self.tm
            )
            quota_cards.append(card)
        
        # Use Row with wrap for responsive grid
        grid_row = ft.Row(
            controls=quota_cards,
            wrap=True,
            spacing=Spacing.MD,
            run_spacing=Spacing.MD,
            scroll=ft.ScrollMode.AUTO
        )
        
        return ft.Container(
            content=ft.Column([
                account_header,
                ft.Divider(height=1, color=colors.divider),
                grid_row
            ], spacing=Spacing.MD, scroll=ft.ScrollMode.AUTO),
            bgcolor=colors.card,
            border=ft.border.all(1, colors.border),
            border_radius=Spacing.RADIUS_LG,
            padding=Spacing.LG
        )
    
    def update_quota(self, accounts_quota: Dict[str, list], loading: bool = False):
        """Update quota data."""
        self.accounts_quota = accounts_quota
        self.loading = loading
        self._build()
        self.update()
