"""
Accounts Page for CustomTkinter
"""
import customtkinter as ctk
from ..theme import CTKColors, CTKTypography

class AccountCard(ctk.CTkFrame):
    def __init__(self, master, email, plan, is_active, on_switch, on_delete, **kwargs):
        super().__init__(master, fg_color=CTKColors.CARD, corner_radius=12, border_width=1, border_color=CTKColors.PRIMARY if is_active else CTKColors.BORDER, **kwargs)
        
        self.email = email
        self.on_switch = on_switch
        self.on_delete = on_delete
        
        # Email
        self.email_label = ctk.CTkLabel(self, text=email, font=CTKTypography.SUBTITLE, text_color=CTKColors.TEXT_PRIMARY)
        self.email_label.pack(pady=(15, 0), padx=15, anchor="w")
        
        # Details row
        self.details_row = ctk.CTkFrame(self, fg_color="transparent")
        self.details_row.pack(fill="x", padx=15, pady=(5, 15))
        
        # Plan Badge
        self.plan_frame = ctk.CTkFrame(self.details_row, fg_color=CTKColors.PRIMARY if is_active else CTKColors.SURFACE_VARIANT, corner_radius=10)
        self.plan_frame.pack(side="left")
        
        self.plan_label = ctk.CTkLabel(self.plan_frame, text=plan.upper(), font=CTKTypography.TINY, text_color=CTKColors.TEXT_ON_PRIMARY if is_active else CTKColors.TEXT_SECONDARY)
        self.plan_label.pack(padx=8, pady=2)
        
        # Action Buttons container (visible on hover would be cool, but let's keep it simple for now)
        self.actions_frame = ctk.CTkFrame(self, fg_color="transparent")
        self.actions_frame.pack(fill="x", padx=15, pady=(0, 15))
        
        self.switch_btn = ctk.CTkButton(
            self.actions_frame, 
            text="Switch Account", 
            height=32,
            fg_color=CTKColors.PRIMARY if not is_active else CTKColors.SURFACE_VARIANT,
            state="normal" if not is_active else "disabled",
            command=lambda: self.on_switch(email)
        )
        self.switch_btn.pack(side="left", expand=True, fill="x", padx=(0, 5))
        
        self.delete_btn = ctk.CTkButton(
            self.actions_frame, 
            text="×", 
            width=32, 
            height=32, 
            fg_color=CTKColors.SURFACE_VARIANT,
            hover_color=CTKColors.DANGER,
            command=lambda: self.on_delete(email)
        )
        self.delete_btn.pack(side="right")

class AccountsPage(ctk.CTkFrame):
    def __init__(self, master, on_switch=None, on_delete=None, on_import=None, on_export=None, **kwargs):
        super().__init__(master, fg_color="transparent", **kwargs)
        self.on_switch_cb = on_switch
        self.on_delete_cb = on_delete
        self.on_import_cb = on_import
        self.on_export_cb = on_export
        
        # Header
        self.header_row = ctk.CTkFrame(self, fg_color="transparent")
        self.header_row.pack(fill="x", pady=(0, 20))
        
        self.header = ctk.CTkLabel(self.header_row, text="Account Manager", font=CTKTypography.HEADLINE)
        self.header.pack(side="left")

        self.export_btn = ctk.CTkButton(self.header_row, text="Export", width=80, fg_color=CTKColors.SURFACE_VARIANT, command=self.on_export_cb)
        self.export_btn.pack(side="right", padx=(10, 0))

        self.import_btn = ctk.CTkButton(self.header_row, text="Import", width=80, fg_color=CTKColors.SURFACE_VARIANT, command=self.on_import_cb)
        self.import_btn.pack(side="right")
        
        # Search
        self.search_entry = ctk.CTkEntry(self, placeholder_text="Search account email...", width=400, height=40)
        self.search_entry.pack(anchor="w", pady=(0, 20))
        self.search_entry.bind("<KeyRelease>", self._on_search)
        
        # Scrollable Grid
        self.scroll_frame = ctk.CTkScrollableFrame(self, fg_color="transparent", height=500)
        self.scroll_frame.pack(fill="both", expand=True)
        
        # Layout accounts in grid
        self.grid_container = ctk.CTkFrame(self.scroll_frame, fg_color="transparent")
        self.grid_container.pack(fill="both", expand=True)
        
        self.all_accounts = []
        
    def _on_search(self, event=None):
        query = self.search_entry.get().lower()
        filtered = [acc for acc in self.all_accounts if query in acc.get('email', '').lower()]
        self._display_accounts(filtered)

    def update_accounts(self, accounts):
        self.all_accounts = accounts
        self._on_search()
            
    def _display_accounts(self, accounts):
        for widget in self.grid_container.winfo_children():
            widget.destroy()
            
        for i, acc in enumerate(accounts):
            card = AccountCard(
                self.grid_container, 
                acc.get('email'), 
                acc.get('plan'), 
                acc.get('is_active'),
                on_switch=self.on_switch_cb,
                on_delete=self.on_delete_cb
            )
            card.grid(row=i // 3, column=i % 3, padx=10, pady=10, sticky="nsew")
            self.grid_container.grid_columnconfigure(i % 3, weight=1)
