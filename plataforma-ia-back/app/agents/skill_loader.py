"""
Cargador de skill packs (inspirado en Anthropic Skills).

Detecta, por keyword-match simple en el mensaje del usuario, qué tipos de
visualización son relevantes y retorna el contenido de los `.md` asociados para
que el orquestador pueda inyectarlos como contexto adicional en su system prompt.

El objetivo es:
  - No cargar SIEMPRE las ~200 líneas de guía para cada tipo.
  - Cargar sólo lo necesario en cada turno → prompt más corto y focalizado.

Uso típico desde `azure_ai.send_message`:

    from app.agents.skill_loader import load_visualization_skills
    skills_block = load_visualization_skills(user_message)
    if skills_block:
        system_prompt += "\\n\\n" + skills_block
"""
from __future__ import annotations

import re
from pathlib import Path
from typing import Iterable

_SKILLS_DIR = Path(__file__).parent / "skills" / "visualization"

# Keywords por tipo. Matching simple sobre el texto del usuario en minúsculas.
# Se prefiere falsos positivos a falsos negativos — el costo de inyectar una
# skill de más es ~200 tokens; el costo de no inyectarla es una respuesta mala.
_KEYWORDS: dict[str, tuple[str, ...]] = {
    "chart": (
        "gráfico", "grafico", "grafica", "gráfica",
        "barra", "barras", "línea", "linea", "torta", "pie",
        "área", "area", "waterfall",
        "tendencia", "evolución", "evolucion", "histograma",
        "apilado", "apilada", "apiladas", "apilados", "stacked",
        "cascada", "dona", "donut",
    ),
    "dashboard": (
        "dashboard", "tablero", "panel", "cuadro de mando",
        "resumen ejecutivo", "vista general", "overview",
        "tablero operacional", "panel integral",
    ),
    "kpi": (
        "kpi", "kpis", "indicador", "indicadores", "métrica clave",
        "metrica clave", "cifras clave", "número de", "numero de",
        "números clave", "numeros clave", "cifras", "tarjetas kpi",
        "sparkline", "meta vs real",
    ),
    "infographic": (
        "flujo", "diagrama", "proceso",
        "pasos", "organigrama", "timeline", "línea de tiempo",
        "estructura", "hitos", "roadmap",
    ),
    "widget": (
        "foda", "swot", "fortaleza", "debilidad", "oportunidad", "amenaza",
        "matriz de riesgo", "riesgo", "riesgos", "matriz",
        "checklist", "lista de chequeo", "pendientes",
        "ranking", "ranking top", "top ", "mejores", "peores",
        "comparación", "comparacion", "comparar", "vs",
    ),
    "pdf": (
        "pdf", "informe", "reporte pdf", "memo", "acta", "minuta",
        "cotización", "cotizacion", "orden de trabajo", " ot ",
        "documento ejecutivo", "carta", "oficio", "descargable",
        "exportar pdf", "exportar a pdf", "generar pdf", "genera un pdf",
        "hoja de datos", "datasheet",
    ),
    "excel": (
        "excel", "xlsx", "hoja de cálculo", "hoja de calculo",
        "spreadsheet", "planilla", "libro de excel",
        "reporte ejecutivo", "dashboard ejecutivo",
        "exporta", "exportar", "exportable",
        "tabla descargable", "dame los datos",
        "estado de resultados", "balance", "financiero",
        "portada", "tarjetas kpi", "kpi dashboard",
    ),
}

_SKILL_ORDER = ("chart", "dashboard", "kpi", "pdf", "excel", "infographic", "widget")


def _read_skill(kind: str) -> str:
    path = _SKILLS_DIR / f"{kind}.md"
    if not path.exists():
        return ""
    try:
        return path.read_text(encoding="utf-8")
    except OSError:
        return ""


# Frases prohibidas alucinadas sobre "limitaciones" inventadas de la plataforma.
# Se usan para filtrar mensajes del historial que contaminarían turnos futuros
# (el modelo tiende a repetir sus propias alucinaciones si las ve en el history).
_HALLUCINATED_PLATFORM_PHRASES: tuple[str, ...] = (
    "solo puedo mostrar un panel",
    "solo puedo mostrar un gráfico",
    "solo puedo mostrar un grafico",
    "solo puedo renderizar un gráfico",
    "solo puedo renderizar un grafico",
    "en cada respuesta solo puedo",
    "un panel por respuesta",
    "un panel por mensaje",
    "un gráfico por respuesta",
    "un grafico por respuesta",
    "un gráfico por mensaje",
    "un grafico por mensaje",
    "un chart por mensaje",
    "un chart por respuesta",
    "un componente por mensaje",
    "en secuencia, mostrando",
    "requiere entregarlo en pasos",
    "debo construirlo en pasos",
    "construirlo en pasos",
    "panel por panel",
    "uno por uno hasta completar",
    "por diseño de la plataforma",
    "por diseno de la plataforma",
    "regla de la plataforma",
    "restricción importante del chat",
    "restriccion importante del chat",
    "limitación importante del chat",
    "limitacion importante del chat",
    "limitación técnica del chat",
    "limitacion tecnica del chat",
    "limitación del chat",
    "limitacion del chat",
    "limitación de la plataforma",
    "limitacion de la plataforma",
    "necesito transparentar antes de avanzar",
    "necesito transparentar",
    "no puedo renderizar múltiples paneles",
    "no puedo renderizar multiples paneles",
    "chart-component) por respuesta",
    "chart-component) por mensaje",
    "chart-component por respuesta",
    "chart-component por mensaje",
    "construye en secuencia",
    "entregarlo en pasos",
    "varios paneles requiere",
    # Frases vistas en screenshot 2026-04-20 (dashboard "genéralos todos")
    "la plataforma solo permite",
    "solo permite un chart",
    "solo permite un gráfico",
    "solo permite un grafico",
    "limitación técnica de la plataforma",
    "limitacion tecnica de la plataforma",
    "de manera secuencial, entregando",
    "de manera secuencial entregando",
    "la única forma correcta es",
    "la unica forma correcta es",
    "empiezo de inmediato con el gráfico 1",
    "empiezo de inmediato con el grafico 1",
    "gráfico por gráfico",
    "grafico por grafico",
    "hasta completar todos los gráficos",
    "hasta completar todos los graficos",
    "sin violar las reglas obligatorias",
    "sin violar las reglas",
    "necesito ser muy transparente",
    "dashboard completo gráfico por gráfico",
    "dashboard completo grafico por grafico",
    # PDF — rechazos falsos que el modelo inventó antes de tener el skill
    "no tengo una herramienta habilitada para generar pdf",
    "no tengo herramienta habilitada para generar pdf",
    "no tengo herramienta para generar pdf",
    "no puedo entregar el resultado final como un pdf",
    "en este entorno no tengo una herramienta",
    "limitación actual",
    "limitacion actual",
)


def message_contains_hallucination(content: str) -> bool:
    """True si el texto contiene alguna frase alucinada sobre limitaciones falsas."""
    if not content:
        return False
    text = content.lower()
    return any(phrase in text for phrase in _HALLUCINATED_PLATFORM_PHRASES)


# Frases con las que el modelo afirma haber generado un PDF. Se usan para
# detectar el caso simétrico a `message_contains_hallucination`: el modelo
# inventa que generó el archivo cuando ningún tool de PDF retornó success=True.
_PDF_FALSE_SUCCESS_PHRASES: tuple[str, ...] = (
    "listo, generé el pdf", "listo, genere el pdf",
    "generé el pdf", "genere el pdf",
    "el pdf está listo", "el pdf esta listo",
    "pdf generado", "pdf creado",
    "documento pdf generado", "documento pdf creado",
    "he creado el pdf", "he generado el pdf",
)


def message_claims_pdf_success(content: str) -> bool:
    """True si el texto afirma haber generado un PDF (para validar contra tool real)."""
    if not content:
        return False
    text = content.lower()
    return any(phrase in text for phrase in _PDF_FALSE_SUCCESS_PHRASES)


# Frases de "amplificación": solas no bastan (demasiado genéricas), pero
# combinadas con evidencia de dashboard en el historial reciente activan el
# intent. Motivo: el usuario a menudo acepta una propuesta del asistente con
# una frase corta ("genéralos todos", "los 9", "dashboard completo") que no
# contiene las keywords duras.
_DASHBOARD_AMPLIFICATION_KEYWORDS: tuple[str, ...] = (
    "genéralos todos", "generalos todos",
    "genéralos", "generalos",
    "genera todos", "generá todos",
    "todos los gráficos", "todos los graficos",
    "hazlos todos", "haz todos",
    "los 9", "los nueve",
    "los 8", "los ocho",
    "los 7", "los siete",
    "los 6", "los seis",
    "los 5", "los cinco",
    "los 4", "los cuatro",
    "todos ellos",
    "dashboard completo", "el dashboard completo",
    "completo",
    "todos",
    "dale",
    "sí, todos", "si, todos", "sí todos", "si todos",
    "confirmado",
    "adelante",
    "procede",
    "procedé", "procede con todos",
)


# Señales que buscamos en el history para decidir si una amplificación
# ("todos", "genéralos todos") cuenta como dashboard_intent. Incluye keywords
# duras + frases típicas del asistente cuando propone un dashboard/lista.
_HISTORY_DASHBOARD_SIGNAL_PHRASES: tuple[str, ...] = _KEYWORDS["dashboard"] + (
    "voy a generar",
    "dashboard ejecutivo",
    "dashboard propuesto",
    "gráficos ejecutivos", "graficos ejecutivos",
    "gráfico por gráfico", "grafico por grafico",
    "todos estos gráficos", "todos estos graficos",
    "gráficos relevantes", "graficos relevantes",
    "los siguientes gráficos", "los siguientes graficos",
    "tablero ejecutivo",
    "resumen ejecutivo",
)

# Lista numerada de ≥3 ítems con palabra de gráfico. Si el asistente propuso
# algo como "1. Oferta vs Demanda\n2. Balance\n3. Déficit", es casi seguro
# una propuesta de dashboard.
_NUMBERED_CHART_ITEM_RE = re.compile(
    r"^\s*\d+\.\s+.*(gráfico|grafico|chart|barras?|línea|linea|torta|pie|donut|dona|treemap|funnel|waterfall|cascada|área|area|radar|oferta|demanda|balance|déficit|deficit|producción|produccion|ranking|top\s+\d+)",
    re.IGNORECASE | re.MULTILINE,
)


def _extract_text(message: object) -> str:
    """Extrae texto plano de un mensaje del historial (string o content list)."""
    if not isinstance(message, dict):
        return ""
    content = message.get("content")
    if isinstance(content, str):
        return content
    if isinstance(content, list):
        parts: list[str] = []
        for p in content:
            if isinstance(p, dict) and p.get("type") == "text":
                parts.append(p.get("text", ""))
            elif isinstance(p, str):
                parts.append(p)
        return " ".join(parts)
    return ""


def _history_has_dashboard_signal(
    conversation_history: list | None,
    lookback: int = 5,
) -> bool:
    """True si los últimos `lookback` mensajes contienen evidencia de dashboard.

    Busca:
      - Keywords duras de dashboard (dashboard/tablero/panel/…).
      - Frases típicas del asistente al proponer múltiples gráficos.
      - Listas numeradas con ≥3 items que mencionen gráficos.
    """
    if not conversation_history:
        return False
    recent = conversation_history[-lookback:]
    for m in recent:
        text = _extract_text(m).lower()
        if not text:
            continue
        if any(p in text for p in _HISTORY_DASHBOARD_SIGNAL_PHRASES):
            return True
        if len(_NUMBERED_CHART_ITEM_RE.findall(text)) >= 3:
            return True
    return False


def has_dashboard_intent(
    user_text: str,
    conversation_history: list | None = None,
) -> bool:
    """True si el turno actual activa el intent de dashboard integrado.

    Se usa desde el loop de tool-calling para forzar `tool_choice="required"`
    y bloquear el camino "voy a explicarte una limitación" que aparece cuando
    el modelo evade llamar `generate_dashboard_data`.

    Dos vías de activación:
      1. Señal fuerte: el mensaje actual contiene una keyword dura
         (dashboard, tablero, panel, resumen ejecutivo, …).
      2. Señal de amplificación: el mensaje actual es corto/genérico
         ("genéralos todos", "los 9", "completo") Y el historial reciente
         muestra que el asistente propuso un dashboard o una lista con ≥3
         gráficos. Esto captura el flujo "propuesta → aceptación" donde el
         usuario confirma con una frase que sola no tiene contexto.
    """
    if not user_text:
        return False
    text = user_text.lower()
    if any(kw in text for kw in _KEYWORDS["dashboard"]):
        return True
    if any(kw in text for kw in _DASHBOARD_AMPLIFICATION_KEYWORDS):
        if _history_has_dashboard_signal(conversation_history):
            return True
    return False


# Bloque inyectado por `_build_file_context_reminder` en assistant_service.py.
# Aparece prepended al mensaje real del usuario en turnos con archivos
# adjuntos y trae las palabras "EXCEL" / "PDF" como metadatos del archivo,
# no como intención del usuario. Hay que removerlo antes de aplicar los
# detectores de intent para evitar falsos positivos.
_FILE_CONTEXT_MARKERS: tuple[str, ...] = (
    "[Archivos de datos disponibles",
    "--- Archivos adjuntos ---",
)


def strip_file_context_block(user_text: str) -> str:
    """Devuelve el texto del usuario sin el bloque de contexto de archivos.

    El bloque puede estar prependeado (assistant_service inyecta
    ``[Archivos de datos disponibles…]`` al inicio en mensajes de
    seguimiento) o appendeado (chat router agrega ``--- Archivos
    adjuntos ---`` al final cuando el usuario sube archivos en el turno).
    Removemos el bloque y devolvemos solo la intención real del usuario,
    para que los detectores de intent vean el pedido del usuario y no
    los metadatos de los archivos.
    """
    if not user_text:
        return user_text
    cleaned = user_text

    # Prependeado: el bloque va al inicio y usa ``\n`` simple internamente;
    # se separa del mensaje del usuario con ``\n\n``. Cortamos hasta el
    # primer doble newline tras el marker. Si no hay doble newline, todo
    # el contenido es el bloque (el mensaje del usuario fue vacío).
    pre_marker = "[Archivos de datos disponibles"
    idx = cleaned.find(pre_marker)
    if idx != -1:
        end = cleaned.find("\n\n", idx)
        before = cleaned[:idx].rstrip()
        if end == -1:
            cleaned = before
        else:
            after = cleaned[end + 2:].lstrip()
            if before and after:
                cleaned = f"{before}\n\n{after}"
            else:
                cleaned = before or after

    # Appendeado: el bloque va al final del mensaje y puede contener
    # ``\n\n`` internamente (entre cabecera y entradas de archivo), así
    # que cortamos hasta el final del texto.
    app_marker = "--- Archivos adjuntos ---"
    idx = cleaned.find(app_marker)
    if idx != -1:
        cleaned = cleaned[:idx].rstrip()

    return cleaned


# Verbos que indican LECTURA / análisis. Si el usuario dice "analiza este
# archivo" no quiere generar un Excel, quiere LEER uno. Estos vetan el intent
# de generación a menos que aparezca un verbo claro de generación.
_READ_INTENT_VERBS: tuple[str, ...] = (
    "analiza", "analízame", "analizame", "analizá", "analiza el", "analiza este",
    "revisa", "revisá", "revísame", "revisame",
    "resume", "resúmeme", "resumeme", "resumime", "resumir",
    "explica", "explícame", "explicame", "explicá",
    "interpreta", "interprétame", "interpretame",
    "qué contiene", "que contiene", "qué hay en", "que hay en",
    "muéstrame", "muestrame", "muéstrame los", "muestrame los",
    "dime qué", "dime que", "cuéntame", "cuentame",
    "dame un resumen", "hazme un resumen", "házme un resumen",
    "describe", "descríbeme", "describeme",
)

# Verbos que sí indican GENERACIÓN. Si aparecen, el intent de generación
# vence al de lectura aunque también haya verbos de lectura.
_GENERATION_INTENT_VERBS: tuple[str, ...] = (
    "genera", "genérame", "generame", "generá",
    "crea", "créame", "creame", "creá",
    "exporta", "expórtame", "exportame",
    "descarga", "descárgame", "descargame",
    "produce", "prodúceme",
    "arma", "ármame", "armame",
    "haz un", "hazme un", "házme un",
    "construye", "constrúyeme", "construyeme",
)


def _has_generation_verb(text_lower: str) -> bool:
    return any(v in text_lower for v in _GENERATION_INTENT_VERBS)


def _has_read_verb(text_lower: str) -> bool:
    return any(v in text_lower for v in _READ_INTENT_VERBS)


def is_read_intent(user_text: str) -> bool:
    """True si el usuario pide LEER/analizar (no generar) un archivo.

    Útil para limitar `max_iterations` del loop y evitar exploración exhaustiva
    cuando el usuario solo pidió un resumen.
    """
    if not user_text:
        return False
    text = strip_file_context_block(user_text).lower()
    if not text:
        return False
    if _has_generation_verb(text):
        return False
    return _has_read_verb(text)


# Señales fuertes de intent PDF: palabras específicas que difícilmente aparezcan
# por accidente. Se usan para forzar `tool_choice="required"`.
_PDF_STRONG_KEYWORDS: tuple[str, ...] = (
    "pdf", "memo", "acta", "minuta", "cotización", "cotizacion",
    "orden de trabajo", "datasheet", "hoja de datos",
)


def has_pdf_intent(user_text: str) -> bool:
    """True si el mensaje del usuario activa el intent de PDF descargable.

    Se usa desde el loop de tool-calling para forzar `tool_choice="required"`
    y evitar el "no tengo herramienta habilitada" — el modelo SÍ la tiene
    (`generate_pdf_report` / `export_html_to_pdf`).

    No incluye "informe" a propósito: es demasiado genérico y colisiona con
    "resumen ejecutivo" de dashboard.

    Sanea el bloque `[Archivos de datos disponibles…]` que inyecta el
    backend para evitar falsos positivos cuando hay un PDF adjunto y el
    usuario solo dice "analízalo".
    """
    if not user_text:
        return False
    text = strip_file_context_block(user_text).lower()
    if not text:
        return False
    if not any(kw in text for kw in _PDF_STRONG_KEYWORDS):
        return False
    # Si el usuario solo pide leer/analizar y no hay verbo de generación,
    # NO es intent de generación de PDF.
    if _has_read_verb(text) and not _has_generation_verb(text):
        return False
    return True


# Señales fuertes de intent Excel: keywords que activan `tool_choice="required"`
# para que el modelo elija `generate_excel_report` en vez de `save_to_excel`.
_EXCEL_STRONG_KEYWORDS: tuple[str, ...] = (
    "excel", "xlsx", "hoja de cálculo", "hoja de calculo",
    "spreadsheet", "planilla", "libro de excel",
    "exporta a excel", "exportar a excel",
    "genera un excel", "generar excel", "dame un excel",
    "reporte ejecutivo", "dashboard ejecutivo",
    "estado de resultados",
)


# Amplificación: frases que solas son genéricas pero activan intent Excel si
# el historial reciente muestra un .xlsx recién generado. Resuelve el flujo
# "primer turno: genera excel simple → segundo turno: agrégale diseño".
_EXCEL_AMPLIFICATION_KEYWORDS: tuple[str, ...] = (
    "agrégale diseño", "agregale diseño", "agregale diseno",
    "con diseño", "con diseno",
    "dale formato", "mejora el formato", "mejor formato",
    "hazlo ejecutivo", "versión ejecutiva", "version ejecutiva",
    "con portada", "agrega portada",
    "con gráficos", "con graficos", "agrega gráficos", "agrega graficos",
    "con kpis", "con indicadores",
    "con el total", "agrega el total", "suma total",
    "mejóralo", "mejoralo",
    "hazlo bonito", "hazlo más bonito", "hazlo mas bonito",
    "más profesional", "mas profesional",
)


# Señales de historial: si el asistente acaba de entregar un .xlsx, cualquier
# pedido de "mejora/diseño" en el turno siguiente se interpreta como intent
# de reporte profesional.
_XLSX_FILENAME_RE = re.compile(r"\b[\w\-]+\.xlsx\b", re.IGNORECASE)
_HISTORY_EXCEL_SIGNAL_PHRASES: tuple[str, ...] = (
    "generé el excel", "generé un excel",
    "actualicé el excel", "actualice el excel",
    "creé el excel", "cree el excel",
    ".xlsx",
    "save_to_excel",
    "generate_excel_report",
)


def _history_has_excel_signal(
    conversation_history: list | None,
    lookback: int = 5,
) -> bool:
    """True si los últimos `lookback` mensajes muestran un Excel recién generado."""
    if not conversation_history:
        return False
    recent = conversation_history[-lookback:]
    for m in recent:
        text = _extract_text(m).lower()
        if not text:
            continue
        if any(p in text for p in _HISTORY_EXCEL_SIGNAL_PHRASES):
            return True
        if _XLSX_FILENAME_RE.search(text):
            return True
    return False


def has_excel_intent(
    user_text: str,
    conversation_history: list | None = None,
) -> bool:
    """True si el turno activa el intent de Excel profesional descargable.

    Fuerza `tool_choice="required"` en el loop para que el modelo elija
    `generate_excel_report` (reporte corporativo con Portada, KPIs, charts,
    bandas zebra) en vez de `save_to_excel` (dump simple sin formato).

    Dos vías de activación:
      1. Señal fuerte: el mensaje contiene una keyword dura (excel, xlsx,
         planilla, reporte ejecutivo, …).
      2. Amplificación: el mensaje es genérico ("agrégale diseño", "con
         portada", "hazlo ejecutivo") Y el historial reciente muestra que
         el asistente acaba de generar un .xlsx. Captura el flujo
         "primera versión simple → segunda versión con diseño".

    Sanea primero el bloque `[Archivos de datos disponibles…]` inyectado
    por el backend: si el usuario adjuntó un .xlsx la palabra "EXCEL"
    aparece como metadato del archivo, NO como intención de generar uno.
    Y si solo hay verbos de lectura ("analiza", "resume") sin verbo de
    generación, descarta el intent: el usuario quiere leer, no crear.
    """
    if not user_text:
        return False
    text = strip_file_context_block(user_text).lower()
    if not text:
        return False
    has_strong = any(kw in text for kw in _EXCEL_STRONG_KEYWORDS)
    has_amplification = any(kw in text for kw in _EXCEL_AMPLIFICATION_KEYWORDS)
    if not (has_strong or has_amplification):
        return False
    if _has_read_verb(text) and not _has_generation_verb(text):
        return False
    if has_strong:
        return True
    return _history_has_excel_signal(conversation_history)


def detect_relevant_skills(user_text: str) -> list[str]:
    """Retorna los kinds relevantes según keywords, en el orden estándar.

    Preemption: si se detecta `dashboard`, se descarta `chart` en el mismo turno.
    Motivo: cargar ambas skills en paralelo da señal competitiva al modelo — la
    skill de dashboard ya incluye el mapa de charts, así que la de chart sólo
    tienta al modelo a emitir `generate_chart_data` cuando el intent real es
    `generate_dashboard_data`.
    """
    if not user_text:
        return []
    text = user_text.lower()
    matched: list[str] = []
    for kind in _SKILL_ORDER:
        for kw in _KEYWORDS[kind]:
            if kw in text:
                matched.append(kind)
                break
    if "dashboard" in matched and "chart" in matched:
        matched = [k for k in matched if k != "chart"]
    # Si dashboard y pdf coexisten y el usuario NO dijo la palabra literal "pdf"
    # (se matcheó por "informe" u otro keyword genérico), el intent real es
    # dashboard — descartamos pdf para no confundir al modelo.
    if "dashboard" in matched and "pdf" in matched and "pdf" not in text:
        matched = [k for k in matched if k != "pdf"]
    # Mismo criterio para dashboard vs excel: "dashboard ejecutivo" matchea
    # ambos por "ejecutivo"/"dashboard". Si no hay keyword dura de Excel
    # ("excel", "xlsx", "planilla", "hoja de cálculo", "spreadsheet"), el
    # intent real es dashboard UI, no Excel.
    if "dashboard" in matched and "excel" in matched and not any(
        kw in text for kw in ("excel", "xlsx", "planilla", "hoja de cálculo", "hoja de calculo", "spreadsheet")
    ):
        matched = [k for k in matched if k != "excel"]
    return matched


def load_visualization_skills(
    user_text: str,
    kinds: Iterable[str] | None = None,
    max_skills: int = 3,
) -> str:
    """
    Retorna un bloque markdown concatenado con las skills relevantes, o `""`.

    - `kinds`: fuerza qué skills cargar (bypass del keyword-match).
    - `max_skills`: tope duro para no explotar el contexto (3 es suficiente para
      la gran mayoría de prompts reales).
    """
    selected: list[str]
    if kinds is not None:
        selected = [k for k in kinds if k in _SKILL_ORDER]
    else:
        selected = detect_relevant_skills(user_text)

    if not selected:
        return ""

    selected = selected[:max_skills]
    parts = ["# SKILLS DE VISUALIZACIÓN ACTIVAS"]
    parts.append(
        "Usa estas guías SÓLO cuando diseñes un componente UI. No las cites "
        "textualmente al usuario — son heurísticas para ti."
    )
    if "dashboard" in selected:
        parts.append(
            "⚠️ **INTENT DASHBOARD DETECTADO** — este turno DEBE terminar con "
            "exactamente UNA llamada a `generate_dashboard_data` con ≥4 paneles "
            "de tipos distintos. PROHIBIDO `generate_chart_data` en este turno, "
            "aunque leas múltiples hojas del Excel: consolida todos los datos "
            "en panels del mismo dashboard."
        )
    if "pdf" in selected:
        parts.append(
            "⚠️ **INTENT PDF DETECTADO** — llamá `generate_pdf_report` con un "
            "spec estructurado (o `export_html_to_pdf` sólo si el layout no "
            "encaja). NUNCA respondas 'no tengo herramienta para generar PDF' "
            "— SÍ la tenés. NUNCA pidas confirmación antes de llamarla."
        )
    if "excel" in selected:
        parts.append(
            "⚠️ **INTENT EXCEL DETECTADO** — llamá `generate_excel_report` con "
            "un spec declarativo (report_type, sheets[], columns tipadas, "
            "opcionalmente cover_sheet=true y summary_sheet.kpis). PROHIBIDO "
            "`save_to_excel` en este turno: produce un dump crudo sin portada, "
            "sin KPIs, sin charts, sin bandas zebra. Si el usuario pide "
            "'agregar diseño' a un Excel previo, genera uno NUEVO con "
            "`generate_excel_report` — NO uses `append_to_excel`."
        )
    for kind in selected:
        body = _read_skill(kind)
        if body:
            parts.append(body)
    return "\n\n".join(parts)


__all__ = [
    "detect_relevant_skills",
    "load_visualization_skills",
    "has_dashboard_intent",
    "has_pdf_intent",
    "has_excel_intent",
    "is_read_intent",
    "strip_file_context_block",
    "message_contains_hallucination",
    "message_claims_pdf_success",
]
