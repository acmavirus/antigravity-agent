"""
Sidebar Navigation Component
Compact sidebar using NavigationRail for proper layout
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
    """Compact sidebar navigation using custom layout."""
    
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
        
        # Logo - just icon when collapsed
        logo = ft.Container(
            content=ft.Row([
                ft.Container(
                    content=ft.Icon(ft.Icons.ROCKET_LAUNCH, color=ft.Colors.WHITE, size=18),
                    width=32,
                    height=32,
                    border_radius=8,
                    gradient=Gradients.linear(Gradients.BLUE_PURPLE),
                    alignment=ft.Alignment(0, 0)
                ),
                ft.Text(
                    "Agent",
                    size=12,
                    weight=ft.FontWeight.BOLD,
                    color=colors.text_primary
                ) if not self._collapsed else ft.Container()
            ], spacing=6, tight=True),
            padding=ft.padding.symmetric(horizontal=8, vertical=12)
        )
        
        # Navigation buttons - simple vertical list
        nav_buttons = []
        for i, item in enumerate(self.nav_items):
            is_selected = i == self.selected_index
            
            btn = ft.Container(
                content=ft.Row([
                    ft.Icon(
                        item.icon_selected if is_selected else item.icon,
                        color=colors.primary if is_selected else colors.text_muted,
                        size=18
                    ),
                    ft.Text(
                        item.label,
                        size=11,
                        color=colors.primary if is_selected else colors.text_secondary,
                        weight=ft.FontWeight.W_500 if is_selected else ft.FontWeight.NORMAL
                    ) if not self._collapsed else ft.Container()
                ], spacing=8, tight=True),
                padding=ft.padding.symmetric(horizontal=10, vertical=8),
                border_radius=6,
                bgcolor=ft.Colors.with_opacity(0.12, colors.primary) if is_selected else None,
                on_click=lambda e, idx=i: self._handle_nav_click(idx),
                ink=True
            )
            nav_buttons.append(btn)
        
        # Theme toggle - compact
        theme_btn = ft.Container(
            content=ft.Row([
                ft.Icon(
                    ft.Icons.DARK_MODE if self.tm.is_dark else ft.Icons.LIGHT_MODE,
                    color=colors.text_muted,
                    size=18
                ),
                ft.Text(
                    "Dark" if self.tm.is_dark else "Light",
                    size=10,
                    color=colors.text_muted
                ) if not self._collapsed else ft.Container()
            ], spacing=8, tight=True),
            padding=ft.padding.symmetric(horizontal=10, vertical=8),
            on_click=self._handle_theme_toggle,
            ink=True
        )
        
        # Build sidebar content
        self.content = ft.Column([
            logo,
            ft.Container(height=8),
            # Nav items in a column
            ft.Column(nav_buttons, spacing=2),
            ft.Container(expand=True),  # Spacer
            ft.Divider(height=1, color=colors.divider),
            theme_btn,
            ft.Container(height=4)
        ], spacing=0)
        
        # Sidebar container properties
        self.width = 120 if not self._collapsed else 50
        self.bgcolor = colors.surface
        self.border = ft.border.only(right=ft.BorderSide(1, colors.border))
        self.padding = 0
    
    def _handle_nav_click(self, index: int):
        """Handle navigation item click."""
        if index != self.selected_index:
            self.selected_index = index
            self._build()
            if self.on_nav_change:
                self.on_nav_change(self.nav_items[index].page_id)
            self.update()
    
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
