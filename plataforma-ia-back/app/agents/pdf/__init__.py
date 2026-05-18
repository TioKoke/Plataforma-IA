"""Generación de PDFs corporativos Plataforma IA (HTML+CSS vía WeasyPrint)."""
from app.agents.pdf.schema import (
    PDFReportSpec,
    PDFSection,
    PDFTable,
    PDFKpi,
)
from app.agents.pdf.builder import render_report, render_html

__all__ = [
    "PDFReportSpec",
    "PDFSection",
    "PDFTable",
    "PDFKpi",
    "render_report",
    "render_html",
]
