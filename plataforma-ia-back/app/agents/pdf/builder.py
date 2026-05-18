"""Constructor de PDFs corporativos Plataforma IA (HTML+CSS vía WeasyPrint)."""
from __future__ import annotations

import logging
from pathlib import Path

from jinja2 import Environment, FileSystemLoader, select_autoescape

from app.agents.pdf.schema import PDFReportSpec

logger = logging.getLogger(__name__)

_TEMPLATES_DIR = Path(__file__).parent / "templates"
_STYLES_DIR = Path(__file__).parent / "styles"

_env = Environment(
    loader=FileSystemLoader(str(_TEMPLATES_DIR)),
    autoescape=select_autoescape(enabled_extensions=("html",), default=True),
    trim_blocks=True,
    lstrip_blocks=True,
)


def _load_css() -> str:
    css_path = _STYLES_DIR / "plataforma-ia.css"
    return css_path.read_text(encoding="utf-8")


def _render_to_pdf(html: str) -> bytes:
    """Renderiza HTML a PDF con WeasyPrint. Import diferido: en Windows sin
    GTK+ runtime la importación dispara la excepción legible al momento del
    llamado, no en el arranque de la app."""
    from weasyprint import HTML  # noqa: WPS433 — lazy import intencional
    return HTML(string=html, base_url=str(_TEMPLATES_DIR)).write_pdf()


def render_report(spec: PDFReportSpec) -> bytes:
    """Renderiza un `PDFReportSpec` a PDF usando `templates/report.html`.

    Jinja2 autoescape está activo → el contenido del spec no puede inyectar
    HTML/JS. El CSS se inyecta vía `|safe` ya que es trusted (archivo propio).
    """
    template = _env.get_template("report.html")
    html = template.render(spec=spec, css=_load_css(), title=spec.title)
    return _render_to_pdf(html)


def render_html(html_body: str, title: str = "Documento Plataforma IA") -> bytes:
    """Convierte HTML libre a PDF respetando el branding Plataforma IA.

    `html_body` se inyecta tal cual (via `|safe`). Úsalo sólo cuando el HTML
    venga del agente (trust boundary asumida por tools.export_html_to_pdf).
    """
    template = _env.get_template("plain.html")
    html = template.render(html_body=html_body, css=_load_css(), title=title)
    return _render_to_pdf(html)
