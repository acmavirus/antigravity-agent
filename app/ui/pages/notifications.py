"""
Notifications Page
Notification history and management
"""
import flet as ft
from typing import Callable, List, Optional
from datetime import datetime
from app.ui.theme import ThemeManager, Spacing, Typography, AnimationDuration


class NotificationsPage(ft.Container):
    """Notifications page with history and filters."""
    
    def __init__(
        self,
        notifications: List[dict] = None,  # [{title, message, type, timestamp}]
        on_clear_all: Callable = None,
        on_dismiss: Callable[[str], None] = None,
        theme: ThemeManager = None
    ):
        super().__init__()
        
        self.notifications = notifications or []
        self.on_clear_all = on_clear_all
        self.on_dismiss = on_dismiss
        self.tm = theme or ThemeManager.get_instance()
        
        self._filter = "all"  # all, reset, warning, info, success, danger
        self._time_filter = "all_time"  # all_time, today, week, month
        self._build()
    
    def _build(self):
        """Build the notifications page."""
        colors = self.tm.colors
        
        # Header
        header = ft.Row([
            ft.Column([
                ft.Text(
                    "Thông báo",
                    size=Typography.DISPLAY,
                    weight=Typography.BOLD,
                    color=colors.text_primary
                ),
                ft.Text(
                    f"{len(self.notifications)} thông báo",
                    size=Typography.BODY,
                    color=colors.text_secondary
                )
            ], spacing=Spacing.XS),
            ft.Container(expand=True),
            ft.OutlinedButton(
                "Xóa tất cả",
                icon=ft.Icons.DELETE_SWEEP,
                style=ft.ButtonStyle(color=colors.danger),
                on_click=lambda e: self._handle_clear_all()
            ) if self.notifications else ft.Container()
        ])
        
        # Filter tabs - Type filters
        type_filter_tabs = ft.Row([
            self._build_filter_chip("all", "Tất cả", len(self.notifications)),
            self._build_filter_chip("reset", "Reset", len([n for n in self.notifications if n.get("type") == "reset"])),
            self._build_filter_chip("warning", "Cảnh báo", len([n for n in self.notifications if n.get("type") == "warning"])),
            self._build_filter_chip("success", "Thành công", len([n for n in self.notifications if n.get("type") == "success"])),
            self._build_filter_chip("danger", "Lỗi", len([n for n in self.notifications if n.get("type") == "danger"])),
        ], spacing=Spacing.SM, wrap=True)
        
        # Time-based filters
        time_filter_tabs = ft.Row([
            ft.Text("Thời gian:", size=Typography.CAPTION, color=colors.text_muted, weight=Typography.SEMI_BOLD),
            self._build_time_filter_chip("all_time", "Tất cả"),
            self._build_time_filter_chip("today", "Hôm nay"),
            self._build_time_filter_chip("week", "Tuần này"),
            self._build_time_filter_chip("month", "Tháng này"),
        ], spacing=Spacing.SM)
        
        # Filter notifications
        filtered = self._apply_filters(self.notifications)
        
        # Notification list
        if not filtered:
            content = ft.Container(
                content=ft.Column([
                    ft.Icon(ft.Icons.NOTIFICATIONS_OFF, color=colors.text_muted, size=64),
                    ft.Text(
                        "Không có thông báo",
                        size=Typography.TITLE,
                        weight=Typography.SEMI_BOLD,
                        color=colors.text_secondary
                    ),
                    ft.Text(
                        "Các thông báo về quota reset và cảnh báo sẽ hiển thị ở đây",
                        size=Typography.BODY,
                        color=colors.text_muted,
                        text_align=ft.TextAlign.CENTER
                    )
                ], alignment=ft.MainAxisAlignment.CENTER, horizontal_alignment=ft.CrossAxisAlignment.CENTER, spacing=Spacing.SM),
                alignment=ft.Alignment(0, 0),
                expand=True
            )
        else:
            # Group by date
            grouped = self._group_by_date(filtered)
            sections = []
            
            for date_label, notifs in grouped.items():
                sections.append(
                    ft.Text(
                        date_label,
                        size=Typography.CAPTION,
                        weight=Typography.SEMI_BOLD,
                        color=colors.text_muted
                    )
                )
                for n in notifs:
                    sections.append(self._build_notification_card(n))
            
            content = ft.ListView(
                controls=sections,
                spacing=Spacing.SM,
                expand=True,
                padding=ft.padding.only(top=Spacing.MD)
            )
        
        # Main layout
        self.content = ft.Column([
            header,
            ft.Container(height=Spacing.MD),
            type_filter_tabs,
            ft.Container(height=Spacing.XS),
            time_filter_tabs,
            content
        ], spacing=0, expand=True, scroll=ft.ScrollMode.AUTO)
        
        self.expand = True
        self.padding = Spacing.XL
    
    def _build_filter_chip(self, filter_id: str, label: str, count: int) -> ft.Container:
        """Build a filter chip."""
        colors = self.tm.colors
        is_selected = self._filter == filter_id
        
        return ft.Container(
            content=ft.Row([
                ft.Text(label, size=Typography.CAPTION, color=colors.on_primary if is_selected else colors.text_secondary),
                ft.Container(
                    content=ft.Text(str(count), size=Typography.SMALL, color=colors.on_primary if is_selected else colors.text_muted),
                    bgcolor=ft.Colors.with_opacity(0.2, ft.Colors.WHITE) if is_selected else colors.surface_variant,
                    border_radius=Spacing.RADIUS_FULL,
                    padding=ft.padding.symmetric(horizontal=6, vertical=1)
                )
            ], spacing=Spacing.XS),
            bgcolor=colors.primary if is_selected else None,
            border=ft.border.all(1, colors.primary if is_selected else colors.border),
            border_radius=Spacing.RADIUS_FULL,
            padding=ft.padding.symmetric(horizontal=Spacing.MD, vertical=Spacing.XS),
            on_click=lambda e, f=filter_id: self._handle_filter(f),
            ink=True
        )
    
    def _build_time_filter_chip(self, filter_id: str, label: str) -> ft.Container:
        """Build a time filter chip."""
        colors = self.tm.colors
        is_selected = self._time_filter == filter_id
        
        return ft.Container(
            content=ft.Text(label, size=Typography.CAPTION, color=colors.on_primary if is_selected else colors.text_secondary),
            bgcolor=colors.accent if is_selected else None,
            border=ft.border.all(1, colors.accent if is_selected else colors.border),
            border_radius=Spacing.RADIUS_FULL,
            padding=ft.padding.symmetric(horizontal=Spacing.MD, vertical=Spacing.XS),
            on_click=lambda e, f=filter_id: self._handle_time_filter(f),
            ink=True
        )
    
    def _apply_filters(self, notifications: list) -> list:
        """Apply both type and time filters."""
        from datetime import datetime, timedelta
        
        filtered = notifications
        
        # Apply type filter
        if self._filter != "all":
            filtered = [n for n in filtered if n.get("type") == self._filter]
        
        # Apply time filter
        if self._time_filter != "all_time":
            now = datetime.now()
            
            if self._time_filter == "today":
                start_of_day = now.replace(hour=0, minute=0, second=0, microsecond=0)
                filtered = [n for n in filtered if isinstance(n.get("timestamp"), datetime) and n["timestamp"] >= start_of_day]
            
            elif self._time_filter == "week":
                start_of_week = now - timedelta(days=now.weekday())
                start_of_week = start_of_week.replace(hour=0, minute=0, second=0, microsecond=0)
                filtered = [n for n in filtered if isinstance(n.get("timestamp"), datetime) and n["timestamp"] >= start_of_week]
            
            elif self._time_filter == "month":
                start_of_month = now.replace(day=1, hour=0, minute=0, second=0, microsecond=0)
                filtered = [n for n in filtered if isinstance(n.get("timestamp"), datetime) and n["timestamp"] >= start_of_month]
        
        return filtered
    
    def _build_notification_card(self, notif: dict) -> ft.Container:
        """Build a notification card."""
        colors = self.tm.colors
        
        # Type config
        type_configs = {
            "success": (ft.Icons.CHECK_CIRCLE, colors.success),
            "warning": (ft.Icons.WARNING, colors.warning),
            "danger": (ft.Icons.ERROR, colors.danger),
            "info": (ft.Icons.INFO, colors.info),
            "reset": (ft.Icons.REFRESH, colors.accent)
        }
        notif_type = notif.get("type", "info")
        icon, accent = type_configs.get(notif_type, (ft.Icons.INFO, colors.info))
        
        # Timestamp
        timestamp = notif.get("timestamp")
        if isinstance(timestamp, str):
            time_str = timestamp
        elif isinstance(timestamp, datetime):
            time_str = timestamp.strftime("%H:%M")
        else:
            time_str = ""
        
        return ft.Container(
            content=ft.Row([
                ft.Container(
                    content=ft.Icon(icon, color=colors.on_primary, size=18),
                    width=36,
                    height=36,
                    border_radius=Spacing.RADIUS_MD,
                    bgcolor=accent,
                    alignment=ft.Alignment(0, 0)
                ),
                ft.Column([
                    ft.Text(
                        notif.get("title", "Thông báo"),
                        size=Typography.BODY,
                        weight=Typography.SEMI_BOLD,
                        color=colors.text_primary
                    ),
                    ft.Text(
                        notif.get("message", ""),
                        size=Typography.CAPTION,
                        color=colors.text_secondary,
                        max_lines=2,
                        overflow=ft.TextOverflow.ELLIPSIS
                    )
                ], spacing=2, expand=True),
                ft.Column([
                    ft.Text(time_str, size=Typography.SMALL, color=colors.text_muted),
                    ft.IconButton(
                        icon=ft.Icons.CLOSE,
                        icon_color=colors.text_muted,
                        icon_size=16,
                        on_click=lambda e, n=notif: self._handle_dismiss(n),
                        tooltip="Xóa"
                    )
                ], spacing=0, horizontal_alignment=ft.CrossAxisAlignment.END)
            ], spacing=Spacing.MD),
            bgcolor=colors.card,
            border=ft.border.all(1, colors.border),
            border_radius=Spacing.RADIUS_LG,
            padding=Spacing.MD
        )
    
    def _group_by_date(self, notifications: list) -> dict:
        """Group notifications by date."""
        groups = {}
        today = datetime.now().date()
        
        for n in notifications:
            ts = n.get("timestamp")
            if isinstance(ts, datetime):
                date = ts.date()
            else:
                date = today
            
            if date == today:
                label = "Hôm nay"
            elif date == today.replace(day=today.day - 1) if today.day > 1 else today:
                label = "Hôm qua"
            else:
                label = date.strftime("%d/%m/%Y")
            
            if label not in groups:
                groups[label] = []
            groups[label].append(n)
        
        return groups
    
    def _handle_filter(self, filter_id: str):
        """Handle filter change."""
        self._filter = filter_id
        self._build()
        self.update()
    
    def _handle_time_filter(self, filter_id: str):
        """Handle time filter change."""
        self._time_filter = filter_id
        self._build()
        self.update()
    
    def _handle_dismiss(self, notif: dict):
        """Handle notification dismiss."""
        if notif in self.notifications:
            self.notifications.remove(notif)
        if self.on_dismiss:
            self.on_dismiss(notif.get("id"))
        self._build()
        self.update()
    
    def _handle_clear_all(self):
        """Handle clear all notifications."""
        self.notifications = []
        if self.on_clear_all:
            self.on_clear_all()
        self._build()
        self.update()
    
    def add_notification(self, title: str, message: str, notif_type: str = "info"):
        """Add a new notification."""
        self.notifications.insert(0, {
            "id": f"notif_{len(self.notifications)}",
            "title": title,
            "message": message,
            "type": notif_type,
            "timestamp": datetime.now()
        })
        self._build()
        self.update()
    
    def update_notifications(self, notifications: list):
        """Update notifications list."""
        self.notifications = notifications
        self._build()
        self.update()
