"""
Sidebar Navigation Component
Modern sidebar with icons, tooltips, and active state
"""
import flet as ft
from typing import Callable, List, Optional
from app.ui.theme import ThemeManager, Spacing, Typography, AnimationDuration, Gradients


class NavItem:
    """Navigation item data."""
    def __init__(
        self, 
        icon: str, 
        label: str, 
        page_id: str,
        icon_selected: str = None,
        badge_count: int = 0
    ):
        self.icon = icon
        self.icon_selected = icon_selected or icon
        self.label = label
        self.page_id = page_id
        self.badge_count = badge_count


class Sidebar(ft.Container):
    """Modern sidebar navigation component."""
    
    def __init__(
        self,
        nav_items: List[NavItem],
        on_nav_change: Callable[[str], None],
        selected_index: int = 0,
        collapsed: bool = False,
        theme: ThemeManager = None
    ):
        super().__init__()
        
        self.nav_items = nav_items
        self.on_nav_change = on_nav_change
        self.selected_index = selected_index
        self._collapsed = collapsed
        self.tm = theme or ThemeManager.get_instance()
        
        self._build()
    
    def _build(self):
        """Build the sidebar UI."""
        colors = self.tm.colors
        
        # Logo section
        logo_section = ft.Container(
            content=ft.Row([
                ft.Container(
                    content=ft.Image(
                        src="icon.png",
                        width=32,
                        height=32,
                        border_radius=Spacing.RADIUS_MD
                    ),
                    gradient=Gradients.linear(Gradients.BLUE_PURPLE),
                    border_radius=Spacing.RADIUS_MD,
                    padding=2
                ),
                ft.Text(
                    "Antigravity",
                    size=Typography.SUBTITLE,
                    weight=Typography.SEMI_BOLD,
                    color=colors.text_primary
                ) if not self._collapsed else ft.Container()
            ], spacing=Spacing.SM),
            padding=ft.padding.symmetric(horizontal=Spacing.LG, vertical=Spacing.XL),
        )
        
        # Navigation items
        nav_buttons = []
        for i, item in enumerate(self.nav_items):
            nav_buttons.append(
                self._create_nav_button(item, i)
            )
        
        nav_section = ft.Column(
            controls=nav_buttons,
            spacing=Spacing.XS,
            expand=True
        )
        
        # Theme toggle at bottom
        theme_toggle = ft.Container(
            content=ft.Row([
                ft.IconButton(
                    icon=ft.Icons.DARK_MODE if self.tm.is_dark else ft.Icons.LIGHT_MODE,
                    icon_color=colors.text_secondary,
                    tooltip="Toggle Theme",
                    on_click=self._handle_theme_toggle,
                    icon_size=20
                ),
                ft.Text(
                    "Dark Mode" if self.tm.is_dark else "Light Mode",
                    size=Typography.CAPTION,
                    color=colors.text_muted
                ) if not self._collapsed else ft.Container()
            ], spacing=Spacing.SM),
            padding=ft.padding.all(Spacing.MD)
        )
        
        # Main sidebar container
        self.content = ft.Column([
            logo_section,
            ft.Divider(height=1, color=colors.divider),
            ft.Container(
                content=nav_section,
                expand=True,
                padding=ft.padding.symmetric(horizontal=Spacing.SM, vertical=Spacing.MD)
            ),
            ft.Divider(height=1, color=colors.divider),
            theme_toggle
        ])
        
        self.width = 220 if not self._collapsed else 70
        self.bgcolor = colors.surface
        self.border = ft.border.only(right=ft.BorderSide(1, colors.border))
        self.animate = AnimationDuration.NORMAL
    
    def _create_nav_button(self, item: NavItem, index: int) -> ft.Container:
        """Create a navigation button."""
        colors = self.tm.colors
        is_selected = index == self.selected_index
        
        icon_widget = ft.Icon(
            item.icon_selected if is_selected else item.icon,
            color=colors.primary if is_selected else colors.text_secondary,
            size=20
        )
        
        # Badge for notification count
        badge = None
        if item.badge_count > 0:
            badge = ft.Container(
                content=ft.Text(
                    str(item.badge_count) if item.badge_count < 100 else "99+",
                    size=10,
                    color=colors.on_primary,
                    weight=Typography.SEMI_BOLD
                ),
                bgcolor=colors.danger,
                border_radius=Spacing.RADIUS_FULL,
                padding=ft.padding.symmetric(horizontal=5, vertical=1),
                alignment=ft.Alignment(0, 0)
            )
        
        content = ft.Row([
            ft.Stack([
                icon_widget,
                ft.Container(
                    content=badge,
                    top=-5,
                    right=-8
                ) if badge else ft.Container(width=0, height=0)
            ]),
            ft.Text(
                item.label,
                size=Typography.BODY,
                weight=Typography.MEDIUM if is_selected else Typography.REGULAR,
                color=colors.primary if is_selected else colors.text_secondary
            ) if not self._collapsed else ft.Container()
        ], spacing=Spacing.MD)
        
        return ft.Container(
            content=content,
            padding=ft.padding.symmetric(horizontal=Spacing.MD, vertical=Spacing.SM + 2),
            border_radius=Spacing.RADIUS_MD,
            bgcolor=ft.Colors.with_opacity(0.1, colors.primary) if is_selected else None,
            border=ft.border.all(1, colors.primary) if is_selected else None,
            on_click=lambda e, idx=index: self._handle_nav_click(idx),
            on_hover=lambda e: self._handle_hover(e),
            ink=True,
            animate=AnimationDuration.FAST,
            tooltip=item.label if self._collapsed else None
        )
    
    def _handle_nav_click(self, index: int):
        """Handle navigation item click."""
        if index != self.selected_index:
            self.selected_index = index
            self._build()
            if self.on_nav_change:
                self.on_nav_change(self.nav_items[index].page_id)
            self.update()
    
    def _handle_hover(self, e: ft.ControlEvent):
        """Handle hover effect."""
        colors = self.tm.colors
        e.control.bgcolor = ft.Colors.with_opacity(0.05, colors.primary) if e.data == "true" else None
        e.control.update()
    
    def _handle_theme_toggle(self, e):
        """Handle theme toggle."""
        self.tm.toggle_theme()
        self._build()
        self.update()
    
    def set_selected(self, index: int):
        """Set selected navigation item."""
        if 0 <= index < len(self.nav_items):
            self.selected_index = index
            self._build()
            self.update()
    
    def update_badge(self, page_id: str, count: int):
        """Update badge count for a navigation item."""
        for item in self.nav_items:
            if item.page_id == page_id:
                item.badge_count = count
                self._build()
                self.update()
                break
    
    def toggle_collapse(self):
        """Toggle sidebar collapse state."""
        self._collapsed = not self._collapsed
        self._build()
        self.update()
