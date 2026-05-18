"""Smoke tests para el constructor de PDFs Plataforma IA (WeasyPrint)."""
from __future__ import annotations

import sys
from pathlib import Path

import pytest

BACKEND_ROOT = Path(__file__).resolve().parent.parent
if str(BACKEND_ROOT) not in sys.path:
    sys.path.insert(0, str(BACKEND_ROOT))

from app.agents.pdf.schema import (
    PDFKpi,
    PDFReportSpec,
    PDFSection,
    PDFTable,
)

# El builder depende de jinja2 + weasyprint + pymupdf. WeasyPrint en Windows
# puede instalarse pero fallar en import con OSError si faltan libs GTK+ —
# por eso envolvemos en try/except y no sólo `importorskip`.
jinja2 = pytest.importorskip("jinja2", reason="jinja2 no instalado")
pymupdf = pytest.importorskip("pymupdf", reason="pymupdf no instalado")

try:
    import weasyprint  # noqa: F401
    from app.agents.pdf.builder import render_html, render_report
    _RENDER_AVAILABLE = True
    _RENDER_SKIP_REASON = ""
except (ImportError, OSError) as exc:
    _RENDER_AVAILABLE = False
    _RENDER_SKIP_REASON = f"WeasyPrint/GTK+ no disponible: {exc}"

    def render_report(_spec):  # type: ignore[misc]
        raise RuntimeError(_RENDER_SKIP_REASON)

    def render_html(_html, title=""):  # type: ignore[misc]
        raise RuntimeError(_RENDER_SKIP_REASON)

requires_render = pytest.mark.skipif(
    not _RENDER_AVAILABLE, reason=_RENDER_SKIP_REASON or "render no disponible"
)


# ── fixtures ────────────────────────────────────────────────────────────────

def _minimal_spec() -> PDFReportSpec:
    return PDFReportSpec(
        filename="informe.pdf",
        title="Informe ejecutivo Q1 2026",
        subtitle="Producción división Norte",
        author="Jorge Tapia",
        division="Norte",
        date="2026-04-20",
        sections=[
            PDFSection(
                heading="Resumen",
                body="La producción del trimestre superó lo planificado.",
                kpis=[
                    PDFKpi(label="Toneladas", value="82.500", trend="up"),
                    PDFKpi(label="USD MM", value="612,4", trend="flat"),
                ],
            ),
            PDFSection(
                heading="Detalle",
                table=PDFTable(
                    headers=["División", "Toneladas", "USD MM"],
                    rows=[
                        ["Norte", "82.500", "612,4"],
                        ["RT", "67.800", "501,2"],
                    ],
                    caption="Cifras preliminares",
                ),
                bullets=["Incremento en Norte", "RT estable"],
            ),
        ],
    )


# ── render_report ───────────────────────────────────────────────────────────

@requires_render
def test_render_report_produces_valid_pdf_bytes():
    data = render_report(_minimal_spec())
    assert isinstance(data, bytes)
    assert len(data) > 0
    assert data[:4] == b"%PDF"


@requires_render
def test_render_report_opens_with_pymupdf_and_has_pages():
    data = render_report(_minimal_spec())
    with pymupdf.open(stream=data, filetype="pdf") as doc:
        assert doc.page_count >= 1


@requires_render
def test_render_report_contains_title_text():
    spec = _minimal_spec()
    data = render_report(spec)
    with pymupdf.open(stream=data, filetype="pdf") as doc:
        full_text = "\n".join(page.get_text() for page in doc)
    assert spec.title in full_text


@requires_render
def test_render_report_escapes_html_in_section_body():
    """Autoescape de Jinja2 debe neutralizar HTML inyectado en body."""
    spec = PDFReportSpec(
        filename="safe.pdf",
        title="Seguridad",
        sections=[PDFSection(body="<script>alert('xss')</script>")],
    )
    data = render_report(spec)
    with pymupdf.open(stream=data, filetype="pdf") as doc:
        full_text = "\n".join(page.get_text() for page in doc)
    # El tag literal debe aparecer como texto (escapado), no como HTML ejecutable
    assert "<script>" in full_text or "script" in full_text


# ── render_html ─────────────────────────────────────────────────────────────

@requires_render
def test_render_html_produces_valid_pdf_bytes():
    data = render_html("<h1>Hola Plataforma IA</h1><p>Contenido libre.</p>", title="Demo")
    assert isinstance(data, bytes)
    assert data[:4] == b"%PDF"


@requires_render
def test_render_html_contains_body_text():
    data = render_html("<h1>Marcador único</h1>", title="Demo")
    with pymupdf.open(stream=data, filetype="pdf") as doc:
        full_text = "\n".join(page.get_text() for page in doc)
    assert "Marcador único" in full_text


# ── schema validation (no depende de jinja/weasyprint) ─────────────────────

def test_filename_must_end_with_pdf():
    with pytest.raises(Exception):
        PDFReportSpec(
            filename="sin_extension",
            title="x",
            sections=[PDFSection(body="y")],
        )


def test_sections_cannot_be_empty():
    with pytest.raises(Exception):
        PDFReportSpec(
            filename="vacio.pdf",
            title="x",
            sections=[],
        )


def test_kpi_trend_rejects_unknown_value():
    with pytest.raises(Exception):
        PDFKpi(label="L", value="1", trend="sideways")  # type: ignore[arg-type]


def test_table_requires_at_least_one_header():
    with pytest.raises(Exception):
        PDFTable(headers=[], rows=[])
