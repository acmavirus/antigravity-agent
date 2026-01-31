"""
Quota Detail Page for CustomTkinter
"""
import customtkinter as ctk
from ..theme import CTKColors, CTKTypography

class QuotaCard(ctk.CTkFrame):
    def __init__(self, master, model_name, percentage, **kwargs):
        super().__init__(master, fg_color=CTKColors.CARD, corner_radius=12, border_width=1, border_color=CTKColors.BORDER, **kwargs)
        
        self.model_label = ctk.CTkLabel(self, text=model_name, font=CTKTypography.SUBTITLE, text_color=CTKColors.TEXT_PRIMARY)
        self.model_label.pack(pady=(15, 0), padx=20, anchor="w")
        
        self.progress = ctk.CTkProgressBar(self, height=8, progress_color=CTKColors.PRIMARY if percentage > 20 else CTKColors.DANGER)
        self.progress.set(percentage / 100)
        self.progress.pack(pady=(10, 5), padx=20, fill="x")
        
        self.pct_label = ctk.CTkLabel(self, text=f"{percentage}% remaining", font=CTKTypography.SMALL, text_color=CTKColors.TEXT_SECONDARY)
        self.pct_label.pack(pady=(0, 15), padx=20, anchor="e")

class QuotaDetailPage(ctk.CTkFrame):
    def __init__(self, master, **kwargs):
        super().__init__(master, fg_color="transparent", **kwargs)
        
        self.header = ctk.CTkLabel(self, text="Quota Analytics", font=CTKTypography.DISPLAY)
        self.header.pack(anchor="w", pady=(0, 20))
        
        self.scroll_frame = ctk.CTkScrollableFrame(self, fg_color="transparent")
        self.scroll_frame.pack(fill="both", expand=True)
        
    def update_quotas(self, quotas):
        for widget in self.scroll_frame.winfo_children():
            widget.destroy()
            
        for q in quotas:
            card = QuotaCard(self.scroll_frame, q.get('model_name'), q.get('percentage'))
            card.pack(fill="x", pady=10)
