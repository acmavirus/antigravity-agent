"""
Quota Display Components
Circular progress and mini bar visualizations
"""
import flet as ft
import math
from typing import Optional
from app.ui.theme import ThemeManager, Spacing, Typography, AnimationDuration


class QuotaCircle(ft.Container):
    """Circular quota progress indicator."""
    
    def __init__(
        self,
        percentage: float,
        model_name: str,
        reset_text: str = "",
        size: int = 120,
        stroke_width: int = 8,
        theme: ThemeManager = None
    ):
        super().__init__()
        
        self.percentage = min(max(percentage, 0), 100)
        self.model_name = model_name
        self.reset_text = reset_text
        self.size = size
        self.stroke_width = stroke_width
        self.tm = theme or ThemeManager.get_instance()
        
        self._build()
    
    def _get_color(self) -> str:
        """Get color based on percentage."""
        colors = self.tm.colors
        if self.percentage < 15:
            return colors.danger
        elif self.percentage < 50:
            return colors.warning
        return colors.success
    
    def _build(self):
        """Build the circular progress indicator."""
        colors = self.tm.colors
        progress_color = self._get_color()
        
        # Center content
        center_content = ft.Column([
            ft.Text(
                f"{self.percentage:.1f}%",
                size=Typography.HEADLINE if self.size >= 100 else Typography.TITLE,
                weight=Typography.BOLD,
                color=progress_color
            ),
            ft.Text(
                self.model_name[:12],
                size=Typography.CAPTION if self.size >= 100 else Typography.SMALL,
                color=colors.text_secondary,
                text_align=ft.TextAlign.CENTER,
                max_lines=1,
                overflow=ft.TextOverflow.ELLIPSIS
            )
        ], alignment=ft.MainAxisAlignment.CENTER, horizontal_alignment=ft.CrossAxisAlignment.CENTER, spacing=2)
        
        # Using Stack with progress ring simulation
        # Since Flet doesn't have a native circular progress, we use a container with border
        self.content = ft.Stack([
            # Background ring
            ft.Container(
                width=self.size,
                height=self.size,
                border_radius=self.size // 2,
                border=ft.border.all(self.stroke_width, colors.surface_variant)
            ),
            # Progress ring (using clip and rotation would be ideal, but simplifying)
            ft.Container(
                width=self.size,
                height=self.size,
                border_radius=self.size // 2,
                border=ft.border.all(
                    self.stroke_width, 
                    ft.Colors.with_opacity(0.3, progress_color)
                ),
            ),
            # Center content
            ft.Container(
                content=center_content,
                width=self.size,
                height=self.size,
                alignment=ft.Alignment(0, 0)
            )
        ])
        
        # Tooltip with full info
        self.tooltip = f"{self.model_name}\n{self.percentage:.2f}%\nReset: {self.reset_text}" if self.reset_text else None
        
        # Container properties
        self.width = self.size
        self.height = self.size
    
    def update_percentage(self, percentage: float):
        """Update the percentage value."""
        self.percentage = min(max(percentage, 0), 100)
        self._build()
        self.update()


class QuotaMiniBars(ft.Container):
    """Compact horizontal bars for quota display."""
    
    def __init__(
        self,
        quotas: list,  # [{model_name, percentage, reset_text}]
        show_labels: bool = True,
        bar_height: int = 6,
        theme: ThemeManager = None
    ):
        super().__init__()
        
        self.quotas = quotas
        self.show_labels = show_labels
        self.bar_height = bar_height
        self.tm = theme or ThemeManager.get_instance()
        
        self._build()
    
    def _get_color(self, percentage: float) -> str:
        """Get color based on percentage."""
        colors = self.tm.colors
        if percentage < 15:
            return colors.danger
        elif percentage < 50:
            return colors.warning
        return colors.success
    
    def _build(self):
        """Build the mini bars display."""
        colors = self.tm.colors
        
        bars = []
        for q in self.quotas:
            pct = q.get("percentage", 0)
            model = q.get("model_name", "Unknown")
            reset = q.get("reset_text", "")
            progress_color = self._get_color(pct)
            
            bar_row = ft.Column([
                ft.Row([
                    ft.Text(
                        model[:20],
                        size=Typography.SMALL,
                        color=colors.text_secondary,
                        expand=True,
                        max_lines=1,
                        overflow=ft.TextOverflow.ELLIPSIS
                    ),
                    ft.Text(
                        f"{pct:.1f}%",
                        size=Typography.SMALL,
                        color=progress_color,
                        weight=Typography.SEMI_BOLD
                    )
                ]) if self.show_labels else ft.Container(height=0),
                ft.Container(
                    content=ft.Row([
                        ft.Container(
                            expand=int(pct) if pct > 0 else 1,
                            height=self.bar_height,
                            bgcolor=progress_color,
                            border_radius=self.bar_height // 2,
                            animate=AnimationDuration.NORMAL
                        ),
                        ft.Container(
                            expand=int(100 - pct) if pct < 100 else 1,
                            height=self.bar_height,
                            bgcolor=colors.surface_variant,
                            border_radius=self.bar_height // 2
                        )
                    ], spacing=0),
                    border_radius=self.bar_height // 2,
                    clip_behavior=ft.ClipBehavior.HARD_EDGE,
                    tooltip=f"{model}: {pct:.2f}%\nReset: {reset}" if reset else f"{model}: {pct:.2f}%"
                )
            ], spacing=2)
            
            bars.append(bar_row)
        
        self.content = ft.Column(bars, spacing=Spacing.SM)
    
    def update_quotas(self, quotas: list):
        """Update quotas data and refresh."""
        self.quotas = quotas
        self._build()
        self.update()


class QuotaCard(ft.Container):
    """Full quota card with model info and progress."""
    
    def __init__(
        self,
        model_id: str,
        model_name: str,
        percentage: float,
        reset_text: str = "",
        on_preheat: callable = None,
        theme: ThemeManager = None
    ):
        super().__init__()
        
        self.model_id = model_id
        self.model_name = model_name
        self.percentage = percentage
        self.reset_text = reset_text
        self.on_preheat = on_preheat
        self.tm = theme or ThemeManager.get_instance()
        
        self._build()
    
    def _get_color(self) -> str:
        """Get color based on percentage."""
        colors = self.tm.colors
        if self.percentage < 15:
            return colors.danger
        elif self.percentage < 50:
            return colors.warning
        return colors.success
    
    def _get_status_text(self) -> str:
        """Get status text based on percentage."""
        if self.percentage < 15:
            return "Sắp hết"
        elif self.percentage < 50:
            return "Trung bình"
        return "Tốt"
    
    def _build(self):
        """Build the quota card."""
        colors = self.tm.colors
        progress_color = self._get_color()
        
        # Model icon mapping
        icon_map = {
            "gemini": ft.Icons.AUTO_AWESOME,
            "claude": ft.Icons.PSYCHOLOGY,
            "gpt": ft.Icons.SMART_TOY
        }
        model_icon = ft.Icons.AUTO_AWESOME
        for key, icon in icon_map.items():
            if key in self.model_id.lower():
                model_icon = icon
                break
        
        # Header
        header = ft.Row([
            ft.Container(
                content=ft.Icon(model_icon, color=colors.on_primary, size=20),
                width=36,
                height=36,
                border_radius=Spacing.RADIUS_MD,
                bgcolor=progress_color,
                alignment=ft.Alignment(0, 0)
            ),
            ft.Column([
                ft.Text(
                    self.model_name,
                    size=Typography.BODY,
                    weight=Typography.SEMI_BOLD,
                    color=colors.text_primary
                ),
                ft.Text(
                    self._get_status_text(),
                    size=Typography.CAPTION,
                    color=progress_color
                )
            ], spacing=0, expand=True),
            ft.Text(
                f"{self.percentage:.1f}%",
                size=Typography.TITLE,
                weight=Typography.BOLD,
                color=progress_color
            )
        ], spacing=Spacing.MD)
        
        # Progress bar
        progress = ft.ProgressBar(
            value=self.percentage / 100 if self.percentage <= 100 else 1.0,
            color=progress_color,
            bgcolor=colors.surface_variant,
            height=8,
            border_radius=4
        )
        
        # Footer
        footer = ft.Row([
            ft.Row([
                ft.Icon(ft.Icons.SCHEDULE, color=colors.text_muted, size=14),
                ft.Text(
                    f"Reset: {self.reset_text}" if self.reset_text else "No reset info",
                    size=Typography.CAPTION,
                    color=colors.text_muted
                )
            ], spacing=4),
            ft.Container(expand=True),
            ft.TextButton(
                text="Preheat",
                icon=ft.Icons.FLASH_ON,
                on_click=lambda e: self.on_preheat(self.model_id) if self.on_preheat else None,
                style=ft.ButtonStyle(
                    color=colors.warning,
                    overlay_color=ft.Colors.with_opacity(0.1, colors.warning)
                )
            ) if self.on_preheat and self.percentage < 100 else ft.Container()
        ])
        
        # Build content
        self.content = ft.Column([
            header,
            progress,
            footer
        ], spacing=Spacing.MD)
        
        self.bgcolor = colors.card
        self.border = ft.border.all(1, colors.border)
        self.border_radius = Spacing.RADIUS_LG
        self.padding = Spacing.LG
        self.animate = AnimationDuration.FAST
