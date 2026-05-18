"""Paleta Plataforma IA, presets corporativos y constructor de formatos xlsxwriter.

Cada preset define:
- ``table_style``: nombre de estilo de tabla Excel (banded rows nativos).
- ``header_format``: dict xlsxwriter para el header row de polars.write_excel.
- ``dtype_formats``: formato numérico por tipo de columna.
- ``accent_color``: color principal para títulos, KPIs y elementos visuales.
- ``title_bg`` / ``subtitle_bg``: fondos para títulos manuales sobre la tabla.
"""
from __future__ import annotations

from typing import TYPE_CHECKING, Any

if TYPE_CHECKING:
    import xlsxwriter


BRAND_ORANGE = "#E87722"
BRAND_BLUE = "#0072B1"
BRAND_NAVY = "#003C71"
BRAND_WHITE = "#FFFFFF"
BRAND_GREEN = "#2E8540"
BRAND_RED = "#C8102E"
ZEBRA_LIGHT = "#F5F5F5"
BORDER_GRAY = "#D0D5DD"
SOFT_GRAY = "#7A7A7A"


NUMBER_FORMATS: dict[str, str] = {
    "text": "@",
    "number": "#,##0.00",
    "integer": "#,##0",
    "date": "dd-mmm-yyyy",
    "currency": '[$USD] #,##0.00',
    "percent": "0.0%",
}


def _header(bg: str, fg: str = BRAND_WHITE) -> dict[str, Any]:
    return {
        "bold": True,
        "font_size": 11,
        "font_color": fg,
        "bg_color": bg,
        "align": "center",
        "valign": "vcenter",
        "font_name": "Calibri",
        "border": 0,
    }


STYLE_PRESETS: dict[str, dict[str, Any]] = {
    "modern_orange": {
        "table_style": "Table Style Medium 3",
        "header_format": _header(BRAND_ORANGE),
        "accent_color": BRAND_ORANGE,
        "title_bg": BRAND_NAVY,
        "subtitle_bg": BRAND_BLUE,
        "dtype_formats": NUMBER_FORMATS.copy(),
    },
    "corporate_navy": {
        "table_style": "Table Style Medium 2",
        "header_format": _header(BRAND_NAVY),
        "accent_color": BRAND_NAVY,
        "title_bg": BRAND_NAVY,
        "subtitle_bg": BRAND_BLUE,
        "dtype_formats": NUMBER_FORMATS.copy(),
    },
    "financial": {
        "table_style": "Table Style Medium 4",
        "header_format": _header(BRAND_NAVY),
        "accent_color": BRAND_NAVY,
        "title_bg": BRAND_NAVY,
        "subtitle_bg": SOFT_GRAY,
        "dtype_formats": {
            **NUMBER_FORMATS,
            "number": '_-* #,##0.00_-;-* #,##0.00_-;_-* "-"??_-;_-@_-',
            "currency": '_-[$USD] * #,##0.00_-;-[$USD] * #,##0.00_-;_-[$USD] * "-"??_-',
            "integer": '_-* #,##0_-;-* #,##0_-;_-* "-"_-;_-@_-',
        },
    },
    "minimal_gray": {
        "table_style": "Table Style Light 15",
        "header_format": _header(SOFT_GRAY),
        "accent_color": SOFT_GRAY,
        "title_bg": SOFT_GRAY,
        "subtitle_bg": ZEBRA_LIGHT,
        "dtype_formats": NUMBER_FORMATS.copy(),
    },
    "executive": {
        "table_style": "Table Style Medium 7",
        "header_format": _header(BRAND_NAVY),
        "accent_color": BRAND_ORANGE,
        "title_bg": BRAND_NAVY,
        "subtitle_bg": BRAND_ORANGE,
        "dtype_formats": NUMBER_FORMATS.copy(),
    },
}


def get_preset(name: str | None) -> dict[str, Any]:
    """Devuelve el preset solicitado o ``modern_orange`` si no existe."""
    return STYLE_PRESETS.get(name or "modern_orange", STYLE_PRESETS["modern_orange"])


def build_formats(workbook: "xlsxwriter.Workbook", preset_name: str | None = None) -> dict:
    """Crea Formats reutilizables para títulos/subtítulos/KPIs en un workbook."""
    preset = get_preset(preset_name)

    title = workbook.add_format({
        "bold": True,
        "font_size": 16,
        "font_color": BRAND_WHITE,
        "bg_color": preset["title_bg"],
        "align": "left",
        "valign": "vcenter",
        "font_name": "Calibri",
        "indent": 1,
    })

    subtitle = workbook.add_format({
        "italic": True,
        "font_size": 11,
        "font_color": BRAND_WHITE,
        "bg_color": preset["subtitle_bg"],
        "align": "left",
        "valign": "vcenter",
        "font_name": "Calibri",
        "indent": 1,
    })

    cover_title = workbook.add_format({
        "bold": True,
        "font_size": 28,
        "font_color": preset["accent_color"],
        "align": "center",
        "valign": "vcenter",
        "font_name": "Calibri",
    })

    cover_sub = workbook.add_format({
        "italic": True,
        "font_size": 14,
        "font_color": SOFT_GRAY,
        "align": "center",
        "valign": "vcenter",
        "font_name": "Calibri",
    })

    cover_meta_label = workbook.add_format({
        "bold": True,
        "font_size": 11,
        "font_color": preset["accent_color"],
        "align": "right",
        "valign": "vcenter",
    })
    cover_meta_value = workbook.add_format({
        "font_size": 11,
        "font_color": "#1A1A1A",
        "align": "left",
        "valign": "vcenter",
    })

    kpi_label = workbook.add_format({
        "bold": True,
        "font_size": 11,
        "font_color": SOFT_GRAY,
        "bg_color": ZEBRA_LIGHT,
        "align": "center",
        "valign": "vcenter",
        "top": 2,
        "top_color": preset["accent_color"],
        "left": 1, "right": 1,
        "left_color": BORDER_GRAY, "right_color": BORDER_GRAY,
    })

    def _kpi_value(color_hex: str) -> dict[str, Any]:
        return {
            "bold": True,
            "font_size": 22,
            "font_color": color_hex,
            "bg_color": BRAND_WHITE,
            "align": "center",
            "valign": "vcenter",
            "left": 1, "right": 1,
            "left_color": BORDER_GRAY, "right_color": BORDER_GRAY,
        }

    kpi_color_map = {
        "neutral": "#1A1A1A",
        "blue": BRAND_BLUE,
        "green": BRAND_GREEN,
        "red": BRAND_RED,
        "orange": BRAND_ORANGE,
    }
    kpi_value_formats = {
        f"kpi_value_{name}": workbook.add_format(_kpi_value(hex_))
        for name, hex_ in kpi_color_map.items()
    }

    kpi_delta_pos = workbook.add_format({
        "italic": True, "font_size": 10, "font_color": BRAND_GREEN,
        "bg_color": BRAND_WHITE, "align": "center", "valign": "vcenter",
        "bottom": 1, "bottom_color": BORDER_GRAY,
        "left": 1, "right": 1, "left_color": BORDER_GRAY, "right_color": BORDER_GRAY,
    })
    kpi_delta_neg = workbook.add_format({
        "italic": True, "font_size": 10, "font_color": BRAND_RED,
        "bg_color": BRAND_WHITE, "align": "center", "valign": "vcenter",
        "bottom": 1, "bottom_color": BORDER_GRAY,
        "left": 1, "right": 1, "left_color": BORDER_GRAY, "right_color": BORDER_GRAY,
    })
    kpi_delta_zero = workbook.add_format({
        "italic": True, "font_size": 10, "font_color": SOFT_GRAY,
        "bg_color": BRAND_WHITE, "align": "center", "valign": "vcenter",
        "bottom": 1, "bottom_color": BORDER_GRAY,
        "left": 1, "right": 1, "left_color": BORDER_GRAY, "right_color": BORDER_GRAY,
    })

    notes = workbook.add_format({
        "italic": True,
        "font_size": 10,
        "font_color": SOFT_GRAY,
        "align": "left",
        "valign": "top",
        "text_wrap": True,
    })

    return {
        "title": title,
        "subtitle": subtitle,
        "cover_title": cover_title,
        "cover_sub": cover_sub,
        "cover_meta_label": cover_meta_label,
        "cover_meta_value": cover_meta_value,
        "kpi_label": kpi_label,
        **kpi_value_formats,
        "kpi_delta_pos": kpi_delta_pos,
        "kpi_delta_neg": kpi_delta_neg,
        "kpi_delta_zero": kpi_delta_zero,
        "notes": notes,
        "preset": preset,
    }


def footer_string(author: str | None = None) -> str:
    """Footer estándar: Plataforma IA | fecha | página."""
    left = "&LPlataforma IA"
    if author:
        left += f" — {author}"
    return f"{left}&C&D&RPágina &P de &N"
