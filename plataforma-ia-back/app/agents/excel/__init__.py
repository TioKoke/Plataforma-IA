"""Generación de reportes Excel corporativos Plataforma IA."""
from app.agents.excel.builder import build_excel_report
from app.agents.excel.sanitize import sanitize_cell
from app.agents.excel.schema import (
    ChartSpec,
    ColumnSpec,
    ExcelReportSpec,
    KPISpec,
    SheetSpec,
    SummarySheetSpec,
)

__all__ = [
    "ChartSpec",
    "ColumnSpec",
    "ExcelReportSpec",
    "KPISpec",
    "SheetSpec",
    "SummarySheetSpec",
    "build_excel_report",
    "sanitize_cell",
]
