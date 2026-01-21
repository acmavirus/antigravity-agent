"""
Dashboard Page for CustomTkinter
"""
import customtkinter as ctk
from ..theme import CTKColors, CTKTypography

class DashboardPage(ctk.CTkFrame):
    def __init__(self, master, **kwargs):
        super().__init__(master, fg_color="transparent", **kwargs)
        
        # Header
        self.header_label = ctk.CTkLabel(
            self, 
            text="Overview", 
            font=ctk.CTkFont(family="Inter", size=32, weight="bold"),
            text_color=CTKColors.TEXT_PRIMARY
        )
        self.header_label.pack(anchor="w", pady=(0, 20))
        
        # Stats Container
        self.stats_frame = ctk.CTkFrame(self, fg_color="transparent")
        self.stats_frame.pack(fill="x", pady=10)
        
        # Identity Card
        self.identity_card = self._create_card(
            self.stats_frame, 
            "Active Session", 
            "Checking account...", 
            CTKColors.PRIMARY
        )
        self.identity_card.pack(side="left", padx=(0, 20), expand=True, fill="both")
        
        # Agent Status Card
        self.status_card = self._create_card(
            self.stats_frame, 
            "Agent Status", 
            "Standby", 
            CTKColors.SUCCESS
        )
        self.status_card.pack(side="left", expand=True, fill="both")

        # Quota Section
        self.quota_label = ctk.CTkLabel(self, text="AI Quota usage", font=CTKTypography.SUBTITLE, text_color=CTKColors.TEXT_PRIMARY)
        self.quota_label.pack(anchor="w", pady=(30, 10))

        self.quota_frame = ctk.CTkFrame(self, fg_color=CTKColors.CARD, corner_radius=12, border_width=1, border_color=CTKColors.BORDER)
        self.quota_frame.pack(fill="x", pady=10)
        
        # Grid for quotas (2x2)
        self.quota_grid = ctk.CTkFrame(self.quota_frame, fg_color="transparent")
        self.quota_grid.pack(fill="both", expand=True, padx=20, pady=20)
        
        self.model_widgets = {}
        for i, model in enumerate(["Gemini Pro", "Gemini Flash", "Claude 3.5 Sonnet", "Image Generation"]):
            m_frame = ctk.CTkFrame(self.quota_grid, fg_color="transparent")
            m_frame.grid(row=i//2, column=i%2, sticky="nsew", padx=10, pady=10)
            self.quota_grid.grid_columnconfigure(i%2, weight=1)
            
            lbl = ctk.CTkLabel(m_frame, text=model, font=CTKTypography.BODY, text_color=CTKColors.TEXT_SECONDARY)
            lbl.pack(anchor="w")
            
            prog = ctk.CTkProgressBar(m_frame, height=8, fg_color=CTKColors.SURFACE_VARIANT, progress_color=CTKColors.PRIMARY)
            prog.set(0)
            prog.pack(fill="x", pady=(5, 2))
            
            val_lbl = ctk.CTkLabel(m_frame, text="0%", font=CTKTypography.TINY, text_color=CTKColors.TEXT_MUTED)
            val_lbl.pack(anchor="e")
            
            self.model_widgets[model] = {"bar": prog, "label": val_lbl}

        # Action Buttons
        self.actions_label = ctk.CTkLabel(self, text="Quick Commands", font=CTKTypography.SUBTITLE, text_color=CTKColors.TEXT_PRIMARY)
        self.actions_label.pack(anchor="w", pady=(30, 10))

        self.btn_frame = ctk.CTkFrame(self, fg_color="transparent")
        self.btn_frame.pack(fill="x")

        self.save_btn = ctk.CTkButton(self.btn_frame, text="Save Current Session", fg_color=CTKColors.PRIMARY, height=45)
        self.save_btn.pack(side="left", padx=(0, 10), expand=True, fill="x")

        self.stop_btn = ctk.CTkButton(self.btn_frame, text="Stop All Antigravity", fg_color=CTKColors.DANGER, height=45)
        self.stop_btn.pack(side="left", expand=True, fill="x")

    def update_quotas(self, model_data):
        """
        model_data: list of dicts with model_name and percentage
        """
        for m in self.model_widgets:
            self.model_widgets[m]["bar"].set(0)
            self.model_widgets[m]["label"].configure(text="0%")

        for item in model_data:
            name = item.get("model_name", "")
            perc = item.get("percentage", 0)
            
            target_key = None
            if "Gemini" in name and "Pro" in name: target_key = "Gemini Pro"
            elif "Gemini" in name and "Flash" in name: target_key = "Gemini Flash"
            elif "Claude" in name: target_key = "Claude 3.5 Sonnet"
            elif "Image" in name: target_key = "Image Generation"
            
            if target_key:
                self.model_widgets[target_key]["bar"].set(perc / 100)
                self.model_widgets[target_key]["label"].configure(text=f"{perc}%")

    def _create_card(self, master, title, value, color):
        card = ctk.CTkFrame(master, fg_color=CTKColors.SURFACE, corner_radius=15, border_width=1, border_color=CTKColors.BORDER)
        
        title_label = ctk.CTkLabel(card, text=title, font=CTKTypography.SMALL, text_color=CTKColors.TEXT_MUTED)
        title_label.pack(pady=(15, 0), padx=20, anchor="w")
        
        val_label = ctk.CTkLabel(card, text=value, font=CTKTypography.TITLE, text_color=CTKColors.TEXT_PRIMARY)
        val_label.pack(pady=(5, 15), padx=20, anchor="w")
        
        indicator = ctk.CTkFrame(card, height=4, width=40, fg_color=color, corner_radius=2)
        indicator.pack(pady=(0, 15), padx=20, anchor="w")
        
        return card

    def update_session(self, email, plan):
        self.identity_card.winfo_children()[1].configure(text=email)
        # Could add more labels for plan
