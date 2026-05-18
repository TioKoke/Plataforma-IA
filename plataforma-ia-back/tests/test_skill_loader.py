"""Tests para el skill loader y la detección de intents."""
from __future__ import annotations

import sys
from pathlib import Path

BACKEND_ROOT = Path(__file__).resolve().parent.parent
if str(BACKEND_ROOT) not in sys.path:
    sys.path.insert(0, str(BACKEND_ROOT))

from app.agents.skill_loader import (
    detect_relevant_skills,
    has_dashboard_intent,
    has_excel_intent,
    has_pdf_intent,
    load_visualization_skills,
    message_claims_pdf_success,
    message_contains_hallucination,
    strip_file_context_block,
)


# ── detect_relevant_skills ──────────────────────────────────────────────────

def test_detects_pdf_from_literal_keyword():
    assert "pdf" in detect_relevant_skills("genera un pdf ejecutivo")


def test_detects_pdf_from_memo():
    assert "pdf" in detect_relevant_skills("memo para el gerente de operaciones")


def test_detects_pdf_from_acta():
    assert "pdf" in detect_relevant_skills("necesito un acta de la reunión de ayer")


def test_detects_pdf_from_cotizacion():
    assert "pdf" in detect_relevant_skills("arma una cotización para el proveedor")


def test_dashboard_preempts_pdf_when_pdf_not_literal():
    """'informe' activa pdf pero dashboard gana si 'pdf' no aparece literal."""
    matched = detect_relevant_skills("dashboard con resumen ejecutivo e informe")
    assert "dashboard" in matched
    assert "pdf" not in matched


def test_dashboard_and_pdf_coexist_when_pdf_is_literal():
    matched = detect_relevant_skills("exporta el dashboard a pdf")
    assert "dashboard" in matched
    assert "pdf" in matched


def test_dashboard_preempts_chart():
    matched = detect_relevant_skills("dashboard con gráficos de producción")
    assert "dashboard" in matched
    assert "chart" not in matched


def test_empty_message_returns_empty_list():
    assert detect_relevant_skills("") == []


# ── has_dashboard_intent / has_pdf_intent ──────────────────────────────────

def test_dashboard_intent_on_tablero():
    assert has_dashboard_intent("hazme un tablero operacional")


def test_pdf_intent_on_literal_pdf():
    assert has_pdf_intent("genera un pdf")


def test_pdf_intent_on_memo():
    assert has_pdf_intent("redacta un memo corporativo")


def test_pdf_intent_false_on_informe_alone():
    """'informe' es ambiguo — no debe disparar pdf_intent si no hay keyword fuerte."""
    assert not has_pdf_intent("dame un informe de producción")


def test_pdf_intent_false_on_dashboard_request():
    assert not has_pdf_intent("dashboard con resumen ejecutivo")


# ── strip_file_context_block ───────────────────────────────────────────────

def test_strip_block_prepended_returns_user_text():
    """Caso real: assistant_service prepende el bloque al inicio del mensaje."""
    enriched = (
        "[Archivos de datos disponibles en esta conversación:]\n"
        "  - EXCEL `copper.xlsx` (original: copper.xlsx): 3 hojas, ~500 filas\n"
        "OBLIGATORIO: Para archivos Excel usa inspect_excel + read_from_excel.\n"
        "\n"
        "genera un pdf con los datos del excel."
    )
    assert strip_file_context_block(enriched) == "genera un pdf con los datos del excel."


def test_strip_block_prepended_preserves_pdf_intent():
    """Regresión del bug raíz: pdf_intent debe ser True con archivo adjunto."""
    enriched = (
        "[Archivos de datos disponibles en esta conversación:]\n"
        "  - EXCEL `data.xlsx` (original: data.xlsx): 1 hoja, ~10 filas\n"
        "OBLIGATORIO: ...\n"
        "\n"
        "genera un pdf resumen ejecutivo de los datos del excel."
    )
    assert has_pdf_intent(enriched)


def test_strip_block_appended_returns_user_text():
    """Caso real: chat router appendea --- Archivos adjuntos --- al final."""
    enriched = (
        "genera un pdf con esto.\n"
        "\n"
        "--- Archivos adjuntos ---\n"
        "\n"
        "**Archivo: data.xlsx** (nombre en storage: `data.xlsx`)\n"
    )
    assert strip_file_context_block(enriched) == "genera un pdf con esto."


def test_strip_block_no_marker_returns_original():
    assert strip_file_context_block("solo el mensaje") == "solo el mensaje"


def test_strip_block_empty_returns_empty():
    assert strip_file_context_block("") == ""


# ── has_excel_intent ───────────────────────────────────────────────────────

def test_excel_intent_on_literal_excel():
    assert has_excel_intent("genera un excel con los datos de los agentes")


def test_excel_intent_on_xlsx():
    assert has_excel_intent("dame los datos en xlsx")


def test_excel_intent_on_planilla():
    assert has_excel_intent("exporta todo a una planilla")


def test_excel_intent_on_reporte_ejecutivo():
    assert has_excel_intent("quiero un reporte ejecutivo con los indicadores")


def test_excel_intent_false_on_plain_chart_request():
    assert not has_excel_intent("hazme un gráfico de barras")


def test_excel_intent_false_on_memo_request():
    assert not has_excel_intent("redacta un memo corporativo")


def test_excel_intent_false_on_empty():
    assert not has_excel_intent("")


def test_excel_intent_amplification_with_history():
    """'Agregale diseño' sin decir 'excel' activa intent si el historial
    reciente muestra un .xlsx recién generado."""
    history = [
        {"role": "user", "content": "genera un excel con los datos"},
        {"role": "assistant", "content": "Listo, generé el Excel: datos_agente_20260421.xlsx"},
    ]
    assert has_excel_intent("agregale diseño y el total", conversation_history=history)


def test_excel_intent_amplification_without_history_stays_false():
    """Sin historial de Excel, 'agregale diseño' solo no dispara intent."""
    assert not has_excel_intent("agregale diseño y el total")


# ── detect_relevant_skills para excel ──────────────────────────────────────

def test_detects_excel_from_literal_keyword():
    assert "excel" in detect_relevant_skills("exporta los datos a excel")


def test_detects_excel_from_xlsx():
    assert "excel" in detect_relevant_skills("dame un archivo xlsx")


def test_dashboard_preempts_excel_when_excel_not_literal():
    """'dashboard ejecutivo' matchea excel por 'dashboard ejecutivo' y
    dashboard por 'dashboard' — si no hay keyword dura de Excel, dashboard gana."""
    matched = detect_relevant_skills("hazme un dashboard ejecutivo")
    assert "dashboard" in matched
    assert "excel" not in matched


def test_dashboard_and_excel_coexist_when_excel_is_literal():
    matched = detect_relevant_skills("exporta el dashboard a excel")
    assert "dashboard" in matched
    assert "excel" in matched


# ── message_contains_hallucination ─────────────────────────────────────────

def test_hallucination_pdf_refusal():
    text = "Lamentablemente no tengo una herramienta habilitada para generar PDF."
    assert message_contains_hallucination(text)


def test_hallucination_dashboard_one_per_message():
    text = "Por diseño de la plataforma, solo puedo mostrar un panel por respuesta."
    assert message_contains_hallucination(text)


def test_hallucination_clean_text():
    assert not message_contains_hallucination("Aquí tienes el informe solicitado.")


def test_hallucination_empty_text():
    assert not message_contains_hallucination("")


# ── message_claims_pdf_success ─────────────────────────────────────────────

def test_message_claims_pdf_success_detects_listo():
    assert message_claims_pdf_success("Listo, generé el PDF ejecutivo 'Producción 2026'.")


def test_message_claims_pdf_success_detects_pdf_generado():
    assert message_claims_pdf_success("PDF generado con branding Plataforma IA.")


def test_message_claims_pdf_success_false_on_neutral_text():
    assert not message_claims_pdf_success("Voy a ayudarte con el reporte.")


def test_message_claims_pdf_success_false_on_failure_message():
    assert not message_claims_pdf_success("No pude generar el PDF: WeasyPrint falló.")


def test_message_claims_pdf_success_false_on_empty():
    assert not message_claims_pdf_success("")


# ── load_visualization_skills ──────────────────────────────────────────────

def test_load_skills_includes_pdf_intent_warning():
    block = load_visualization_skills("genera un pdf ejecutivo")
    assert "INTENT PDF DETECTADO" in block
    assert "generate_pdf_report" in block


def test_load_skills_includes_dashboard_intent_warning():
    block = load_visualization_skills("dashboard ejecutivo con 4 paneles")
    assert "INTENT DASHBOARD DETECTADO" in block


def test_load_skills_includes_excel_intent_warning():
    block = load_visualization_skills("genera un excel con el catálogo")
    assert "INTENT EXCEL DETECTADO" in block
    assert "generate_excel_report" in block


def test_load_skills_returns_empty_for_irrelevant_message():
    assert load_visualization_skills("hola, ¿cómo estás?") == ""
