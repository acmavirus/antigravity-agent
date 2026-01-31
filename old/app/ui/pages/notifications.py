"""
Notifications Page for CustomTkinter
"""
import customtkinter as ctk
from ..theme import CTKColors, CTKTypography

class NotificationItem(ctk.CTkFrame):
    def __init__(self, master, title, message, type, **kwargs):
        super().__init__(master, fg_color=CTKColors.CARD, corner_radius=10, border_width=1, border_color=CTKColors.BORDER, **kwargs)
        
        status_color = CTKColors.PRIMARY
        if type == "warning": status_color = CTKColors.WARNING
        elif type == "danger": status_color = CTKColors.DANGER
        
        self.indicator = ctk.CTkFrame(self, width=4, fg_color=status_color)
        self.indicator.pack(side="left", fill="y")
        
        self.content = ctk.CTkFrame(self, fg_color="transparent")
        self.content.pack(side="left", fill="both", expand=True, padx=15, pady=10)
        
        self.title_label = ctk.CTkLabel(self.content, text=title, font=CTKTypography.BODY, text_color=CTKColors.TEXT_PRIMARY)
        self.title_label.pack(anchor="w")
        
        self.msg_label = ctk.CTkLabel(self.content, text=message, font=CTKTypography.SMALL, text_color=CTKColors.TEXT_SECONDARY, wraplength=500)
        self.msg_label.pack(anchor="w")

class NotificationsPage(ctk.CTkFrame):
    def __init__(self, master, **kwargs):
        super().__init__(master, fg_color="transparent", **kwargs)
        
        self.header = ctk.CTkLabel(self, text="Live Feed", font=CTKTypography.DISPLAY)
        self.header.pack(anchor="w", pady=(0, 20))
        
        self.list_frame = ctk.CTkScrollableFrame(self, fg_color="transparent", height=500)
        self.list_frame.pack(fill="both", expand=True)
        
    def update_notifications(self, notifications):
        for widget in self.list_frame.winfo_children():
            widget.destroy()
        for n in notifications:
            item = NotificationItem(self.list_frame, n.get('title'), n.get('message'), n.get('type'))
            item.pack(fill="x", pady=5)

    def add_notification(self, title, message, type="info"):
        item = NotificationItem(self.list_frame, title, message, type)
        item.pack(fill="x", pady=5)
