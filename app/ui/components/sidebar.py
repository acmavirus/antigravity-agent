"""
Sidebar Component for CustomTkinter
"""
import customtkinter as ctk
from ..theme import CTKColors, CTKTypography

class Sidebar(ctk.CTkFrame):
    def __init__(self, master, on_nav_change, **kwargs):
        super().__init__(master, width=240, corner_radius=0, fg_color=CTKColors.SURFACE, border_width=1, border_color=CTKColors.BORDER, **kwargs)
        
        self.on_nav_change = on_nav_change
        self.buttons = {}
        
        # Logo
        self.logo_label = ctk.CTkLabel(
            self, 
            text="ANTIGRAVITY", 
            font=ctk.CTkFont(family="Inter", size=20, weight="bold"),
            text_color=CTKColors.PRIMARY
        )
        self.logo_label.pack(pady=(30, 40), padx=20)
        
        # Nav Items
        self.add_nav_item("Dashboard", "dashboard")
        self.add_nav_item("Accounts", "accounts")
        self.add_nav_item("Quota", "quota")
        self.add_nav_item("Notifications", "notifications")
        self.add_nav_item("Settings", "settings")
        
        # Theme Toggle at bottom
        self.theme_btn = ctk.CTkButton(
            self,
            text="Toggle Appearance",
            fg_color="transparent",
            text_color=CTKColors.TEXT_SECONDARY,
            hover_color=CTKColors.CARD,
            command=self._toggle_theme
        )
        self.theme_btn.pack(side="bottom", pady=20, padx=20, fill="x")

    def add_nav_item(self, text, nav_id):
        btn = ctk.CTkButton(
            self,
            text=text,
            anchor="w",
            fg_color="transparent",
            text_color=CTKColors.TEXT_SECONDARY,
            hover_color=CTKColors.CARD,
            height=40,
            font=ctk.CTkFont(family="Inter", size=14),
            command=lambda: self._handle_click(nav_id)
        )
        btn.pack(pady=5, padx=15, fill="x")
        self.buttons[nav_id] = btn

    def update_badge(self, nav_id, count):
        if nav_id in self.buttons:
            text = self.buttons[nav_id].cget("text").split(" (")[0]
            if count > 0:
                self.buttons[nav_id].configure(text=f"{text} ({count})")
            else:
                self.buttons[nav_id].configure(text=text)

    def _handle_click(self, nav_id):
        # Reset all buttons
        for bid, btn in self.buttons.items():
            btn.configure(fg_color="transparent", text_color=CTKColors.TEXT_SECONDARY)
            
        # Highlight selected
        self.buttons[nav_id].configure(fg_color=CTKColors.PRIMARY, text_color=CTKColors.TEXT_ON_PRIMARY)
        
        if self.on_nav_change:
            self.on_nav_change(nav_id)

    def _toggle_theme(self):
        # For now just print, usually handled by main window
        pass
