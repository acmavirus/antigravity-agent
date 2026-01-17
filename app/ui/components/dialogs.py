"""
Dialog Components
Confirmation dialogs, input dialogs, and modal helpers
"""
import flet as ft
from typing import Callable, Optional, List
from app.ui.theme import ThemeManager, Spacing, Typography, AnimationDuration, Gradients


class ConfirmDialog(ft.AlertDialog):
    """Modern confirmation dialog."""
    
    def __init__(
        self,
        title: str,
        message: str,
        confirm_text: str = "Xác nhận",
        cancel_text: str = "Hủy",
        on_confirm: Callable = None,
        on_cancel: Callable = None,
        danger: bool = False,
        icon: str = None,
        theme: ThemeManager = None
    ):
        self.tm = theme or ThemeManager.get_instance()
        colors = self.tm.colors
        
        # Icon
        dialog_icon = icon or (ft.Icons.WARNING if danger else ft.Icons.HELP_OUTLINE)
        icon_color = colors.danger if danger else colors.primary
        
        # Content
        content = ft.Column([
            ft.Container(
                content=ft.Icon(dialog_icon, color=icon_color, size=48),
                alignment=ft.Alignment(0, 0),
                padding=Spacing.MD
            ),
            ft.Text(
                message,
                size=Typography.BODY,
                color=colors.text_secondary,
                text_align=ft.TextAlign.CENTER
            )
        ], horizontal_alignment=ft.CrossAxisAlignment.CENTER, spacing=Spacing.MD)
        
        # Actions
        actions = [
            ft.TextButton(
                cancel_text,
                on_click=lambda e: self._handle_cancel(on_cancel),
                style=ft.ButtonStyle(color=colors.text_secondary)
            ),
            ft.ElevatedButton(
                confirm_text,
                on_click=lambda e: self._handle_confirm(on_confirm),
                bgcolor=colors.danger if danger else colors.primary,
                color=colors.on_primary,
                style=ft.ButtonStyle(
                    shape=ft.RoundedRectangleBorder(radius=Spacing.RADIUS_MD)
                )
            )
        ]
        
        super().__init__(
            title=ft.Text(title, size=Typography.TITLE, weight=Typography.SEMI_BOLD, color=colors.text_primary),
            content=content,
            actions=actions,
            actions_alignment=ft.MainAxisAlignment.END,
            modal=True,
            bgcolor=colors.surface
        )
    
    def _handle_confirm(self, callback):
        self.open = False
        if self.page:
            self.page.update()
        if callback:
            callback()
    
    def _handle_cancel(self, callback):
        self.open = False
        if self.page:
            self.page.update()
        if callback:
            callback()


class InputDialog(ft.AlertDialog):
    """Modern input dialog with text field."""
    
    def __init__(
        self,
        title: str,
        label: str = "",
        hint: str = "",
        initial_value: str = "",
        confirm_text: str = "OK",
        cancel_text: str = "Hủy",
        on_submit: Callable[[str], None] = None,
        on_cancel: Callable = None,
        password: bool = False,
        multiline: bool = False,
        theme: ThemeManager = None
    ):
        self.tm = theme or ThemeManager.get_instance()
        colors = self.tm.colors
        
        # Input field
        self.input_field = ft.TextField(
            label=label,
            hint_text=hint,
            value=initial_value,
            password=password,
            multiline=multiline,
            min_lines=3 if multiline else 1,
            max_lines=5 if multiline else 1,
            border_color=colors.border,
            focused_border_color=colors.primary,
            cursor_color=colors.primary,
            text_style=ft.TextStyle(color=colors.text_primary),
            label_style=ft.TextStyle(color=colors.text_secondary),
            expand=True
        )
        
        # Actions
        actions = [
            ft.TextButton(
                cancel_text,
                on_click=lambda e: self._handle_cancel(on_cancel),
                style=ft.ButtonStyle(color=colors.text_secondary)
            ),
            ft.ElevatedButton(
                confirm_text,
                on_click=lambda e: self._handle_submit(on_submit),
                bgcolor=colors.primary,
                color=colors.on_primary,
                style=ft.ButtonStyle(
                    shape=ft.RoundedRectangleBorder(radius=Spacing.RADIUS_MD)
                )
            )
        ]
        
        super().__init__(
            title=ft.Text(title, size=Typography.TITLE, weight=Typography.SEMI_BOLD, color=colors.text_primary),
            content=ft.Container(
                content=self.input_field,
                width=400,
                padding=ft.padding.only(top=Spacing.MD)
            ),
            actions=actions,
            actions_alignment=ft.MainAxisAlignment.END,
            modal=True,
            bgcolor=colors.surface
        )
    
    def _handle_submit(self, callback):
        value = self.input_field.value
        self.open = False
        if self.page:
            self.page.update()
        if callback:
            callback(value)
    
    def _handle_cancel(self, callback):
        self.open = False
        if self.page:
            self.page.update()
        if callback:
            callback()


class SelectDialog(ft.AlertDialog):
    """Selection dialog with options list."""
    
    def __init__(
        self,
        title: str,
        options: List[dict],  # [{value, label, icon?, description?}]
        on_select: Callable[[str], None] = None,
        on_cancel: Callable = None,
        cancel_text: str = "Hủy",
        theme: ThemeManager = None
    ):
        self.tm = theme or ThemeManager.get_instance()
        colors = self.tm.colors
        self.on_select = on_select
        
        # Build option list
        option_list = []
        for opt in options:
            option_list.append(
                ft.Container(
                    content=ft.Row([
                        ft.Icon(
                            opt.get("icon", ft.Icons.CIRCLE),
                            color=colors.primary,
                            size=20
                        ) if opt.get("icon") else ft.Container(width=20),
                        ft.Column([
                            ft.Text(
                                opt.get("label", opt.get("value")),
                                size=Typography.BODY,
                                color=colors.text_primary
                            ),
                            ft.Text(
                                opt.get("description", ""),
                                size=Typography.CAPTION,
                                color=colors.text_muted
                            ) if opt.get("description") else ft.Container(height=0)
                        ], spacing=0, expand=True)
                    ], spacing=Spacing.MD),
                    padding=Spacing.MD,
                    border_radius=Spacing.RADIUS_MD,
                    on_click=lambda e, v=opt.get("value"): self._handle_select(v),
                    on_hover=lambda e: self._handle_hover(e),
                    ink=True
                )
            )
        
        content = ft.Container(
            content=ft.Column(option_list, spacing=Spacing.XS, scroll=ft.ScrollMode.AUTO),
            width=350,
            height=min(len(options) * 60, 300)
        )
        
        actions = [
            ft.TextButton(
                cancel_text,
                on_click=lambda e: self._handle_cancel(on_cancel),
                style=ft.ButtonStyle(color=colors.text_secondary)
            )
        ]
        
        super().__init__(
            title=ft.Text(title, size=Typography.TITLE, weight=Typography.SEMI_BOLD, color=colors.text_primary),
            content=content,
            actions=actions,
            actions_alignment=ft.MainAxisAlignment.END,
            modal=True,
            bgcolor=colors.surface
        )
    
    def _handle_select(self, value):
        self.open = False
        if self.page:
            self.page.update()
        if self.on_select:
            self.on_select(value)
    
    def _handle_cancel(self, callback):
        self.open = False
        if self.page:
            self.page.update()
        if callback:
            callback()
    
    def _handle_hover(self, e: ft.ControlEvent):
        colors = self.tm.colors
        e.control.bgcolor = ft.Colors.with_opacity(0.05, colors.primary) if e.data == "true" else None
        e.control.update()


class LoadingOverlay(ft.Container):
    """Loading overlay with spinner and message."""
    
    def __init__(
        self,
        message: str = "Đang tải...",
        theme: ThemeManager = None
    ):
        self.tm = theme or ThemeManager.get_instance()
        colors = self.tm.colors
        
        super().__init__(
            content=ft.Column([
                ft.ProgressRing(
                    color=colors.primary,
                    stroke_width=3,
                    width=40,
                    height=40
                ),
                ft.Text(
                    message,
                    size=Typography.BODY,
                    color=colors.text_secondary
                )
            ], alignment=ft.MainAxisAlignment.CENTER, horizontal_alignment=ft.CrossAxisAlignment.CENTER, spacing=Spacing.LG),
            bgcolor=ft.Colors.with_opacity(0.8, colors.background),
            alignment=ft.Alignment(0, 0),
            expand=True,
            visible=False
        )
    
    def show(self, message: str = None):
        """Show the loading overlay."""
        if message:
            self.content.controls[1].value = message
        self.visible = True
        self.update()
    
    def hide(self):
        """Hide the loading overlay."""
        self.visible = False
        self.update()
