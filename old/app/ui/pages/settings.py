"""
Settings Page for CustomTkinter
"""
import customtkinter as ctk
from ..theme import CTKColors, CTKTypography

class SettingsPage(ctk.CTkFrame):
    def __init__(self, master, on_save_path=None, **kwargs):
        super().__init__(master, fg_color="transparent", **kwargs)
        self.on_save_path = on_save_path
        
        # Header
        self.header = ctk.CTkLabel(self, text="Preferences", font=CTKTypography.DISPLAY)
        self.header.pack(anchor="w", pady=(0, 20))
        
        # Environment Section
        env_frame = self._create_section("Core Environment")
        
        self.path_entry = ctk.CTkEntry(env_frame, placeholder_text="Antigravity Path", width=400)
        self.path_entry.pack(side="left", padx=(0, 10))
        
        self.save_btn = ctk.CTkButton(env_frame, text="Save", width=80, fg_color=CTKColors.PRIMARY, command=self._handle_save)
        self.save_btn.pack(side="left")
        
        # Sync Section
        sync_frame = self._create_section("Background Sync")
        
        self.sync_switch = ctk.CTkSwitch(sync_frame, text="Auto-rotate identities", progress_color=CTKColors.PRIMARY)
        self.sync_switch.pack(anchor="w")
        
        self.interval_label = ctk.CTkLabel(sync_frame, text="Sync Interval")
        self.interval_label.pack(anchor="w", pady=(10, 0))
        
        self.interval_option = ctk.CTkOptionMenu(sync_frame, values=["1 Minute", "5 Minutes", "1 Hour"], fg_color=CTKColors.SURFACE)
        self.interval_option.pack(anchor="w", pady=5)

    def _handle_save(self):
        if self.on_save_path:
            self.on_save_path(self.path_entry.get())

    def _create_section(self, title):
        frame = ctk.CTkFrame(self, fg_color=CTKColors.SURFACE, corner_radius=12, border_width=1, border_color=CTKColors.BORDER)
        frame.pack(fill="x", pady=10, padx=2)
        
        label = ctk.CTkLabel(frame, text=title, font=CTKTypography.SUBTITLE, text_color=CTKColors.PRIMARY)
        label.pack(anchor="w", padx=20, pady=(15, 10))
        
        inner_frame = ctk.CTkFrame(frame, fg_color="transparent")
        inner_frame.pack(fill="x", padx=20, pady=(0, 15))
        
        return inner_frame
