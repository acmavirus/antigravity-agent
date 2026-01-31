"""
CustomTkinter Theme for Antigravity Agent
OLED-optimized colors and modern typography.
"""
import customtkinter as ctk

class CTKColors:
    # Backgrounds
    BACKGROUND = "#050505"
    SURFACE = "#0f0f0f"
    SURFACE_VARIANT = "#1a1a1a"
    CARD = "#121212"
    DIVIDER = "#1e293b"
    
    # Primaries
    PRIMARY = "#3b82f6"
    PRIMARY_HOVER = "#2563eb"
    TEXT_ON_PRIMARY = "#ffffff"
    
    # Accents
    ACCENT = "#8b5cf6"
    
    # Semantic
    SUCCESS = "#10b981"
    WARNING = "#f59e0b"
    DANGER = "#ef4444"
    INFO = "#3b82f6"
    
    # Text
    TEXT_PRIMARY = "#f8fafc"
    TEXT_SECONDARY = "#94a3b8"
    TEXT_MUTED = "#64748b"
    
    # Border
    BORDER = "#1e293b"

class CTKTypography:
    DISPLAY = ("Inter", 32, "bold")
    HEADLINE = ("Inter", 24, "bold")
    TITLE = ("Inter", 20, "bold")
    SUBTITLE = ("Inter", 16, "bold")
    BODY = ("Inter", 14, "normal")
    SMALL = ("Inter", 12, "normal")
    TINY = ("Inter", 10, "normal")

def setup_theme():
    ctk.set_appearance_mode("dark")
    # CustomTkinter doesn't support full custom color objects as easily as Flet,
    # so we will use these constants when creating widgets.
