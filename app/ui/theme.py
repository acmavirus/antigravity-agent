"""
Theme Configuration for Antigravity Agent
Modern Dark/Light theme with Glassmorphism design
"""
import flet as ft
from dataclasses import dataclass
from typing import Optional


@dataclass
class ColorScheme:
    """Color scheme for a theme."""
    # Backgrounds
    background: str
    surface: str
    surface_variant: str
    card: str
    
    # Primary colors
    primary: str
    primary_variant: str
    on_primary: str
    
    # Accent colors
    accent: str
    accent_variant: str
    
    # Semantic colors
    success: str
    warning: str
    danger: str
    info: str
    
    # Text colors
    text_primary: str
    text_secondary: str
    text_muted: str
    
    # Border & Divider
    border: str
    divider: str
    
    # Overlay
    overlay: str


# Dark Theme - Primary
DARK_THEME = ColorScheme(
    # Backgrounds - Deep Navy
    background="#0d1117",
    surface="#161b22",
    surface_variant="#1c2128",
    card="#21262d",
    
    # Primary - Electric Blue
    primary="#58a6ff",
    primary_variant="#388bfd",
    on_primary="#ffffff",
    
    # Accent - Vibrant Purple
    accent="#a371f7",
    accent_variant="#8957e5",
    
    # Semantic
    success="#3fb950",
    warning="#d29922",
    danger="#f85149",
    info="#58a6ff",
    
    # Text
    text_primary="#f0f6fc",
    text_secondary="#8b949e",
    text_muted="#6e7681",
    
    # Border & Divider
    border="#30363d",
    divider="#21262d",
    
    # Overlay
    overlay="rgba(0, 0, 0, 0.5)"
)


# Light Theme
LIGHT_THEME = ColorScheme(
    # Backgrounds - Soft White
    background="#f6f8fa",
    surface="#ffffff",
    surface_variant="#f0f3f6",
    card="#ffffff",
    
    # Primary - Ocean Blue
    primary="#0969da",
    primary_variant="#0550ae",
    on_primary="#ffffff",
    
    # Accent - Purple
    accent="#8250df",
    accent_variant="#6639ba",
    
    # Semantic
    success="#1a7f37",
    warning="#9a6700",
    danger="#cf222e",
    info="#0969da",
    
    # Text
    text_primary="#1f2328",
    text_secondary="#656d76",
    text_muted="#8c959f",
    
    # Border & Divider
    border="#d0d7de",
    divider="#d8dee4",
    
    # Overlay
    overlay="rgba(0, 0, 0, 0.3)"
)


class ThemeManager:
    """Manages theme state and provides themed components."""
    
    _instance: Optional['ThemeManager'] = None
    
    def __init__(self):
        self._is_dark = True
        self._colors = DARK_THEME
        self._page: Optional[ft.Page] = None
    
    @classmethod
    def get_instance(cls) -> 'ThemeManager':
        if cls._instance is None:
            cls._instance = cls()
        return cls._instance
    
    def set_page(self, page: ft.Page):
        """Set the page reference for theme updates."""
        self._page = page
    
    @property
    def is_dark(self) -> bool:
        return self._is_dark
    
    @property
    def colors(self) -> ColorScheme:
        return self._colors
    
    def toggle_theme(self):
        """Toggle between dark and light themes."""
        self._is_dark = not self._is_dark
        self._colors = DARK_THEME if self._is_dark else LIGHT_THEME
        if self._page:
            self._page.theme_mode = ft.ThemeMode.DARK if self._is_dark else ft.ThemeMode.LIGHT
            self._page.bgcolor = self._colors.background
            self._page.update()
    
    def set_dark_mode(self, is_dark: bool):
        """Set specific theme mode."""
        self._is_dark = is_dark
        self._colors = DARK_THEME if is_dark else LIGHT_THEME
        if self._page:
            self._page.theme_mode = ft.ThemeMode.DARK if is_dark else ft.ThemeMode.LIGHT
            self._page.bgcolor = self._colors.background
            self._page.update()


# Gradient Presets
class Gradients:
    """Predefined gradients for the app."""
    
    # Primary gradients
    BLUE_PURPLE = ["#58a6ff", "#a371f7"]
    BLUE_CYAN = ["#58a6ff", "#39d0d8"]
    PURPLE_PINK = ["#a371f7", "#f778ba"]
    GREEN_CYAN = ["#3fb950", "#39d0d8"]
    ORANGE_RED = ["#d29922", "#f85149"]
    
    # Status gradients
    SUCCESS = ["#238636", "#3fb950"]
    WARNING = ["#9e6a03", "#d29922"]
    DANGER = ["#da3633", "#f85149"]
    
    @staticmethod
    def linear(colors: list, begin=ft.Alignment(-1, 0), end=ft.Alignment(1, 0)):
        """Create a linear gradient."""
        return ft.LinearGradient(
            begin=begin,
            end=end,
            colors=colors
        )
    
    @staticmethod
    def radial(colors: list, center=ft.Alignment(0, 0), radius=1.0):
        """Create a radial gradient."""
        return ft.RadialGradient(
            center=center,
            radius=radius,
            colors=colors
        )


# Typography
class Typography:
    """Typography settings."""
    
    # Font sizes
    DISPLAY = 32
    HEADLINE = 24
    TITLE = 20
    SUBTITLE = 16
    BODY = 14
    CAPTION = 12
    SMALL = 10
    
    # Font weights
    BOLD = ft.FontWeight.BOLD
    SEMI_BOLD = ft.FontWeight.W_600
    MEDIUM = ft.FontWeight.W_500
    REGULAR = ft.FontWeight.NORMAL
    LIGHT = ft.FontWeight.W_300


# Spacing & Sizing
class Spacing:
    """Spacing constants."""
    
    # Padding/Margin
    XS = 4
    SM = 8
    MD = 12
    LG = 16
    XL = 24
    XXL = 32
    
    # Border radius
    RADIUS_SM = 4
    RADIUS_MD = 8
    RADIUS_LG = 12
    RADIUS_XL = 16
    RADIUS_FULL = 100


# Animation Durations
class AnimationDuration:
    """Animation duration constants in milliseconds."""
    
    INSTANT = 0
    FAST = 150
    NORMAL = 300
    SLOW = 500
    VERY_SLOW = 800


# Helper functions for creating themed components
def create_card(
    content: ft.Control,
    theme: ThemeManager = None,
    padding: int = Spacing.LG,
    border_radius: int = Spacing.RADIUS_LG,
    elevation: int = 0,
    gradient: list = None
) -> ft.Container:
    """Create a themed card container."""
    tm = theme or ThemeManager.get_instance()
    colors = tm.colors
    
    return ft.Container(
        content=content,
        bgcolor=colors.card if not gradient else None,
        gradient=Gradients.linear(gradient) if gradient else None,
        border=ft.border.all(1, colors.border),
        border_radius=border_radius,
        padding=padding,
        shadow=ft.BoxShadow(
            spread_radius=0,
            blur_radius=elevation * 2,
            color=ft.Colors.with_opacity(0.1, ft.Colors.BLACK),
            offset=ft.Offset(0, elevation)
        ) if elevation > 0 else None,
        animate=AnimationDuration.FAST
    )


def create_icon_button(
    icon: str,
    tooltip: str = None,
    on_click = None,
    size: int = 20,
    theme: ThemeManager = None
) -> ft.IconButton:
    """Create a themed icon button."""
    tm = theme or ThemeManager.get_instance()
    colors = tm.colors
    
    return ft.IconButton(
        icon=icon,
        icon_color=colors.text_secondary,
        tooltip=tooltip,
        on_click=on_click,
        icon_size=size,
        style=ft.ButtonStyle(
            overlay_color=ft.Colors.with_opacity(0.1, colors.primary)
        )
    )


def create_primary_button(
    text: str,
    icon: str = None,
    on_click = None,
    expand: bool = False,
    theme: ThemeManager = None
) -> ft.ElevatedButton:
    """Create a themed primary button."""
    tm = theme or ThemeManager.get_instance()
    colors = tm.colors
    
    return ft.ElevatedButton(
        text=text,
        icon=icon,
        on_click=on_click,
        expand=expand,
        bgcolor=colors.primary,
        color=colors.on_primary,
        style=ft.ButtonStyle(
            shape=ft.RoundedRectangleBorder(radius=Spacing.RADIUS_MD),
            animation_duration=AnimationDuration.FAST
        )
    )


def create_text(
    value: str,
    size: int = Typography.BODY,
    weight: ft.FontWeight = Typography.REGULAR,
    color: str = None,
    theme: ThemeManager = None
) -> ft.Text:
    """Create a themed text."""
    tm = theme or ThemeManager.get_instance()
    colors = tm.colors
    
    return ft.Text(
        value=value,
        size=size,
        weight=weight,
        color=color or colors.text_primary
    )


def create_badge(
    text: str,
    color: str = None,
    theme: ThemeManager = None
) -> ft.Container:
    """Create a small badge/chip."""
    tm = theme or ThemeManager.get_instance()
    colors = tm.colors
    
    bg_color = color or colors.primary
    
    return ft.Container(
        content=ft.Text(text, size=Typography.SMALL, color=colors.on_primary),
        bgcolor=bg_color,
        border_radius=Spacing.RADIUS_FULL,
        padding=ft.padding.symmetric(horizontal=Spacing.SM, vertical=2)
    )


def create_divider(theme: ThemeManager = None) -> ft.Divider:
    """Create a themed divider."""
    tm = theme or ThemeManager.get_instance()
    colors = tm.colors
    
    return ft.Divider(height=1, color=colors.divider)


# Export theme instance
theme = ThemeManager.get_instance()
