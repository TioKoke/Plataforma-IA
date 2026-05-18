"""Defaults asociados a cada ``report_type``.

Cuando el agente declara `report_type="kpi_dashboard"` (etc), aplicamos los
valores de este diccionario sobre el spec antes de renderizar — sin pisar
nada que el agente haya seteado explícitamente.
"""
from __future__ import annotations

from typing import Any

PRESET_DEFAULTS: dict[str, dict[str, Any]] = {
    "data_table": {
        "style_preset": "modern_orange",
        "cover_sheet": False,
        "totals": "auto",
        "conditional_formats": None,
    },
    "kpi_dashboard": {
        "style_preset": "executive",
        "cover_sheet": True,
        "totals": "auto",
        "conditional_formats": "auto",
        "include_summary": True,
    },
    "financial_report": {
        "style_preset": "financial",
        "cover_sheet": True,
        "totals": "auto",
        "conditional_formats": None,
        "force_currency": True,
    },
    "ranking": {
        "style_preset": "modern_orange",
        "cover_sheet": False,
        "totals": None,
        "conditional_formats": "auto",
        "auto_chart_type": "bar",
        "sort_desc_first_metric": True,
    },
    "comparison": {
        "style_preset": "corporate_navy",
        "cover_sheet": False,
        "totals": "auto",
        "conditional_formats": "auto",
        "auto_chart_type": "column",
    },
    "timeseries": {
        "style_preset": "modern_orange",
        "cover_sheet": False,
        "totals": None,
        "conditional_formats": None,
        "auto_chart_type": "line",
        "auto_sparklines": True,
    },
    "auto": {},
}


def get_preset_defaults(report_type: str) -> dict[str, Any]:
    return PRESET_DEFAULTS.get(report_type, {})
