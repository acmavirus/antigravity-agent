"""
Account Card Component
Modern glassmorphism card with avatar, quota preview, and actions
"""
import flet as ft
from typing import Callable, List, Optional
from app.ui.theme import ThemeManager, Spacing, Typography, AnimationDuration, Gradients


class AccountCard(ft.Container):
    """Modern account card with glassmorphism design."""
    
    def __init__(
        self,
        email: str,
        plan: str,
        is_active: bool = False,
        quota_data: List[dict] = None,  # [{model, percentage, reset_text}]
        on_switch: Callable = None,
        on_delete: Callable = None,
        on_refresh: Callable = None,
        expanded: bool = False,
        theme: ThemeManager = None
    ):
        super().__init__()
        
        self.email = email
        self.plan = plan
        self.is_active = is_active
        self.quota_data = quota_data or []
        self.on_switch = on_switch
        self.on_delete = on_delete
        self.on_refresh = on_refresh
        self._expanded = expanded
        self.tm = theme or ThemeManager.get_instance()
        
        self._build()
    
    def _get_avatar_gradient(self) -> list:
        """Get gradient colors based on email hash."""
        gradients = [
            Gradients.BLUE_PURPLE,
            Gradients.BLUE_CYAN,
            Gradients.PURPLE_PINK,
            Gradients.GREEN_CYAN
        ]
        hash_val = sum(ord(c) for c in self.email)
        return gradients[hash_val % len(gradients)]
    
    def _get_initials(self) -> str:
        """Get initials from email."""
        parts = self.email.split('@')[0]
        if '.' in parts:
            names = parts.split('.')
            return (names[0][0] + names[-1][0]).upper()
        return parts[:2].upper()
    
    def _build(self):
        """Build the card UI."""
        colors = self.tm.colors
        
        # Avatar with gradient border
        avatar = ft.Container(
            content=ft.Container(
                content=ft.Text(
                    self._get_initials(),
                    size=Typography.SUBTITLE,
                    weight=Typography.BOLD,
                    color=colors.text_primary
                ),
                width=44,
                height=44,
                border_radius=Spacing.RADIUS_FULL,
                bgcolor=colors.surface_variant,
                alignment=ft.Alignment(0, 0)
            ),
            gradient=Gradients.linear(self._get_avatar_gradient()),
            border_radius=Spacing.RADIUS_FULL,
            padding=2
        )
        
        # Status indicator
        status_dot = ft.Container(
            width=10,
            height=10,
            border_radius=Spacing.RADIUS_FULL,
            bgcolor=colors.success if self.is_active else colors.text_muted,
            border=ft.border.all(2, colors.card),
            tooltip="Đang hoạt động" if self.is_active else "Không hoạt động"
        )
        
        # Plan badge
        plan_badge = ft.Container(
            content=ft.Text(
                self.plan,
                size=Typography.SMALL,
                color=colors.on_primary,
                weight=Typography.MEDIUM
            ),
            bgcolor=colors.accent if "Premium" in self.plan else colors.text_muted,
            border_radius=Spacing.RADIUS_FULL,
            padding=ft.padding.symmetric(horizontal=8, vertical=2)
        )
        
        # Header section
        header = ft.Row([
            ft.Stack([
                avatar,
                ft.Container(
                    content=status_dot,
                    bottom=0,
                    right=0
                )
            ]),
            ft.Column([
                ft.Text(
                    self.email,
                    size=Typography.BODY,
                    weight=Typography.SEMI_BOLD,
                    color=colors.text_primary,
                    max_lines=1,
                    overflow=ft.TextOverflow.ELLIPSIS
                ),
                ft.Row([
                    plan_badge,
                    ft.Text(
                        f"• {len(self.quota_data)} models",
                        size=Typography.CAPTION,
                        color=colors.text_muted
                    ) if self.quota_data else ft.Container()
                ], spacing=Spacing.SM)
            ], spacing=2, expand=True),
            self._build_actions()
        ], spacing=Spacing.MD)
        
        # Quota preview (mini bars)
        quota_preview = self._build_quota_preview() if self.quota_data else None
        
        # Expanded content
        expanded_content = self._build_expanded_content() if self._expanded else None
        
        # Main content
        content_column = ft.Column([
            header,
            quota_preview if quota_preview else ft.Container(height=0),
            expanded_content if expanded_content else ft.Container(height=0)
        ], spacing=Spacing.MD)
        
        # Card container
        self.content = content_column
        self.bgcolor = colors.card
        self.border = ft.border.all(
            1, 
            colors.primary if self.is_active else colors.border
        )
        self.border_radius = Spacing.RADIUS_LG
        self.padding = Spacing.LG
        self.animate = AnimationDuration.FAST
        self.on_hover = self._handle_hover
        self.shadow = ft.BoxShadow(
            spread_radius=0,
            blur_radius=8 if self.is_active else 4,
            color=ft.Colors.with_opacity(0.15 if self.is_active else 0.1, colors.primary if self.is_active else ft.Colors.BLACK),
            offset=ft.Offset(0, 2)
        )
    
    def _build_actions(self) -> ft.Row:
        """Build action buttons."""
        colors = self.tm.colors
        
        return ft.Row([
            ft.IconButton(
                icon=ft.Icons.REFRESH,
                icon_color=colors.text_secondary,
                icon_size=18,
                tooltip="Làm mới quota",
                on_click=lambda e: self.on_refresh(self.email) if self.on_refresh else None,
                style=ft.ButtonStyle(
                    overlay_color=ft.Colors.with_opacity(0.1, colors.primary)
                )
            ),
            ft.ElevatedButton(
                "Switch",
                icon=ft.Icons.SWAP_HORIZ,
                bgcolor=colors.primary,
                color=colors.on_primary,
                height=32,
                on_click=lambda e: self.on_switch(self.email) if self.on_switch else None,
                style=ft.ButtonStyle(
                    shape=ft.RoundedRectangleBorder(radius=Spacing.RADIUS_MD)
                )
            ),
            ft.PopupMenuButton(
                icon=ft.Icons.MORE_VERT,
                icon_color=colors.text_secondary,
                icon_size=18,
                items=[
                    ft.PopupMenuItem(
                        content=ft.Row([
                            ft.Icon(ft.Icons.INFO_OUTLINE, size=16, color=colors.text_secondary),
                            ft.Text("Xem chi tiết", color=colors.text_primary)
                        ], spacing=Spacing.SM),
                        on_click=lambda e: self._toggle_expand()
                    ),
                    ft.PopupMenuItem(
                        content=ft.Row([
                            ft.Icon(ft.Icons.DELETE_OUTLINE, size=16, color=colors.danger),
                            ft.Text("Xóa tài khoản", color=colors.text_primary)
                        ], spacing=Spacing.SM),
                        on_click=lambda e: self.on_delete(self.email) if self.on_delete else None
                    )
                ]
            )
        ], spacing=Spacing.XS, tight=True)
    
    def _build_quota_preview(self) -> ft.Container:
        """Build mini quota bars preview."""
        colors = self.tm.colors
        
        bars = []
        for q in self.quota_data[:3]:  # Show max 3
            pct = q.get("percentage", 0)
            progress_color = colors.danger if pct < 15 else (colors.warning if pct < 50 else colors.success)
            
            bars.append(
                ft.Column([
                    ft.Row([
                        ft.Text(
                            q.get("model_name", "Unknown")[:15],
                            size=Typography.SMALL,
                            color=colors.text_secondary,
                            max_lines=1,
                            overflow=ft.TextOverflow.ELLIPSIS,
                            expand=True
                        ),
                        ft.Text(
                            f"{pct:.0f}%",
                            size=Typography.SMALL,
                            color=progress_color,
                            weight=Typography.SEMI_BOLD
                        )
                    ]),
                    ft.ProgressBar(
                        value=pct / 100 if pct <= 100 else 1.0,
                        color=progress_color,
                        bgcolor=colors.surface_variant,
                        height=4,
                        border_radius=2
                    )
                ], spacing=2)
            )
        
        if len(self.quota_data) > 3:
            bars.append(
                ft.Text(
                    f"+{len(self.quota_data) - 3} more models",
                    size=Typography.CAPTION,
                    color=colors.text_muted,
                    italic=True
                )
            )
        
        return ft.Container(
            content=ft.Column(bars, spacing=Spacing.SM),
            padding=ft.padding.only(top=Spacing.SM),
            border=ft.border.only(top=ft.BorderSide(1, colors.divider))
        )
    
    def _build_expanded_content(self) -> ft.Container:
        """Build expanded details content."""
        colors = self.tm.colors
        
        # Full quota details
        quota_details = []
        for q in self.quota_data:
            pct = q.get("percentage", 0)
            progress_color = colors.danger if pct < 15 else (colors.warning if pct < 50 else colors.success)
            reset_text = q.get("reset_text", "")
            
            quota_details.append(
                ft.Container(
                    content=ft.Column([
                        ft.Row([
                            ft.Text(
                                q.get("model_name", "Unknown"),
                                size=Typography.BODY,
                                weight=Typography.MEDIUM,
                                color=colors.text_primary
                            ),
                            ft.Container(expand=True),
                            ft.Text(
                                f"{pct:.2f}%",
                                size=Typography.BODY,
                                color=progress_color,
                                weight=Typography.BOLD
                            )
                        ]),
                        ft.ProgressBar(
                            value=pct / 100 if pct <= 100 else 1.0,
                            color=progress_color,
                            bgcolor=colors.surface_variant,
                            height=8,
                            border_radius=4
                        ),
                        ft.Text(
                            f"Reset: {reset_text}" if reset_text else "No reset info",
                            size=Typography.CAPTION,
                            color=colors.text_muted,
                            italic=True
                        )
                    ], spacing=Spacing.XS),
                    padding=Spacing.SM,
                    border_radius=Spacing.RADIUS_SM,
                    bgcolor=colors.surface_variant
                )
            )
        
        return ft.Container(
            content=ft.Column([
                ft.Divider(height=1, color=colors.divider),
                ft.Text(
                    "Chi tiết Quota",
                    size=Typography.SUBTITLE,
                    weight=Typography.SEMI_BOLD,
                    color=colors.text_primary
                ),
                ft.Column(quota_details, spacing=Spacing.SM)
            ], spacing=Spacing.MD),
            padding=ft.padding.only(top=Spacing.MD),
            animate=AnimationDuration.NORMAL
        )
    
    def _handle_hover(self, e: ft.ControlEvent):
        """Handle card hover effect."""
        colors = self.tm.colors
        if e.data == "true":
            self.shadow = ft.BoxShadow(
                spread_radius=0,
                blur_radius=16,
                color=ft.Colors.with_opacity(0.2, colors.primary),
                offset=ft.Offset(0, 4)
            )
        else:
            self.shadow = ft.BoxShadow(
                spread_radius=0,
                blur_radius=8 if self.is_active else 4,
                color=ft.Colors.with_opacity(0.15 if self.is_active else 0.1, colors.primary if self.is_active else ft.Colors.BLACK),
                offset=ft.Offset(0, 2)
            )
        self.update()
    
    def _toggle_expand(self):
        """Toggle expanded state."""
        self._expanded = not self._expanded
        self._build()
        self.update()
    
    def update_quota(self, quota_data: List[dict]):
        """Update quota data and refresh display."""
        self.quota_data = quota_data
        self._build()
        self.update()
