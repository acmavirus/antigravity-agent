"""
Toast Notification Component
In-app toast notifications with animations
"""
import flet as ft
import threading
from typing import Optional, Callable
from dataclasses import dataclass
from datetime import datetime
from app.ui.theme import ThemeManager, Spacing, Typography, AnimationDuration


@dataclass
class ToastData:
    """Toast notification data."""
    id: str
    title: str
    message: str
    toast_type: str  # success, warning, danger, info
    timestamp: datetime
    duration: int  # milliseconds, 0 = persistent
    on_dismiss: Optional[Callable] = None


class Toast(ft.Container):
    """Single toast notification component."""
    
    def __init__(
        self,
        data: ToastData,
        on_close: Callable = None,
        theme: ThemeManager = None
    ):
        super().__init__()
        
        self.data = data
        self.on_close = on_close
        self.tm = theme or ThemeManager.get_instance()
        
        self._build()
    
    def _get_type_config(self) -> tuple:
        """Get icon and color based on toast type."""
        colors = self.tm.colors
        configs = {
            "success": (ft.Icons.CHECK_CIRCLE, colors.success),
            "warning": (ft.Icons.WARNING, colors.warning),
            "danger": (ft.Icons.ERROR, colors.danger),
            "info": (ft.Icons.INFO, colors.info),
            "reset": (ft.Icons.REFRESH, colors.accent)
        }
        return configs.get(self.data.toast_type, (ft.Icons.INFO, colors.info))
    
    def _build(self):
        """Build the toast UI."""
        colors = self.tm.colors
        icon, accent_color = self._get_type_config()
        
        # Time text
        time_str = self.data.timestamp.strftime("%H:%M:%S")
        
        self.content = ft.Row([
            ft.Container(
                content=ft.Icon(icon, color=colors.on_primary, size=18),
                width=32,
                height=32,
                border_radius=Spacing.RADIUS_MD,
                bgcolor=accent_color,
                alignment=ft.Alignment(0, 0)
            ),
            ft.Column([
                ft.Text(
                    self.data.title,
                    size=Typography.BODY,
                    weight=Typography.SEMI_BOLD,
                    color=colors.text_primary
                ),
                ft.Text(
                    self.data.message,
                    size=Typography.CAPTION,
                    color=colors.text_secondary,
                    max_lines=2,
                    overflow=ft.TextOverflow.ELLIPSIS
                ),
                ft.Text(
                    time_str,
                    size=Typography.SMALL,
                    color=colors.text_muted
                )
            ], spacing=2, expand=True),
            ft.IconButton(
                icon=ft.Icons.CLOSE,
                icon_color=colors.text_muted,
                icon_size=16,
                on_click=self._handle_close,
                tooltip="Dismiss"
            )
        ], spacing=Spacing.MD)
        
        self.bgcolor = colors.card
        self.border = ft.border.all(1, accent_color)
        self.border_radius = Spacing.RADIUS_LG
        self.padding = Spacing.MD
        self.shadow = ft.BoxShadow(
            spread_radius=0,
            blur_radius=12,
            color=ft.Colors.with_opacity(0.2, accent_color),
            offset=ft.Offset(0, 4)
        )
        self.animate = AnimationDuration.NORMAL
        self.animate_opacity = AnimationDuration.FAST
        self.opacity = 1.0
    
    def _handle_close(self, e):
        """Handle close button click."""
        self.opacity = 0
        self.update()
        if self.on_close:
            self.on_close(self.data.id)
        if self.data.on_dismiss:
            self.data.on_dismiss()


class ToastManager:
    """Manages toast notifications display."""
    
    _instance: Optional['ToastManager'] = None
    
    def __init__(self, page: ft.Page = None):
        self._page = page
        self._toasts: list[ToastData] = []
        self._toast_container: Optional[ft.Column] = None
        self._counter = 0
        self.tm = ThemeManager.get_instance()
    
    @classmethod
    def get_instance(cls, page: ft.Page = None) -> 'ToastManager':
        if cls._instance is None:
            cls._instance = cls(page)
        elif page:
            cls._instance._page = page
        return cls._instance
    
    def set_page(self, page: ft.Page):
        """Set the page reference."""
        self._page = page
    
    def set_container(self, container: ft.Column):
        """Set the container for toasts."""
        self._toast_container = container
    
    def show(
        self,
        title: str,
        message: str,
        toast_type: str = "info",
        duration: int = 5000,
        on_dismiss: Callable = None
    ) -> str:
        """Show a toast notification."""
        self._counter += 1
        toast_id = f"toast_{self._counter}"
        
        data = ToastData(
            id=toast_id,
            title=title,
            message=message,
            toast_type=toast_type,
            timestamp=datetime.now(),
            duration=duration,
            on_dismiss=on_dismiss
        )
        
        self._toasts.append(data)
        
        if self._toast_container:
            toast = Toast(
                data=data,
                on_close=self._remove_toast,
                theme=self.tm
            )
            self._toast_container.controls.insert(0, toast)
            
            try:
                self._toast_container.update()
            except:
                pass
            
            # Auto dismiss after duration
            if duration > 0:
                def auto_dismiss():
                    import time
                    time.sleep(duration / 1000)
                    self._remove_toast(toast_id)
                
                threading.Thread(target=auto_dismiss, daemon=True).start()
        
        return toast_id
    
    def _remove_toast(self, toast_id: str):
        """Remove a toast by ID."""
        self._toasts = [t for t in self._toasts if t.id != toast_id]
        
        if self._toast_container:
            for control in self._toast_container.controls[:]:
                if isinstance(control, Toast) and control.data.id == toast_id:
                    self._toast_container.controls.remove(control)
                    break
            
            try:
                self._toast_container.update()
            except:
                pass
    
    def clear_all(self):
        """Clear all toasts."""
        self._toasts.clear()
        if self._toast_container:
            self._toast_container.controls.clear()
            try:
                self._toast_container.update()
            except:
                pass
    
    def success(self, title: str, message: str, duration: int = 5000):
        """Show a success toast."""
        return self.show(title, message, "success", duration)
    
    def warning(self, title: str, message: str, duration: int = 5000):
        """Show a warning toast."""
        return self.show(title, message, "warning", duration)
    
    def danger(self, title: str, message: str, duration: int = 5000):
        """Show a danger/error toast."""
        return self.show(title, message, "danger", duration)
    
    def info(self, title: str, message: str, duration: int = 5000):
        """Show an info toast."""
        return self.show(title, message, "info", duration)
