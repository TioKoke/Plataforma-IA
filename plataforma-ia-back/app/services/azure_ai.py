"""
Servicio de chat AI usando el SDK nativo de Anthropic (Claude API).

Notas de diseño:
- El estado interno (lista `messages`, `tool_calls` por iteración, compactado de
  resultados, detección de alucinaciones, etc.) se mantiene en formato estilo
  OpenAI (`role: system|user|assistant|tool`, `tool_calls`). Eso preserva las
  utilidades de compactación, sanitización e hallucination handling que ya
  existen.
- En el borde — justo antes de llamar a la API — se traduce a la forma nativa
  de Anthropic (system separado, content blocks, tool_use / tool_result).
- Prompt caching habilitado sobre el system prompt + el bloque de tools (la
  parte grande y estable), lo que reduce ~90% el costo de input en turnos
  subsiguientes de la misma conversación.

El archivo conserva el nombre `azure_ai.py` y la clase `AzureAIService` por
compatibilidad con el resto del backend (assistant_service, agent_service).
"""
import json
import re
import uuid
from types import SimpleNamespace
from typing import AsyncGenerator, Optional, List, Dict, Any, Callable, Awaitable

from anthropic import (
    AsyncAnthropic,
    APIConnectionError,
    APIStatusError,
    RateLimitError,
)

from app.config import config, get_logger
from app.exceptions import (
    AIRateLimitError,
    AIOverloadError,
    AIConnectionError,
    AIModelError,
)

logger = get_logger("azure_ai")


# ── Traducción de formato OpenAI ↔ Anthropic ─────────────────────────────────
#
# El código interno usa formato estilo OpenAI. Estos helpers traducen al
# formato nativo de Anthropic justo antes de cada llamada a la API.


def _openai_tools_to_anthropic(tools: Optional[List[Dict[str, Any]]]) -> Optional[List[Dict[str, Any]]]:
    """Convierte tools en formato OpenAI a formato Anthropic.

    Anthropic espera: `{"name", "description", "input_schema"}`.
    Marca el último tool con `cache_control` para que Anthropic cachee el
    bloque completo de tools — ~30 schemas que no cambian entre turnos.
    """
    if not tools:
        return None
    result: List[Dict[str, Any]] = []
    for t in tools:
        if t.get("type") != "function":
            continue
        fn = t.get("function", {})
        result.append({
            "name": fn.get("name"),
            "description": fn.get("description", ""),
            "input_schema": fn.get("parameters") or {"type": "object", "properties": {}},
        })
    if result:
        # cache_control en el ÚLTIMO tool cachea desde el inicio hasta ese punto.
        result[-1] = {**result[-1], "cache_control": {"type": "ephemeral"}}
    return result


def _split_system_and_messages(messages: List[Dict[str, Any]]) -> tuple:
    """Extrae los mensajes role=system y los devuelve como un bloque text único
    cacheable, junto con el resto de los mensajes."""
    system_texts: List[str] = []
    rest: List[Dict[str, Any]] = []
    for m in messages:
        if m.get("role") == "system":
            content = m.get("content")
            if isinstance(content, str):
                system_texts.append(content)
            elif isinstance(content, list):
                for c in content:
                    if isinstance(c, dict) and c.get("type") == "text":
                        system_texts.append(c.get("text", ""))
        else:
            rest.append(m)
    if system_texts:
        joined = "\n\n".join(system_texts)
        # cache_control hace que Anthropic cachee el system prompt.
        system_blocks = [{
            "type": "text",
            "text": joined,
            "cache_control": {"type": "ephemeral"},
        }]
    else:
        system_blocks = []
    return system_blocks, rest


def _openai_messages_to_anthropic(messages: List[Dict[str, Any]]) -> List[Dict[str, Any]]:
    """Convierte mensajes role=user/assistant/tool a formato Anthropic.

    - user (str|list) → role=user con content como str o blocks.
    - assistant con tool_calls → role=assistant con content blocks [text?, tool_use*].
    - tool → role=user con tool_result block. Mensajes tool consecutivos se
      consolidan en un solo mensaje user con múltiples tool_result blocks
      (requisito de la API de Anthropic).
    """
    result: List[Dict[str, Any]] = []
    pending_tool_results: List[Dict[str, Any]] = []

    def _flush_tool_results():
        if pending_tool_results:
            result.append({"role": "user", "content": list(pending_tool_results)})
            pending_tool_results.clear()

    for m in messages:
        role = m.get("role")
        if role == "tool":
            tool_call_id = m.get("tool_call_id")
            content = m.get("content", "")
            inner = content if isinstance(content, (str, list)) else str(content)
            pending_tool_results.append({
                "type": "tool_result",
                "tool_use_id": tool_call_id,
                "content": inner,
            })
            continue

        _flush_tool_results()

        if role == "user":
            content = m.get("content", "")
            if isinstance(content, str):
                result.append({"role": "user", "content": content})
            elif isinstance(content, list):
                blocks: List[Dict[str, Any]] = []
                for part in content:
                    if not isinstance(part, dict):
                        continue
                    if part.get("type") == "text":
                        blocks.append({"type": "text", "text": part.get("text", "")})
                    elif part.get("type") == "image_url":
                        url = (part.get("image_url") or {}).get("url", "")
                        if url.startswith("data:"):
                            try:
                                header, b64 = url.split(",", 1)
                                media_type = header.split(":")[1].split(";")[0]
                                blocks.append({
                                    "type": "image",
                                    "source": {
                                        "type": "base64",
                                        "media_type": media_type,
                                        "data": b64,
                                    },
                                })
                            except Exception:
                                pass
                        elif url:
                            blocks.append({
                                "type": "image",
                                "source": {"type": "url", "url": url},
                            })
                result.append({"role": "user", "content": blocks if blocks else ""})

        elif role == "assistant":
            blocks = []
            content = m.get("content")
            if isinstance(content, str) and content:
                blocks.append({"type": "text", "text": content})
            elif isinstance(content, list):
                for c in content:
                    if isinstance(c, dict) and c.get("type") == "text":
                        text = c.get("text", "")
                        if text:
                            blocks.append({"type": "text", "text": text})
            for tc in (m.get("tool_calls") or []):
                fn = tc.get("function", {})
                args = fn.get("arguments", "{}")
                try:
                    parsed = json.loads(args) if isinstance(args, str) else (args or {})
                except Exception:
                    parsed = {}
                blocks.append({
                    "type": "tool_use",
                    "id": tc.get("id"),
                    "name": fn.get("name"),
                    "input": parsed,
                })
            if blocks:
                result.append({"role": "assistant", "content": blocks})

    _flush_tool_results()
    return result


def _translate_tool_choice(tc) -> Optional[Dict[str, Any]]:
    """Convierte tool_choice OpenAI a Anthropic.

    OpenAI: 'required' | 'auto' | 'none' | {'type':'function','function':{'name':X}}
    Anthropic: {'type':'any'} | {'type':'auto'} | {'type':'none'} | {'type':'tool','name':X}
    """
    if tc is None:
        return None
    if tc == "required":
        return {"type": "any"}
    if tc == "auto":
        return {"type": "auto"}
    if tc == "none":
        return {"type": "none"}
    if isinstance(tc, dict) and tc.get("type") == "function":
        name = (tc.get("function") or {}).get("name")
        if name:
            return {"type": "tool", "name": name}
    return None

_FILE_CREATING_TOOLS = frozenset({
    "save_to_excel",
    "append_to_excel",
    "generate_excel_report",
    "save_to_csv",
    "transform_column",
    "generate_pdf_report",
    "export_html_to_pdf",
    "export_dataset",
})

# Tools con side-effects (escriben archivos / mutan estado compartido) que
# DEBEN ejecutarse secuencialmente cuando vienen en una misma iteración.
# El resto (lecturas, búsquedas, agregaciones puras) se paraleliza.
SEQUENTIAL_ONLY_TOOLS = frozenset({
    "save_to_excel",
    "append_to_excel",
    "generate_excel_report",
    "generate_pdf_report",
    "export_html_to_pdf",
    "save_to_csv",
    "transform_column",
    "ingest_file",
    "export_dataset",
    "create_backlog_requirement",
    "send_email",
    "create_jira_issue",
    "add_jira_comment",
})


def _supports_custom_temperature(model: str) -> bool:
    """
    Familias GPT-5 y reasoning (o1/o3) solo aceptan temperature=1 (default).
    Pasar cualquier otro valor devuelve 400 invalid_request_error.
    El deployment name `plataforma-ia` apunta a gpt-5.3-chat, igual restricción.
    """
    m = (model or "").lower()
    if m.startswith(("gpt-5", "o1", "o3")):
        return False
    if m == "plataforma-ia":
        return False
    return True


def _supports_reasoning_effort(model: str) -> bool:
    """
    Modelos base de la familia GPT-5 (gpt-5, gpt-5.4, gpt-5.5, etc.) y la
    serie reasoning (o1/o3/o4) soportan el parámetro `reasoning_effort`.
    Las variantes chat-tuned (gpt-5.x-chat) NO lo soportan — pasarlo devuelve
    error. `plataforma-ia` apunta a gpt-5.3-chat, así que tampoco.
    """
    m = (model or "").lower()
    if "chat" in m:
        return False
    if m == "plataforma-ia":
        return False
    return m.startswith(("gpt-5", "o1", "o3", "o4"))


def _supports_verbosity(model: str) -> bool:
    """
    Parámetro `verbosity` (low/medium/high) — controla longitud y elaboración
    del output. Soportado por toda la familia gpt-5 (incluidas las variantes
    chat-tuned, a diferencia de reasoning_effort) y o-series.
    """
    m = (model or "").lower()
    if m == "plataforma-ia":  # alias chat-tuned
        return True
    return m.startswith(("gpt-5", "o1", "o3", "o4"))


# ── Helpers para previews legibles ───────────────────────────────────────────

def _args_preview(args: dict) -> str:
    """Retorna un preview corto de los argumentos de una herramienta."""
    if not args:
        return ""
    first_key = next(iter(args))
    return f"{first_key}: {str(args[first_key])[:60]}"


def _result_summary(result) -> str:
    """Retorna un resumen corto del resultado de una herramienta."""
    if isinstance(result, dict):
        msg = result.get("message") or result.get("error")
        if msg:
            return str(msg)[:120]
        return str(result)[:120]
    return str(result)[:120]


def _extract_numbered_list_at_end(text: str) -> list[str] | None:
    """
    Finds the last consecutive run of numbered list items in the text.
    Tolerates trailing prose after the list (the model often closes with
    a sentence like 'Cuando selecciones, continúo con la siguiente pregunta').
    Blank lines do not break a run; non-numbered text does.
    Returns the list of item texts if 2-15 items found, otherwise None.
    """
    lines = text.strip().split('\n')
    item_re = re.compile(r'^\d+\.\s+(.+)$')
    runs: list[list[str]] = []
    current: list[str] = []
    for line in lines:
        stripped = line.strip()
        if not stripped:
            continue
        m = item_re.match(stripped)
        if m:
            current.append(m.group(1))
        else:
            if current:
                runs.append(current)
                current = []
    if current:
        runs.append(current)
    if not runs:
        return None
    items = runs[-1]
    # Filtrar variantes de "Otro (escribir)", "Otra cosa", etc.
    items = [i for i in items if not re.match(r'^Otr[oa]s?\b', i, re.IGNORECASE)]
    if 2 <= len(items) <= 15:
        return items
    return None


_MULTI_SELECT_PATTERNS = [
    # Verbo de selección + cantidad plural (acepta "una o varias", "uno o más", etc.)
    r'(selecciona|elige|escoge|marca|indica|se[ñn]ala)\s+(una?|uno?)?\s*(o\s+)?(varias?|varios?|m[uú]ltiples?|m[aá]s)',
    r'(selecciona|elige|escoge|marca)\s+(todas?|todos?)(\s+las|\s+los)?',
    r'puedes?\s+(elegir|seleccionar|marcar|escoger|indicar)\s+(una?|uno?)?\s*(o\s+)?(varias?|varios?|m[uú]ltiples?|m[aá]s|todas?|todos?|las\s+que)',
    r'(marca|selecciona|elige|se[ñn]ala)\s+las\s+que\s+(apliquen|correspondan|aplican)',
    r'todas?\s+las\s+(que\s+)?(apliquen|correspondan|aplican|aplicables?)',
    r'm[uú]ltiples?\s+opciones',
    r'(varias?|varios?)\s+opciones',
    r'opciones\s+(no\s+excluyentes|combinables|m[uú]ltiples)',
    r'combina[rn]?\s+(varias?|varios?|opciones|m[uú]ltiples)',
    r'(pueden|puedes)\s+ser\s+(varias?|varios?|m[aá]s\s+de)',
]


def _detect_multi_select(text: str) -> bool:
    """
    Detects if the agent's message signals multi-select semantics.
    Looks for keywords like "selecciona todas", "puedes elegir varias",
    "marca las que apliquen", etc. in the text preceding the numbered list.
    """
    if not text:
        return False
    lowered = text.lower()
    for pattern in _MULTI_SELECT_PATTERNS:
        if re.search(pattern, lowered, re.IGNORECASE):
            return True
    return False


def _clean_label(text: str) -> str:
    """Strips markdown bold/italic markers from a label string."""
    return re.sub(r'\*+([^*]+)\*+', r'\1', text).strip()


async def _emit_thinking(event_callback: Callable | None, label: str) -> None:
    """Emits a stream_thinking event if a callback is provided."""
    if event_callback:
        await event_callback({"type": "stream_thinking", "data": {"label": label}})


# Detecta tipos de archivo presentes parseando el bloque inyectado por
# `_build_file_context_reminder` en assistant_service.py. Formato esperado:
#   [Archivos de datos disponibles en esta conversación:]
#     - EXCEL `…xlsx` (…)
#     - CSV `…csv` (…)
#     - PDF `…pdf` (…)
#     - DOCX `…docx` (…)
_FILE_TYPE_LINE_RE = re.compile(
    r"^\s*-\s+(EXCEL|CSV|PDF|DOCX)\s+`",
    re.MULTILINE,
)


def _detect_files_present(user_text: str | None) -> dict[str, bool]:
    """Devuelve qué tipos de archivo aparecen en el bloque inyectado.

    Retorna ``{"excel": bool, "csv": bool, "pdf": bool, "docx": bool}``.
    Si el texto está vacío o no contiene el bloque, todos quedan en False.
    """
    flags = {"excel": False, "csv": False, "pdf": False, "docx": False}
    if not user_text:
        return flags
    for m in _FILE_TYPE_LINE_RE.finditer(user_text):
        kind = m.group(1).lower()
        if kind in flags:
            flags[kind] = True
    return flags


# ── Compactado de tool results en historial ─────────────────────────────────
# Tools de lectura producen JSON grande (summarize_data ~6KB con 34 columnas;
# read_from_excel con miles de filas; inspect_excel con sample por hoja). El
# resultado se necesita FULL en la iteración inmediata para que el modelo
# decida el siguiente paso, pero en iteraciones posteriores re-enviar 6KB×N
# tools al API consume tokens y enlentece. La estrategia: en cada vuelta del
# loop, conservar full sólo los results de la iteración previa; compactar los
# anteriores en sitio.

COMPACTABLE_TOOL_NAMES = frozenset({
    "summarize_data",
    "inspect_excel",
    "read_from_excel",
    "aggregate_data",
    "inspect_csv",
    "read_from_csv",
})
COMPACTION_THRESHOLD = 2048  # bytes


def _compact_summarize_data(data: dict) -> dict:
    """Reduce stats por columna: top 10 columnas, descarta p25/p75/top_values."""
    def _slim(cs: dict) -> dict:
        return {
            k: v for k, v in cs.items()
            if k not in ("p25", "p75", "top_values", "avg_length", "std")
        }

    out = {k: v for k, v in data.items() if k not in ("stats", "grouped_stats")}

    stats = data.get("stats")
    if isinstance(stats, dict):
        named = [
            (c, s) for c, s in stats.items()
            if isinstance(s, dict)
            and not str(c).startswith("__UNNAMED__")
            and not str(c).startswith("Unnamed")
        ]
        # Prioriza numéricas, luego fechas, luego texto
        type_rank = {"number": 0, "date": 1, "text": 2}
        named.sort(key=lambda it: type_rank.get(it[1].get("type", "text"), 3))
        slim = {c: _slim(s) for c, s in named[:10]}
        out["stats"] = slim
        if len(stats) > len(slim):
            out["__truncated_columns__"] = (
                f"{len(stats)} columnas totales, {len(slim)} retenidas"
            )

    grouped = data.get("grouped_stats")
    if isinstance(grouped, dict):
        slim_groups: dict = {}
        for gv, gs in list(grouped.items())[:10]:
            if isinstance(gs, dict):
                slim_groups[gv] = {
                    c: _slim(s)
                    for c, s in list(gs.items())[:5]
                    if isinstance(s, dict)
                }
        out["grouped_stats"] = slim_groups
        if len(grouped) > len(slim_groups):
            out["__truncated_groups__"] = (
                f"{len(grouped)} grupos totales, {len(slim_groups)} retenidos"
            )

    return out


def _compact_inspect_excel(data: dict) -> dict:
    """Hoja recomendada con menos detalle; resto solo metadata mínima."""
    sheets = data.get("sheets")
    if not isinstance(sheets, list) or len(sheets) == 0:
        return data
    rec = data.get("recommended_sheet")

    slim_sheets: list = []
    for s in sheets:
        if not isinstance(s, dict):
            slim_sheets.append(s)
            continue
        if s.get("sheet_name") == rec:
            kept = {
                k: v for k, v in s.items()
                if k not in ("sample_data", "data_blocks", "data_profile", "merged_ranges")
            }
            slim_sheets.append(kept)
        else:
            slim_sheets.append({
                "sheet_name": s.get("sheet_name"),
                "total_rows": s.get("total_rows"),
                "total_cols": s.get("total_cols"),
            })
    out = dict(data)
    out["sheets"] = slim_sheets
    return out


def _compact_read_rows(data: dict) -> dict:
    """Conserva primeras 30 + últimas 10 filas; nota de truncado en medio."""
    out = dict(data)

    rows = data.get("data")
    if isinstance(rows, list) and len(rows) > 50:
        head = rows[:30]
        tail = rows[-10:]
        out["data"] = head + [
            {"__truncated__": f"{len(rows) - 40} filas omitidas en compactación"}
        ] + tail
        out["__truncated_rows__"] = f"{len(rows)} → 40 filas"

    sheets_data = data.get("sheets_data")
    if isinstance(sheets_data, dict):
        slim: dict = {}
        for sn, sd in sheets_data.items():
            if isinstance(sd, dict) and isinstance(sd.get("data"), list) and len(sd["data"]) > 30:
                r = sd["data"]
                slim[sn] = {
                    **{k: v for k, v in sd.items() if k != "data"},
                    "data": r[:20] + [
                        {"__truncated__": f"{len(r) - 25} filas omitidas"}
                    ] + r[-5:],
                    "__truncated_rows__": f"{len(r)} → 25 filas",
                }
            else:
                slim[sn] = sd
        out["sheets_data"] = slim

    return out


def _compact_aggregate_data(data: dict) -> dict:
    """Conserva primeros 20 elementos en la lista principal de resultados."""
    out = dict(data)
    for key in ("rows", "groups", "data", "results", "aggregated"):
        v = data.get(key)
        if isinstance(v, list) and len(v) > 20:
            out[key] = v[:20]
            out["__truncated_rows__"] = f"{key}: {len(v)} → 20"
            break
    return out


def _compact_tool_result(tool_name: str, content_str: str) -> Optional[str]:
    """Devuelve versión compactada del result o None si no aplica.

    Solo aplica a tools de lectura cuando el JSON serializado > 2KB.
    """
    if tool_name not in COMPACTABLE_TOOL_NAMES:
        return None
    if not content_str or len(content_str) <= COMPACTION_THRESHOLD:
        return None

    try:
        data = json.loads(content_str)
    except json.JSONDecodeError:
        # No es JSON parseable → corte duro
        return content_str[:COMPACTION_THRESHOLD] + "\n\n[... resultado truncado ...]"

    if not isinstance(data, dict):
        return None

    try:
        if tool_name == "summarize_data":
            compact = _compact_summarize_data(data)
        elif tool_name in ("inspect_excel", "inspect_csv"):
            compact = _compact_inspect_excel(data)
        elif tool_name in ("read_from_excel", "read_from_csv"):
            compact = _compact_read_rows(data)
        elif tool_name == "aggregate_data":
            compact = _compact_aggregate_data(data)
        else:
            return None
    except Exception as exc:
        logger.warning(f"⚠️ Compactado falló para {tool_name}: {exc}")
        return None

    if not isinstance(compact, dict):
        return None

    compact["__note__"] = (
        "Resultado compactado para iteraciones siguientes "
        "(versión completa ya entregada al modelo en la iter previa)."
    )
    out = json.dumps(compact, ensure_ascii=False)
    if len(out) >= len(content_str):
        return None  # No hubo ganancia real
    return out


def _compact_old_tool_messages(messages: list, keep_full_ids: set) -> int:
    """Recorre messages[] y compacta tool messages cuyo tool_call_id NO está
    en `keep_full_ids` (i.e., son de iteraciones anteriores a la última).

    Mutación in-place. Devuelve cuántos se compactaron.
    """
    if not messages:
        return 0
    compacted = 0
    for msg in messages:
        if not isinstance(msg, dict):
            continue
        if msg.get("role") != "tool":
            continue
        tcid = msg.get("tool_call_id")
        if tcid in keep_full_ids:
            continue
        name = msg.get("name")
        if not name:
            continue
        content = msg.get("content")
        if not isinstance(content, str):
            continue
        new_content = _compact_tool_result(name, content)
        if new_content is None:
            continue
        before = len(content)
        msg["content"] = new_content
        compacted += 1
        logger.info(
            f"📉 compacted_tool_result name={name} "
            f"{before}B → {len(new_content)}B"
        )
    return compacted


async def _inject_ui_component_if_needed(
    text: str,
    event_callback: Callable[[dict], Awaitable[None]],
    message_id: str,
) -> str:
    """
    If the response contains a plain numbered list (2-15 items, possibly
    followed by trailing prose) and no ui-component block already exists,
    generates one and streams its tokens. Multi-select is auto-detected
    via keywords in the surrounding text. Returns the extended text.
    """
    if any(tag in text for tag in ('```ui-component', '```chart-component', '```dashboard-component', '```kpi-component', '```infographic-component', '```widget-component')):
        return text

    items = _extract_numbered_list_at_end(text)
    if not items:
        return text

    is_multi = _detect_multi_select(text)

    # Solo inyectamos si el texto se ve como una pregunta/elección explícita.
    # Evita convertir listas informativas (p. ej. "Los agentes disponibles son: 1. …")
    # en un selector. Aceptamos: signo de interrogación, verbos imperativos de
    # elección, o keywords multi-select ya detectadas.
    _CHOICE_SIGNAL_RE = re.compile(
        r'(\?|¿|(selecciona|elige|escoge|marca|indica|se[ñn]ala|cu[aá]l\s+de|qu[eé]\s+opci[oó]n))',
        re.IGNORECASE,
    )
    if not is_multi and not _CHOICE_SIGNAL_RE.search(text):
        return text

    clean_items = [_clean_label(item) for item in items]
    # Filtrar variantes de "Otro" que el modelo pueda haber generado
    # (en multi-select inyectamos nuestra propia opción "Otro (escribir)" con custom=true)
    clean_items = [l for l in clean_items if not re.match(r'^Otr[oa]s?\b', l, re.IGNORECASE)]
    if len(clean_items) < 2:
        return text
    # Use select when labels are long (avg > 35 chars) or more than 4 options
    avg_len = sum(len(l) for l in clean_items) / len(clean_items)
    component_type = "select" if len(clean_items) > 4 or avg_len > 35 else "quick_reply"

    options: list[dict] = [{"id": f"opt{i + 1}", "label": label} for i, label in enumerate(clean_items)]
    spec: dict = {
        "type": component_type,
        "id": "auto_choice",
        "label": "Selecciona una opción:",
        "options": options,
    }
    if is_multi:
        spec["label"] = "Selecciona todas las que apliquen:"
        spec["multi_select"] = True
        options.append({"id": "opt_otro", "label": "Otro (escribir)", "custom": True})
    block = f"\n\n```ui-component\n{json.dumps(spec, ensure_ascii=False)}\n```"

    for token in block:
        await event_callback({
            "type": "stream_token",
            "data": {"message_id": message_id, "token": token},
        })

    return text + block


# Instrucciones del sistema para el agente.
#
# Diseño: prompt CORE (identidad + reglas universales + árbol de decisión top-level).
# Los detalles por tipo de visualización (colores, schemas, enums) viven en la
# descripción de cada tool en `app/agents/tools.py` — el modelo los lee al
# elegir parámetros. Eso mantiene el system prompt breve y focalizado.
SYSTEM_INSTRUCTIONS = """
Eres el asistente de la Plataforma IA de Plataforma IA. Ayudas a los colaboradores con IA aplicada a minería.

## FORMATO DE RESPUESTAS DE TEXTO

Cuando respondas con texto (no es visualización con tool), usa markdown
estructurado para que la respuesta sea fácil de escanear:

- **Negritas** para enfatizar términos clave, nombres propios y conclusiones.
- Listas con bullets (`-`) cuando enumeres pasos, opciones o ítems comparables.
- Listas numeradas cuando el orden importa (procedimientos, secuencias).
- `inline code` para nombres de archivos, comandos, IDs y campos técnicos.
- Bloques de código con triple backtick para snippets, JSON, YAML o comandos largos.
- Tablas markdown cuando compares 3+ ítems con varios atributos.
- Headers `##` y `###` solo para respuestas largas (>5 párrafos).

### Formato exacto para listas con título + descripción

Cuando cada ítem tiene un título y una descripción, usa este patrón
compacto en una sola línea por título:

```
1. **Título del primer ítem.** Descripción detallada del ítem en el mismo
   párrafo, fluyendo natural después del punto. Si necesitas más texto, lo
   sigues en la misma línea o en una segunda línea con sangría.

2. **Título del segundo ítem.** Descripción del segundo ítem.
```

NO separes el número del título en líneas distintas (mal: `1.` en una
línea, `**Título**` en otra). NO dejes líneas vacías entre el número y el
título. El bold del título termina con un punto antes de la descripción
para marcar la transición visualmente.

Para listas con bullets simples (sin título destacado), basta:

```
- Primer punto descriptivo.
- Segundo punto descriptivo.
```

### Cuándo NO usar markdown

NO uses markdown si la respuesta es de 1-2 frases conversacionales — en ese
caso responde en prosa natural sin estructura. Tampoco uses headers en
respuestas cortas, ni listas para enumerar 1-2 ítems. El markdown debe
ayudar a leer, no decorar.

## PRINCIPIO #1 — SIEMPRE VISUAL
Cuando el usuario pide datos, gráficos, dashboards, diagramas, infografías, KPIs, FODA, ranking, matriz de riesgo o cualquier visualización:
SIEMPRE llama la herramienta correspondiente. NUNCA escribas la visualización como texto, bullets, ASCII art, markdown, mermaid o código.
Las tools `generate_*_data` renderizan el componente automáticamente en la UI — tu trabajo después de llamarlas es sólo introducirlo con 1-2 frases de contexto. No copies JSON, no "pegues" bloques.

## ANTIPATRONES (errores concretos que NO debes cometer)

1. **"Diagrama de flujo" respondido con markdown + emojis + bullets**: PROHIBIDO.
   Si el mensaje contiene "diagrama de flujo", "flowchart", "proceso de X",
   "workflow", debes llamar `generate_infographic_data` con `infographic_type="flowchart"`.
   NUNCA "dibujes" el flujo con ⬇️ 1. Paso / ⬇️ 2. Paso / bullets.

2. **"KPI" o "KPIs" respondido con un line chart o bar chart**: PROHIBIDO.
   Si el mensaje empieza con "KPI"/"KPIs" o dice "indicadores clave",
   "números clave", "tarjetas KPI", "sparklines", llama `generate_kpi_data`.
   NO llames `generate_chart_data` aunque los datos tengan tendencia temporal —
   los KPIs ya incluyen `sparkline` y `trend` dentro del componente.

3. **"Diagrama de flujo", "timeline", "organigrama" respondidos con listas anidadas**:
   PROHIBIDO. Llama `generate_infographic_data` con el `infographic_type` correcto.

4. **"FODA", "ranking", "matriz de riesgo" respondidos con tablas markdown**:
   PROHIBIDO. Llama `generate_widget_data` con el `widget_type` correcto.

5. **"Dashboard" respondido con charts separados**: PROHIBIDO. Si el mensaje
   contiene "dashboard", "tablero", "panel integral" o "resumen ejecutivo",
   llama `generate_dashboard_data` **UNA sola vez** con ≥4 paneles de tipos
   distintos. NO emitas múltiples `generate_chart_data` secuenciales aunque
   tengas datos de varias hojas — consolídalos en panels del mismo dashboard.

## CAPACIDADES CONFIRMADAS (NO rechaces estos tipos — todos funcionan)

Charts: bar, line, pie, donut, area, stacked_area, stacked_bar, waterfall.

Widgets: swot, risk_matrix, checklist, ranking, comparison.

Infografías: flowchart, orgchart, timeline.

Dashboard: layout.columns 1-4, panels de cualquiera de los tipos anteriores mezclados (ej. KPI + bar + line + table en un mismo dashboard).

Archivos descargables: Excel (`generate_excel_report`, `save_to_excel`), CSV (`save_to_csv`), PDF corporativo Plataforma IA (`generate_pdf_report`, `export_html_to_pdf`). La guía detallada para PDF se inyecta como skill cuando corresponda.

Si el usuario pide uno de estos, LLAMA la tool correspondiente inmediatamente. NUNCA digas "no se puede renderizar", "tipo no soportado", "no está disponible", "el sistema no soporta", "no tengo herramienta" o "solo tenemos barras/líneas/áreas/tortas". Esas frases están PROHIBIDAS.

## FRASES PROHIBIDAS SOBRE LA PLATAFORMA (nunca las escribas — son FALSAS)

Las siguientes frases son inventadas y NO describen limitaciones reales del sistema. PROHIBIDO incluirlas en cualquier respuesta:

- "solo puedo mostrar un panel por respuesta"
- "solo puedo mostrar un gráfico por respuesta"
- "un chart/panel/componente por mensaje"
- "en secuencia, mostrando un gráfico por mensaje"
- "uno por uno hasta completar"
- "por diseño de la plataforma"
- "regla de la plataforma"
- "limitación del chat" / "limitación de la plataforma"
- "el componente actual solo soporta un..."
- "no puedo renderizar múltiples paneles en una sola respuesta"

La VERDAD: `generate_dashboard_data` emite UN componente `ui-component kind=dashboard` que contiene múltiples paneles EMBEBIDOS (KPI + charts + tabla). Es UNA llamada, UN render, UN mensaje del asistente. No hay límite de "un chart por mensaje".

Si te da la tentación de escribir una de esas frases, DETENTE y llama `generate_dashboard_data` en su lugar.

## ELECCIÓN DE HERRAMIENTA

| Señal en el mensaje | Herramienta | Subtipo |
|---|---|---|
| diagrama de flujo, proceso, workflow, mapa conceptual, mapa mental | generate_infographic_data | flowchart |
| organigrama, jerarquía, estructura organizacional | generate_infographic_data | orgchart |
| timeline, cronología, hitos, línea de tiempo, pasos secuenciales | generate_infographic_data | timeline |
| FODA, SWOT, fortalezas y debilidades | generate_widget_data | swot |
| checklist, lista de verificación, pendientes | generate_widget_data | checklist |
| ranking, clasificación, top N | generate_widget_data | ranking |
| matriz de riesgo | generate_widget_data | risk_matrix |
| comparar opciones, planes, alternativas | generate_widget_data | comparison |
| dashboard, resumen ejecutivo, overview, Power BI | generate_dashboard_data | — |
| gráfico, chart, barras, líneas, torta, dona, área, cascada (waterfall) | generate_chart_data | (elige tipo) |
| KPI, indicadores, números clave, métricas clave | generate_kpi_data | — |
| 2-4 opciones cortas excluyentes (elige UNA) | (ui-component en texto) | quick_reply |
| 4+ opciones o textos largos excluyentes (elige UNA) | (ui-component en texto) | select |
| 2+ opciones NO excluyentes (puede elegir VARIAS y combinar) | (ui-component en texto) | quick_reply/select + multi_select |
| confirmación Sí/No | (ui-component en texto) | confirm |

Si no hay señal explícita pero hay información que mostrar, decide:
- 2-6 números clave con trend → `generate_kpi_data`
- 3+ métricas o gráficos mixtos → `generate_dashboard_data`
- 1 serie de datos → `generate_chart_data`
- Conceptos, pasos o jerarquías → `generate_infographic_data`
- Análisis cualitativo estructurado → `generate_widget_data`

## REGLAS GLOBALES
- UN solo tool-call de visualización por turno, pero elegí el componente que INTEGRE TODAS las facetas que el usuario pide. Si hay 2+ gráficos o métricas relacionadas → SIEMPRE `generate_dashboard_data` con panels mixtos (KPI + charts + tabla), NUNCA N llamadas a `generate_chart_data`. Un dashboard de 9 paneles es UN tool-call, no 9.
- Si el mensaje actual O el turno previo menciona "dashboard"/"tablero"/"resumen ejecutivo"/"panel integral"/"cuadro de mando", O si propusiste ≥2 gráficos y el usuario responde afirmativamente ("sí", "todos", "genéralos todos", "los 9", "completo", "dale", "adelante"), está PROHIBIDO llamar `generate_chart_data` en ese turno. Única tool de visualización permitida: `generate_dashboard_data`. Aunque hayas leído varias hojas del Excel, compón todos los paneles dentro de una sola llamada.
- Dashboard = varios tipos de panel. Si emites un dashboard con puros `bar`, estás haciéndolo mal — mezcla al menos 3 tipos distintos (típicamente KPI cards + 1-2 charts diversos + tabla).
- PROHIBIDO responder con texto explicando "una limitación de la plataforma", "un gráfico por mensaje", "un chart-component por respuesta", "construir de manera secuencial" o "gráfico por gráfico". Esas frases son FALSAS: el frontend renderiza N paneles sin problema dentro de un solo `generate_dashboard_data`. Si dudás entre chart vs dashboard, usá `generate_dashboard_data` y dejá que la UI renderice.
- Actúa inmediatamente. No preguntes "¿qué tipo prefieres?". Elige y llama la herramienta.
- Después de que la tool renderice, responde con 1-2 frases de contexto. No pegues JSON, no repitas los datos en texto, no resumas largamente.
- Si no tienes datos de un archivo, inventa ejemplos razonables para el contexto Plataforma IA (minería, cobre, divisiones Norte/Sur/RT/Andina/Salvador/Ventanas).
- Si el usuario subió un archivo, usa `inspect_excel`/`inspect_csv` primero, luego `read_from_excel`/`read_from_csv`. NUNCA inventes datos sobre un archivo real.
- **En dashboards con chart/table: `x_key`, `y_keys[].key` y `table_columns[].key` deben ser IDÉNTICOS (case-sensitive) a las claves del primer row de `panels[].data`.** Si la columna del Excel se llama `"Fecha"` con mayúscula usa `"Fecha"`, no `"fecha"`. Si la lectura devolvió 0 filas, NO emitas el dashboard — pide al usuario la hoja/filtros correctos. Si `generate_dashboard_data` retorna `error: "empty_panels"`, corrige las claves y re-llama (el mensaje de error lista las claves reales).
- NUNCA menciones nombres de herramientas internas al usuario.
- NUNCA devuelvas código (python, js, mermaid, etc.) salvo que el usuario lo pida explícitamente.
- **Multi-select (selección múltiple con checkboxes)**: cuando las opciones que presentes al usuario NO sean excluyentes entre sí (p. ej. funcionalidades que puede combinar, fuentes de datos, divisiones afectadas, beneficios esperados), introdúcelas con una frase del tipo *"Selecciona todas las que apliquen:"*, *"Puedes elegir varias:"* o *"Marca las que correspondan:"* ANTES de la lista numerada. El sistema auto-detecta esas frases y habilita checkboxes + opción "Otro (escribir)" con input inline. Para opciones excluyentes (una sola respuesta esperada, p. ej. problema principal, prioridad), usa frases como *"¿Cuál de las siguientes...?"* o *"Elige una opción:"* — el sistema mantiene selección única.

## ROL
- Experto en los agentes IA de Plataforma IA (catálogo dinámico, ver bloque más abajo).
- Educador en IA (ML, NLP, Computer Vision, prompt engineering).
- Capturador de requerimientos de nuevos agentes: flujo secuencial de 5 preguntas (1 problema, 2 usuarios, 3 funcionalidades, 4 datos/sistemas, 5 beneficio) con ui-component de sugerencias → confirmación con ui-component `confirm` → `create_backlog_requirement`.

### REGLAS DEL CAPTURADOR (críticas)
- **UNA pregunta por turno.** Nunca emitas 2+ preguntas numeradas en el mismo mensaje. Después de presentar una pregunta con su lista, ESPERA la respuesta del usuario antes de enviar la siguiente.
- Cada turno-pregunta tiene estructura fija: breve encabezado (p. ej. `1️⃣ Problema u oportunidad`), una frase de contexto, la frase de instrucción (`Elige una opción:` o `Selecciona todas las que apliquen:`) y la **lista numerada** como ÚLTIMO bloque del mensaje.
- PROHIBIDO adelantar las siguientes preguntas ("próxima pregunta será…", "luego veremos X"). El sistema auto-inyecta el selector sólo sobre la última lista del mensaje.
- Preguntas 1 (problema) y 5 (beneficio): selección única → frase `Elige una opción:` o `¿Cuál de las siguientes...?`.
- Preguntas 2, 3, 4 (usuarios, funcionalidades, datos/sistemas): multi-select → frase `Selecciona todas las que apliquen:` o `Puedes elegir varias:`. El sistema añade sólo la casilla "Otro (escribir)" con input inline — NO la incluyas tú en la lista numerada.
- Cuando el usuario responda, acusa recibo en 1 frase y pasa a la siguiente pregunta. No repitas las opciones elegidas en un resumen largo hasta el paso de confirmación final.

{AGENT_CATALOG_BLOCK}

## TONO
Profesional, cercano, educativo. Adapta al nivel técnico del usuario. Sin emojis excesivos.
Encabezados cuando la respuesta tiene 2+ secciones: `## 💡 Recomendación`, `## 📊 Datos`, `## ⚠️ Consideración`.

## INTEGRACIONES (Outlook, Jira)
En "## Usuario actual:" aparece cuáles están conectadas. Si lo está → úsala directamente (read_emails, get_jira_issues, etc.). Si no → indica que debe conectarla en /integraciones.

## ARCHIVOS GENERADOS
Una oración corta. El botón de descarga aparece automáticamente — no lo menciones.

## ERRORES
Si una tool falla, intenta alternativa; si no, explica en lenguaje simple. NUNCA expongas errores técnicos.

## SUGERENCIAS DE SEGUIMIENTO
Opcionales. Solo cuando la respuesta deja abierta una decisión entre 2-3 caminos claros. No agregues después de respuestas completas, archivos generados o análisis cerrados.

## GENERACIÓN DE EXCELS PROFESIONALES

**SIEMPRE** llamá `generate_excel_report` para output tabular descargable. **NUNCA** llames `save_to_excel` cuando el usuario pida reporte, dashboard, ranking, comparativa, datos con formato, diseño o cualquier archivo presentable. `save_to_excel` está reservado sólo para dumps ultra-simples cuando el usuario dice explícitamente "solo los datos crudos, sin formato" — en el 95 % de los pedidos reales, **no** es la tool correcta.

Si el usuario pide **agregar diseño** / **mejorar formato** a un Excel previo → generá uno **nuevo** con `generate_excel_report` (con `cover_sheet=true` y `report_type="kpi_dashboard"` si procede). **NO** uses `append_to_excel` para eso — agrega filas, no diseño.

`generate_excel_report` produce: branding Plataforma IA, autofit de columnas, bandas zebra visibles, headers congelados, totales automáticos, formato condicional, charts embebidos, KPI tiles, hoja Portada y hoja Resumen — todo declarativo en un solo JSON.

### Cómo declarar el intent — `report_type`

Pasa el `report_type` correcto y el preset/estilo se infiere solo:

| Pide el usuario | report_type | Activa |
|---|---|---|
| "dashboard ejecutivo", "reporte ejecutivo", "indicadores Q1", "panorama mensual" | `kpi_dashboard` | Portada + Resumen con KPI tiles + preset executive |
| "reporte financiero", "estado de resultados", "balance" | `financial_report` | Preset financial, totales sum, currency CLP |
| "ranking", "top 10", "clasificación", "los más usados" | `ranking` | data_bar en métrica, sort desc |
| "comparar X vs Y", "comparación divisiones", "antes vs después" | `comparison` | 3_color_scale, preset corporate_navy |
| "evolución mensual", "tendencia anual", "serie temporal" | `timeseries` | Chart line auto, sparklines |
| "exporta este dataset", "dame los datos en Excel" sin contexto adicional | `data_table` o `auto` | Tabla limpia con autofit |
| Si dudas | `auto` | Heurística decide según shape |

### Para dashboards ejecutivos

Activa `cover_sheet=true` y rellena `summary_sheet.kpis` con 3-6 KPIs (label corto + value numérico + opcionalmente delta % vs período anterior + color: green/red/blue/orange). Esto produce una portada con metadata + hoja Resumen con tiles grandes antes del detalle.

### Para gráficos embebidos

En cada `sheets[].chart` pasa `{type, title, x_column, y_columns}`. Tipos: `bar` (rankings horizontales), `column` (comparaciones verticales), `line` (series temporales), `pie`/`doughnut` (proporciones, máx 7 categorías), `area` (acumulados).

### Reglas

- Usa tipos correctos en `columns[].type`: `currency` para CLP/USD, `percent` para tasas, `date` para fechas, `integer` para conteos. El formato numérico se aplica solo.
- NO inventes columnas largas en `key` (usa snake_case corto); el `header` es el visible.
- Para reportes con autor/división, pasa `author` y `division` en el spec — aparecen en la portada.
- `totals="auto"` y `conditional_formats="auto"` ya vienen activados por defecto en cada sheet — déjalos así salvo que el usuario pida lo contrario.
"""


# Cache del system prompt resuelto (con catálogo inyectado). Se invalida
# cuando cambia la versión del cache de agentes en Cosmos. Sin esto se
# rompería el prompt caching de Anthropic/OpenAI por reconstruir el string
# en cada turno.
_resolved_system_instructions: Optional[str] = None
_resolved_catalog_version: int = -1


def _format_agent_catalog_block(agents: List[Dict[str, Any]]) -> str:
    """Formatea el bloque que se inyecta en el system prompt.

    Filtra a estado=Producción (los únicos que el chat debe mencionar como
    disponibles) y los lista por nombre + categoría.
    """
    produccion = [a for a in agents if a.get("estado") == "Producción"]
    lines = [f"- {a.get('nombre', '?')} ({a.get('categoria', '—')})" for a in produccion]
    listado = "\n".join(lines) if lines else "(catálogo vacío)"
    return (
        "## CATÁLOGO ACTUAL DE AGENTES (fuente de verdad — usa estos datos, NO inventes)\n"
        f"Hoy hay **{len(produccion)} agentes en producción**:\n"
        f"{listado}\n\n"
        "Cuando te pregunten cuántos agentes hay, listarlos o pidan un resumen ejecutivo, "
        "usa EXACTAMENTE estos nombres y este conteo. Para detalles (descripción, casos de uso, "
        "beneficios) llama `search_agent_info` con el nombre."
    )


def build_agent_system_prompt(agent: Dict[str, Any]) -> str:
    """Compone un system prompt especializado a partir de los metadatos
    del agente del catálogo (nombre, categoría, descripción, casos de uso,
    beneficios, división). Hereda toda la base del prompt general
    (instrucciones operativas, tools, agent catalog) y le agrega una sección
    con el rol específico que el modelo debe encarnar en este chat.
    """
    base = build_system_instructions()

    def _fmt_list(items) -> str:
        if not items:
            return "(no especificado)"
        if isinstance(items, str):
            return f"- {items}"
        return "\n".join(f"- {it}" for it in items if it)

    nombre = agent.get("nombre") or "Agente"
    categoria = agent.get("categoria") or "IA"
    descripcion = agent.get("descripcion") or ""
    division = agent.get("division") or "Corporativo"
    casos_uso = agent.get("casos_uso") or []
    beneficios = agent.get("beneficios") or []
    creador = agent.get("creador") or ""

    # Pre-computado fuera del f-string porque Python 3.11 prohíbe
    # backslashes dentro de expresiones de f-string.
    team_block = f"### Equipo responsable\n{creador}" if creador else ""

    persona_block = f"""
## TU ROL EN ESTA CONVERSACIÓN

Estás operando como **{nombre}**, un agente especializado del catálogo de
Plataforma IA, dentro de la categoría **{categoria}** (división: {division}).

### Descripción del agente
{descripcion}

### Casos de uso principales
{_fmt_list(casos_uso)}

### Beneficios que aportas al usuario
{_fmt_list(beneficios)}

{team_block}

---

### Reglas operativas para este rol

1. **Identidad consistente**: cuando te pregunten quién eres o qué haces,
   preséntate como **{nombre}**. NO te presentes como un asistente genérico
   ni menciones el catálogo entero — el usuario te eligió específicamente.
2. **Foco**: prioriza siempre los casos de uso listados arriba. Si la
   consulta cae fuera de tu dominio, ayuda igualmente pero sugiere
   amablemente que el usuario consulte el catálogo completo (`/agentes`)
   para encontrar un agente más especializado.
3. **Estilo**: adapta el tono al área **{categoria}** — formal y preciso
   para temas técnicos/jurídicos/financieros, cercano y didáctico para
   áreas de personas/onboarding.
4. **Tools disponibles**: mantienes acceso a TODO el toolset de la
   plataforma (Excel, PDF, dashboards, datalake, etc.). Úsalas cuando
   ayuden a resolver una tarea del rol que encarnás.
""".strip()

    return base + "\n\n" + persona_block


def build_system_instructions() -> str:
    """Devuelve el system prompt con el catálogo de agentes inyectado dinámicamente.

    Cachea el resultado y lo recalcula sólo cuando cambia la versión del cache
    en `cosmos_service` (load/create/update/delete de agentes).
    """
    global _resolved_system_instructions, _resolved_catalog_version

    # Import diferido para evitar dependencias circulares en tiempo de import.
    from app.services.cosmos_service import cosmos_service

    try:
        agents = cosmos_service.get_all_agents()
        version = cosmos_service.get_cache_version()
    except Exception as e:
        # Si Cosmos no está disponible, devolvemos el prompt sin catálogo
        # antes que romper el chat. El placeholder queda vacío.
        logger.warning(f"No se pudo cargar catálogo de agentes para system prompt: {e}")
        return SYSTEM_INSTRUCTIONS.replace(
            "{AGENT_CATALOG_BLOCK}",
            "## CATÁLOGO DE AGENTES\n(catálogo no disponible en este momento — "
            "llama `search_agent_info` para buscar agentes específicos)",
        )

    if _resolved_system_instructions is not None and _resolved_catalog_version == version:
        return _resolved_system_instructions

    block = _format_agent_catalog_block(agents)
    _resolved_system_instructions = SYSTEM_INSTRUCTIONS.replace("{AGENT_CATALOG_BLOCK}", block)
    _resolved_catalog_version = version
    return _resolved_system_instructions


class AzureAIService:
    """Servicio de chat usando el SDK nativo de Anthropic (Claude API).

    El nombre `AzureAIService` se mantiene por compatibilidad con módulos que
    lo importan. La interfaz pública (`send_message`, `stream_message`) no
    cambia.
    """

    def __init__(self):
        self._anthropic_client: Optional[AsyncAnthropic] = None
        logger.info("Servicio AI inicializado (Anthropic SDK nativo)")

    def _get_anthropic_client(self) -> AsyncAnthropic:
        """Lazy singleton del cliente AsyncAnthropic."""
        if self._anthropic_client is None:
            if not config.ANTHROPIC_API_KEY:
                raise ValueError("ANTHROPIC_API_KEY debe estar configurado en .env")
            logger.info("Inicializando cliente Anthropic...")
            self._anthropic_client = AsyncAnthropic(
                api_key=config.ANTHROPIC_API_KEY,
            )
            logger.info("Cliente Anthropic configurado")
        return self._anthropic_client

    def _build_messages(
        self,
        user_message,
        conversation_history: Optional[list],
        user_context_str: Optional[str] = None,
        system_instructions_override: Optional[str] = None,
    ) -> List[Dict]:
        """
        Construye la lista de mensajes en formato interno (estilo OpenAI).
        El system prompt se concatena como primer mensaje role=system;
        en la traducción a Anthropic se extrae al parámetro `system`.

        Si `system_instructions_override` se provee (típicamente al
        ejecutar un agente del catálogo), reemplaza el system prompt
        global por la versión especializada del agente.
        """
        from app.agents.skill_loader import load_visualization_skills

        system_content = system_instructions_override or build_system_instructions()
        if user_context_str:
            system_content += f"\n\n## Usuario actual:\n{user_context_str}"

        # Inyección condicional de skill packs de visualización según keywords
        # del mensaje. Evita cargar ~200 líneas de heurísticas cuando no aplican.
        user_text = ""
        if isinstance(user_message, str):
            user_text = user_message
        elif isinstance(user_message, list):
            user_text = " ".join(
                p.get("text", "") for p in user_message
                if isinstance(p, dict) and p.get("type") == "text"
            )
        skills_block = load_visualization_skills(user_text)
        if skills_block:
            system_content += "\n\n" + skills_block

        messages = [{"role": "system", "content": system_content}]

        if conversation_history:
            messages.extend(conversation_history)

        if isinstance(user_message, list):
            # Mensaje multimodal: convertir al formato OpenAI vision
            openai_parts = []
            for part in user_message:
                if not isinstance(part, dict):
                    continue
                if part.get("type") == "text":
                    openai_parts.append({"type": "text", "text": part["text"]})
                elif part.get("type") == "image_url":
                    openai_parts.append({
                        "type": "image_url",
                        "image_url": part["image_url"],
                    })
            content = openai_parts if openai_parts else user_message
            logger.info(f"Mensaje multimodal recibido: {len(openai_parts)} partes")
        else:
            content = user_message

        messages.append({"role": "user", "content": content})
        return messages

    async def _stream_final_response(
        self,
        messages: List[dict],
        event_callback: Callable[[dict], Awaitable[None]],
        message_id: str,
    ) -> str:
        """
        Hace una llamada streaming al modelo con los mensajes finales
        y emite stream_start / stream_token por cada chunk recibido.
        Retorna el texto completo acumulado.
        """
        client = self._get_anthropic_client()
        await event_callback({"type": "stream_start", "data": {"message_id": message_id}})

        # Traducir estado interno (OpenAI-style) → payload nativo Anthropic.
        system_blocks, rest_messages = _split_system_and_messages(messages)
        anth_messages = _openai_messages_to_anthropic(rest_messages)

        # Temperatura normal (CHAT_TEMPERATURE, default 0.7) para narrativa final.
        # max_tokens es obligatorio en Anthropic.
        stream_kwargs: Dict[str, Any] = {
            "model": config.CHAT_MODEL,
            "system": system_blocks,
            "messages": anth_messages,
            "max_tokens": config.CHAT_MAX_TOKENS,
            "temperature": config.CHAT_TEMPERATURE,
        }

        accumulated: List[str] = []
        async with client.messages.stream(**stream_kwargs) as stream:
            async for text in stream.text_stream:
                if not text:
                    continue
                accumulated.append(text)
                await event_callback({
                    "type": "stream_token",
                    "data": {"message_id": message_id, "token": text},
                })

        return "".join(accumulated)

    async def send_message(
        self,
        user_message,
        conversation_history: Optional[list] = None,
        tools: Optional[List[Dict[str, Any]]] = None,
        tool_executor: Optional[callable] = None,
        user_context_str: Optional[str] = None,
        conversation_id: Optional[str] = None,
        user_email: Optional[str] = None,
        event_callback: Optional[Callable[[dict], Awaitable[None]]] = None,
        system_instructions_override: Optional[str] = None,
    ) -> str:
        """
        Envía un mensaje y obtiene la respuesta con soporte de tool calling.
        Si se provee event_callback, emite eventos tool_start/tool_complete durante
        el loop y hace streaming de la respuesta final token a token.
        AsyncOpenAI es nativo async: no necesita run_in_executor.
        """
        from app.agents.tools import get_tool_label
        message_id = f"msg_{uuid.uuid4().hex[:12]}"

        # event_callback + message_id se propagan EXPLÍCITAMENTE al tool_executor
        # (ver _dispatch_one más abajo), que los inyecta en las tools UI. Reemplaza
        # a un patrón previo basado en ContextVars que se perdía silenciosamente
        # cuando el dispatch cruzaba límites de Task (asyncio.gather / wait_for),
        # dejando rendered=False y fallback markdown que el front no renderiza.

        try:
            client = self._get_anthropic_client()

            # Sanitiza el conversation_history: quita mensajes del asistente
            # que contienen alucinaciones sobre "limitaciones" inventadas. Sin
            # esto, el modelo ve sus propias frases pasadas y las repite en el
            # turno actual, aunque el system prompt las prohíba.
            from app.agents.skill_loader import (
                has_dashboard_intent,
                has_pdf_intent,
                has_excel_intent,
                is_read_intent,
                strip_file_context_block,
                message_claims_pdf_success,
                message_contains_hallucination,
            )
            sanitized_history = conversation_history
            if conversation_history:
                clean: list = []
                purged = 0
                for m in conversation_history:
                    if not isinstance(m, dict):
                        clean.append(m)
                        continue
                    if m.get("role") == "assistant":
                        content = m.get("content")
                        text = content if isinstance(content, str) else ""
                        if message_contains_hallucination(text):
                            purged += 1
                            continue
                    clean.append(m)
                if purged:
                    logger.warning(
                        f"🧹 Purgados {purged} mensajes alucinados del history "
                        "para evitar auto-contaminación del modelo"
                    )
                sanitized_history = clean

            messages = self._build_messages(
                user_message,
                sanitized_history,
                user_context_str,
                system_instructions_override=system_instructions_override,
            )
            logger.info(f"Enviando mensaje al modelo {config.CHAT_MODEL}")

            # Detecta intent dashboard en el mensaje del usuario para forzar
            # tool_choice mientras generate_dashboard_data no se haya llamado.
            # Bloquea el camino "voy a explicarte una limitación".
            user_text_for_intent = ""
            if isinstance(user_message, str):
                user_text_for_intent = user_message
            elif isinstance(user_message, list):
                user_text_for_intent = " ".join(
                    p.get("text", "") for p in user_message
                    if isinstance(p, dict) and p.get("type") == "text"
                )
            # raw_user_text: SIN el bloque `[Archivos de datos disponibles…]`
            # que inyecta el backend cuando hay archivos adjuntos. Los
            # detectores de intent deben ver SOLO la intención del usuario,
            # no los metadatos de los archivos (que contienen "EXCEL" / "PDF"
            # como tipo de archivo y disparan falsos positivos).
            raw_user_text = strip_file_context_block(user_text_for_intent)
            dashboard_intent = bool(tools) and has_dashboard_intent(
                raw_user_text,
                conversation_history=sanitized_history,
            )
            dashboard_fulfilled = False
            if dashboard_intent:
                logger.info(
                    "🎯 Intent DASHBOARD detectado → tool_choice='required' "
                    "inicial; escala a tool_choice nombrado si persiste"
                )
            pdf_intent = bool(tools) and has_pdf_intent(raw_user_text)
            pdf_fulfilled = False
            pdf_tool_success = False
            pdf_tool_failed_reason: Optional[str] = None
            logger.info(
                f"🔍 PDF-AUDIT raw_user_text={raw_user_text[:200]!r} "
                f"pdf_intent={pdf_intent}"
            )
            if pdf_intent:
                logger.info(
                    "🎯 Intent PDF detectado → tool_choice='required' "
                    "para evitar rechazo falso del modelo"
                )
            # Intent Excel: fuerza `tool_choice="required"` para que el modelo
            # elija `generate_excel_report` (reporte corporativo) en vez de
            # `save_to_excel` (dump simple). Si aún así llama `save_to_excel`,
            # escalamos a tool_choice nombrado para corregir.
            excel_intent = bool(tools) and has_excel_intent(
                raw_user_text,
                conversation_history=sanitized_history,
            )
            excel_fulfilled = False
            excel_force_report_name = False
            logger.info(
                f"🔍 EXCEL-AUDIT raw_user_text={raw_user_text[:200]!r} "
                f"excel_intent={excel_intent}"
            )
            if excel_intent:
                logger.info(
                    "🎯 Intent EXCEL detectado → tool_choice='required' "
                    "para forzar generate_excel_report sobre save_to_excel"
                )

            # Intent de LECTURA: el usuario pidió analizar/resumir, no
            # generar. Limita el loop para evitar exploración exhaustiva
            # del modelo (caso real: 6+ iteraciones / 100s con archivo
            # de 21k filas y 6 hojas cuando solo se pidió un resumen).
            generation_intent_active = (
                dashboard_intent or pdf_intent or excel_intent
            )
            read_intent = (
                bool(tools)
                and is_read_intent(raw_user_text)
                and not generation_intent_active
            )
            if read_intent:
                logger.info(
                    "📐 read_intent=True → max_iter=3, sin tool_choice='required', "
                    "nudge en system prompt activo"
                )
                # Nudge: empuja al modelo a responder rápido tras 1-2
                # tools de lectura. Inyectado en este turno solamente.
                _nudge_msg = {
                    "role": "system",
                    "content": (
                        "[Hint para este turno] El usuario pidió analizar/resumir "
                        "un archivo. Llama UNA herramienta de lectura "
                        "(inspect_excel, summarize_data o read_from_excel) y "
                        "responde directamente con el resumen pedido. NO encadenes "
                        "exploración exhaustiva (no llames inspect → read → "
                        "aggregate → summarize en cascada). Si necesitas más "
                        "datos, hazlo en otro turno."
                    ),
                }
                # Insertar como segundo system message, justo después del
                # principal — los modelos chat priorizan instrucciones cercanas.
                if messages and messages[0].get("role") == "system":
                    messages.insert(1, _nudge_msg)
                else:
                    messages.insert(0, _nudge_msg)

            # Filtrado dinámico de tools por contexto. Pasar siempre 33
            # tools al modelo eleva tokens de input y enlentece la
            # selección. Se mantiene el catálogo completo si el selector
            # no detecta señales claras.
            if tools:
                files_present = _detect_files_present(user_text_for_intent)
                from app.agents.tools import select_tools_for_context
                _intents = {
                    "read": read_intent,
                    "excel_gen": excel_intent,
                    "pdf_gen": pdf_intent,
                    "dashboard": dashboard_intent,
                }
                filtered = select_tools_for_context(
                    raw_user_text, files_present, _intents
                )
                if filtered and len(filtered) < len(tools):
                    logger.info(
                        f"🎚️ Tools filtradas por contexto: {len(tools)} → "
                        f"{len(filtered)} (files={files_present}, intents={_intents})"
                    )
                    tools = filtered

            # Temperatura baja durante el loop con tools: el modelo está
            # produciendo argumentos JSON estructurados (specs UI, params tool).
            # La narrativa final usa CHAT_TEMPERATURE normal en _stream_final_response.
            loop_temperature = (
                config.CHAT_TEMPERATURE_STRUCTURED if tools else config.CHAT_TEMPERATURE
            )
            # `create_params` es el estado interno OpenAI-style del request.
            # Se mutan `messages`, `tools` y `tool_choice` entre iteraciones; la
            # traducción al payload nativo Anthropic ocurre justo antes de cada
            # llamada en `_build_anthropic_kwargs`.
            create_params: Dict[str, Any] = {
                "messages": messages,
                "temperature": loop_temperature,
            }
            if tools:
                create_params["tools"] = tools
                logger.info(f"Usando {len(tools)} herramientas (temp={loop_temperature})")

            def _build_anthropic_kwargs() -> Dict[str, Any]:
                """Traduce el estado interno OpenAI-style a payload Anthropic."""
                _system_blocks, _rest = _split_system_and_messages(create_params["messages"])
                _kw: Dict[str, Any] = {
                    "model": config.CHAT_MODEL,
                    "system": _system_blocks,
                    "messages": _openai_messages_to_anthropic(_rest),
                    "max_tokens": config.CHAT_MAX_TOKENS,
                    "temperature": create_params.get("temperature", config.CHAT_TEMPERATURE),
                }
                _anth_tools = _openai_tools_to_anthropic(create_params.get("tools"))
                if _anth_tools:
                    _kw["tools"] = _anth_tools
                _tc = _translate_tool_choice(create_params.get("tool_choice"))
                if _tc:
                    _kw["tool_choice"] = _tc
                return _kw

            # Bound del loop: lectura simple no necesita más de 2-3 vueltas.
            # Generación / dashboard / PDF / Excel sí pueden necesitar más
            # (extraer datos → spec → generar archivo → narrar).
            max_iterations = 3 if read_intent else 25
            hallucination_retry_used = False
            # Compactado de tool results en historial: tracker de los
            # tool_call_id de la iteración previa. Solo esos se conservan
            # FULL en la próxima vuelta; los más antiguos se compactan en
            # sitio dentro de `messages` antes de re-enviar al API.
            last_iter_tool_call_ids: set[str] = set()
            await _emit_thinking(event_callback, "Analizando tu consulta...")
            for iteration in range(1, max_iterations + 1):
                # Compacta tool results de iteraciones anteriores a la
                # última (ya fueron entregados full al modelo y no necesitan
                # re-enviar el JSON completo cada vuelta).
                if iteration > 1:
                    _compact_old_tool_messages(
                        messages, keep_full_ids=last_iter_tool_call_ids
                    )
                # Gate de tool_choice para intent dashboard:
                # - "required" por defecto (obliga a llamar alguna tool y
                #   bloquea el chat-only) mientras generate_dashboard_data
                #   no se llame.
                # - Tras detectar alucinación en respuesta final → subir a
                #   tool_choice nombrado SOLO en el retry. Forzar un nombre
                #   específico en cada iter hace que Claude entre en loop
                #   intentando construir el tool_call y termine degenerando.
                if dashboard_intent and not dashboard_fulfilled:
                    if hallucination_retry_used:
                        create_params["tool_choice"] = {
                            "type": "function",
                            "function": {"name": "generate_dashboard_data"},
                        }
                        logger.info(
                            f"🎯 iter {iteration}: retry post-alucinación con "
                            "tool_choice=generate_dashboard_data (forzado)"
                        )
                    else:
                        create_params["tool_choice"] = "required"
                elif pdf_intent and not pdf_fulfilled:
                    # tool_choice="required" obliga a llamar alguna tool del
                    # catálogo. El modelo elige entre generate_pdf_report y
                    # export_html_to_pdf sin forzar el nombre.
                    create_params["tool_choice"] = "required"
                elif excel_intent and not excel_fulfilled:
                    # Si en una iteración previa el modelo eligió
                    # `save_to_excel` pese al intent, escalamos al nombre
                    # concreto. Caso contrario, `required` obliga a llamar
                    # alguna tool y el modelo ya tiene prioridad declarada
                    # en el system prompt + skill pack.
                    if excel_force_report_name:
                        create_params["tool_choice"] = {
                            "type": "function",
                            "function": {"name": "generate_excel_report"},
                        }
                        logger.info(
                            f"🎯 iter {iteration}: escalando a "
                            "tool_choice=generate_excel_report (forzado) "
                            "tras save_to_excel previo con intent Excel"
                        )
                    else:
                        create_params["tool_choice"] = "required"
                else:
                    create_params.pop("tool_choice", None)

                response = await client.messages.create(**_build_anthropic_kwargs())

                # Anthropic devuelve `content` (lista de blocks) y `stop_reason`
                # ("end_turn" | "tool_use" | "max_tokens" | "stop_sequence").
                _content_blocks = response.content or []
                _tool_use_blocks = [
                    b for b in _content_blocks if getattr(b, "type", None) == "tool_use"
                ]
                _text_parts = [
                    b.text for b in _content_blocks
                    if getattr(b, "type", None) == "text" and getattr(b, "text", None)
                ]
                _assistant_text = "".join(_text_parts)

                if response.stop_reason == "tool_use":
                    logger.info(f"El agente quiere usar herramientas (iteración {iteration})")
                    await _emit_thinking(event_callback, "Preparando herramientas...")

                    # Adapta tool_use blocks (Anthropic) al shape que espera el
                    # resto del código (tc.id, tc.function.name, tc.function.arguments).
                    tool_calls = [
                        SimpleNamespace(
                            id=b.id,
                            function=SimpleNamespace(
                                name=b.name,
                                arguments=json.dumps(b.input or {}, ensure_ascii=False),
                            ),
                        )
                        for b in _tool_use_blocks
                    ]

                    # Agregar mensaje del asistente con los tool_calls (formato OpenAI interno).
                    messages.append({
                        "role": "assistant",
                        "content": _assistant_text or None,
                        "tool_calls": [
                            {
                                "id": tc.id,
                                "type": "function",
                                "function": {
                                    "name": tc.function.name,
                                    "arguments": tc.function.arguments,
                                },
                            }
                            for tc in tool_calls
                        ],
                    })

                    # Pre-procesa marcas de fulfilled / force_name SOBRE
                    # los tool_calls de esta iteración. Hacerlo antes
                    # garantiza orden determinista aun si los tools se
                    # ejecutan en paralelo más abajo.
                    for tc in tool_calls:
                        if tc.function.name == "generate_dashboard_data":
                            dashboard_fulfilled = True
                        if tc.function.name in {"generate_pdf_report", "export_html_to_pdf"}:
                            pdf_fulfilled = True
                        if tc.function.name == "generate_excel_report":
                            excel_fulfilled = True
                            excel_force_report_name = False
                        elif (
                            excel_intent
                            and not excel_fulfilled
                            and tc.function.name in {"save_to_excel", "append_to_excel"}
                        ):
                            excel_force_report_name = True
                            logger.warning(
                                f"⚠️ Intent Excel activo pero el modelo llamó "
                                f"`{tc.function.name}`. Próxima iter forzará "
                                "`generate_excel_report` por nombre."
                            )

                    # Pre-cómputo por tool: parsea args, prepara tool_id,
                    # decide short_circuit y emite tool_start.
                    import asyncio
                    prepared: list[dict] = []
                    for tc in tool_calls:
                        try:
                            tool_input = json.loads(tc.function.arguments)
                        except json.JSONDecodeError:
                            tool_input = {}
                        tool_id = f"tool_{uuid.uuid4().hex[:8]}"
                        excel_short_circuit = (
                            excel_intent
                            and not excel_fulfilled
                            and tc.function.name in {"save_to_excel", "append_to_excel"}
                        )
                        prepared.append({
                            "tc": tc,
                            "tool_id": tool_id,
                            "tool_input": tool_input,
                            "excel_short_circuit": excel_short_circuit,
                        })
                        logger.info(f"🔧 Ejecutando herramienta: {tc.function.name}")
                        logger.info(f"   Parámetros: {tool_input}")
                        if event_callback:
                            await event_callback({
                                "type": "tool_start",
                                "data": {
                                    "tool_id": tool_id,
                                    "tool_name": tc.function.name,
                                    "label": get_tool_label(tc.function.name),
                                    "args_preview": _args_preview(tool_input),
                                },
                            })

                    async def _dispatch_one(item: dict):
                        tc = item["tc"]
                        if item["excel_short_circuit"]:
                            logger.warning(
                                f"🛑 Short-circuit: intercepté `{tc.function.name}` "
                                f"bajo intent Excel (iter {iteration}). Retry forzará "
                                "`generate_excel_report` por nombre."
                            )
                            return {
                                "success": False,
                                "error": (
                                    f"`{tc.function.name}` deshabilitada en este "
                                    "turno: el usuario pidió un reporte profesional "
                                    "(intent Excel detectado). Llamá "
                                    "`generate_excel_report` con un spec declarativo: "
                                    "report_type (kpi_dashboard / ranking / "
                                    "financial_report / comparison / timeseries / "
                                    "data_table), sheets[] con columns tipadas y, "
                                    "si procede, cover_sheet=true y summary_sheet.kpis."
                                ),
                            }
                        if not tool_executor:
                            return {"error": "No hay ejecutor de herramientas configurado"}
                        if asyncio.iscoroutinefunction(tool_executor):
                            return await tool_executor(
                                tc.function.name,
                                item["tool_input"],
                                user_email=user_email,
                                conversation_id=conversation_id,
                                event_callback=event_callback,
                                message_id=message_id,
                            )
                        return tool_executor(tc.function.name, item["tool_input"])

                    # Bound por tool: si una tool cuelga (p.ej. openpyxl con
                    # extensiones raras, red bloqueada, etc.) preferimos
                    # devolver un error explícito al modelo en vez de dejar
                    # morir la conversación al gateway. 60s cubre análisis
                    # de Excel grandes y generación de reportes; si se queda
                    # corto para algún caso legítimo, subir la constante.
                    TOOL_TIMEOUT_SECONDS = 60

                    async def _dispatch_bounded(item: dict):
                        try:
                            return await asyncio.wait_for(
                                _dispatch_one(item),
                                timeout=TOOL_TIMEOUT_SECONDS,
                            )
                        except asyncio.TimeoutError:
                            logger.error(
                                f"⏱️ Timeout ({TOOL_TIMEOUT_SECONDS}s) ejecutando tool "
                                f"`{item['tc'].function.name}` con args={item['tool_input']}"
                            )
                            return {
                                "success": False,
                                "error": (
                                    f"La herramienta `{item['tc'].function.name}` "
                                    f"excedió el tiempo máximo de {TOOL_TIMEOUT_SECONDS}s "
                                    "y fue abortada. Respondé al usuario con lo que ya "
                                    "tenés o intentá otra estrategia."
                                ),
                            }

                    # Decide paralelo vs secuencial: si alguna tool de la
                    # iteración tiene side-effects (escribe archivo, manda
                    # email, etc.) → secuencial para preservar orden.
                    can_parallel = (
                        len(prepared) > 1
                        and all(
                            (item["tc"].function.name not in SEQUENTIAL_ONLY_TOOLS)
                            and not item["excel_short_circuit"]
                            for item in prepared
                        )
                    )
                    if can_parallel:
                        logger.info(
                            f"⚡ Ejecutando {len(prepared)} tools en paralelo "
                            f"(asyncio.gather)"
                        )
                        results = await asyncio.gather(
                            *[_dispatch_bounded(item) for item in prepared],
                            return_exceptions=False,
                        )
                    else:
                        results = []
                        for item in prepared:
                            results.append(await _dispatch_bounded(item))

                    # Post-procesa resultados en orden de tool_calls.
                    for item, result in zip(prepared, results):
                        tc = item["tc"]
                        tool_id = item["tool_id"]
                        is_pdf_tool = tc.function.name in {
                            "generate_pdf_report", "export_html_to_pdf",
                        }
                        logger.info(f"✅ Resultado: {result}")

                        if is_pdf_tool:
                            _ok = bool(isinstance(result, dict) and result.get("success"))
                            _fname = result.get("filename") if isinstance(result, dict) else None
                            _err = result.get("error") if isinstance(result, dict) else None
                            logger.info(
                                f"🔍 PDF-AUDIT tool={tc.function.name} success={_ok} "
                                f"filename={_fname!r} error={_err!r}"
                            )
                            if _ok and _fname:
                                pdf_tool_success = True
                                pdf_tool_failed_reason = None
                            else:
                                pdf_tool_failed_reason = (
                                    (isinstance(result, dict) and (result.get("message") or result.get("error")))
                                    or "error desconocido"
                                )

                        if event_callback:
                            success = (
                                result.get("success", True)
                                if isinstance(result, dict)
                                else True
                            )
                            await event_callback({
                                "type": "tool_complete" if success else "tool_error",
                                "data": {
                                    "tool_id": tool_id,
                                    "tool_name": tc.function.name,
                                    "label": get_tool_label(tc.function.name),
                                    "result_summary": _result_summary(result),
                                    "success": success,
                                },
                            })

                        result_str = str(result)
                        if len(result_str) > 100_000:
                            result_str = result_str[:100_000] + (
                                "\n\n[... resultado truncado por tamaño. "
                                "Usa filtros más específicos, columns, o max_rows menor para reducir el resultado.]"
                            )

                        messages.append({
                            "role": "tool",
                            "tool_call_id": tc.id,
                            "name": tc.function.name,
                            "content": result_str,
                        })

                        if (
                            tc.function.name in _FILE_CREATING_TOOLS
                            and isinstance(result, dict)
                            and result.get("success")
                            and result.get("filename")
                        ):
                            from app.services.storage_service import storage_service
                            _filename = result["filename"]
                            _blob_path = f"generated/{_filename}"
                            _size = storage_service.get_blob_size(_blob_path)
                            if conversation_id:
                                from app.services.assistant_service import assistant_service
                                assistant_service.track_blob(conversation_id, _blob_path)
                            if event_callback:
                                await event_callback({
                                    "type": "file_created",
                                    "data": {
                                        "filename": _filename,
                                        "url": f"/chat/files/{_filename}",
                                        "size": _size,
                                    },
                                })

                    # Marca los tool_call_id de esta iteración como "full".
                    # En la próxima vuelta, sólo estos se conservan completos;
                    # los anteriores se compactarán antes del API call.
                    last_iter_tool_call_ids = {tc.id for tc in tool_calls}
                    create_params["messages"] = messages
                    await _emit_thinking(event_callback, "Evaluando resultados...")
                    continue

                else:
                    # Interceptar alucinación ANTES de streamear: si el modelo
                    # intenta responder con la "limitación falsa" en vez de
                    # llamar generate_dashboard_data, re-inyectamos corrección
                    # y forzamos un retry con tool_choice nombrado (1 sola vez).
                    raw_content = _assistant_text or ""
                    if (
                        dashboard_intent
                        and not dashboard_fulfilled
                        and not hallucination_retry_used
                        and message_contains_hallucination(raw_content)
                    ):
                        hallucination_retry_used = True
                        logger.warning(
                            "🚨 Alucinación detectada en respuesta final "
                            f"(iter {iteration}). Re-inyectando corrección y "
                            "forzando tool_choice=generate_dashboard_data."
                        )
                        messages.append({
                            "role": "assistant",
                            "content": raw_content,
                        })
                        messages.append({
                            "role": "user",
                            "content": (
                                "CORRECCIÓN: la 'limitación' que mencionaste "
                                "NO EXISTE. La plataforma SÍ renderiza un "
                                "dashboard integrado con múltiples paneles en "
                                "una sola respuesta mediante la tool "
                                "`generate_dashboard_data`. No expliques "
                                "limitaciones, no entregues en pasos, no emitas "
                                "charts sueltos. Llama AHORA "
                                "`generate_dashboard_data` UNA sola vez con "
                                "≥4 paneles de tipos distintos usando los datos "
                                "que ya leíste del Excel."
                            ),
                        })
                        create_params["messages"] = messages
                        await _emit_thinking(
                            event_callback,
                            "Reorientando respuesta...",
                        )
                        continue

                    if (
                        pdf_intent
                        and not pdf_fulfilled
                        and not hallucination_retry_used
                        and message_contains_hallucination(raw_content)
                    ):
                        hallucination_retry_used = True
                        logger.warning(
                            "🚨 Alucinación PDF detectada en respuesta final "
                            f"(iter {iteration}). Re-inyectando corrección y "
                            "forzando tool_choice=required."
                        )
                        messages.append({
                            "role": "assistant",
                            "content": raw_content,
                        })
                        messages.append({
                            "role": "user",
                            "content": (
                                "CORRECCIÓN: la 'limitación' que mencionaste "
                                "NO EXISTE. La plataforma SÍ genera archivos "
                                "PDF descargables mediante las tools "
                                "`generate_pdf_report` (95 % de los casos) y "
                                "`export_html_to_pdf` (layouts muy custom). "
                                "No expliques limitaciones, no pidas "
                                "confirmación. Llamá AHORA la tool adecuada "
                                "con un spec estructurado."
                            ),
                        })
                        create_params["messages"] = messages
                        await _emit_thinking(
                            event_callback,
                            "Reorientando respuesta...",
                        )
                        continue

                    # Caso simétrico: el modelo dice "Listo, generé el PDF"
                    # SIN que ninguna tool de PDF haya retornado success=True.
                    # Reorientamos forzando tool_choice nombrado.
                    if (
                        pdf_intent
                        and not pdf_tool_success
                        and not hallucination_retry_used
                        and message_claims_pdf_success(raw_content)
                    ):
                        hallucination_retry_used = True
                        logger.warning(
                            "🚨 Falso éxito PDF detectado (iter {iter}): el "
                            "modelo afirma haber generado el PDF sin tool "
                            "exitosa. Forzando tool_choice=generate_pdf_report.".format(
                                iter=iteration
                            )
                        )
                        messages.append({
                            "role": "assistant",
                            "content": raw_content,
                        })
                        messages.append({
                            "role": "user",
                            "content": (
                                "CORRECCIÓN: NO generaste el PDF — ninguna tool "
                                "de PDF se ejecutó con éxito en este turno. NO "
                                "afirmes que el archivo está listo cuando no lo "
                                "está. Llamá AHORA `generate_pdf_report` con un "
                                "spec estructurado completo (filename, title, "
                                "sections con el análisis pedido)."
                            ),
                        })
                        create_params["messages"] = messages
                        create_params["tool_choice"] = {
                            "type": "function",
                            "function": {"name": "generate_pdf_report"},
                        }
                        await _emit_thinking(
                            event_callback,
                            "Reorientando respuesta...",
                        )
                        continue

                    logger.info(
                        f"🔍 PDF-AUDIT final pdf_intent={pdf_intent} "
                        f"pdf_fulfilled={pdf_fulfilled} pdf_tool_success={pdf_tool_success} "
                        f"failed_reason={pdf_tool_failed_reason!r} "
                        f"text_preview={(raw_content or '')[:200]!r}"
                    )

                    # Si la tool falló, prefijamos un aviso visible al usuario
                    # y emitimos un file_error para que el frontend lo muestre,
                    # en vez de dejar pasar el "Listo" del modelo.
                    pdf_error_prefix = ""
                    if pdf_intent and not pdf_tool_success and pdf_tool_failed_reason:
                        pdf_error_prefix = (
                            f"⚠️ No pude generar el PDF: {pdf_tool_failed_reason}\n\n"
                        )
                        if event_callback:
                            await event_callback({
                                "type": "file_error",
                                "data": {
                                    "tool": "pdf",
                                    "reason": pdf_tool_failed_reason,
                                },
                            })

                    await _emit_thinking(event_callback, "Formulando respuesta...")
                    if event_callback:
                        # Respuesta final: streamear token a token
                        result_text = await self._stream_final_response(
                            messages, event_callback, message_id
                        )
                        # Si el modelo dejó una lista numerada sin ui-component,
                        # inyectamos uno (con auto-detección multi-select) y
                        # streamear el bloque al frontend.
                        result_text = await _inject_ui_component_if_needed(
                            result_text, event_callback, message_id
                        )
                    else:
                        result_text = raw_content
                    if pdf_error_prefix:
                        result_text = pdf_error_prefix + result_text
                    logger.info(f"✅ Respuesta final recibida: {len(result_text)} caracteres")
                    return result_text

            logger.warning(f"⚠️ Máximo de iteraciones alcanzado ({max_iterations})")
            return "Lo siento, no pude completar la tarea en el tiempo esperado."

        except RateLimitError as e:
            logger.error(f"❌ Rate limit excedido: {e}")
            raise AIRateLimitError(retry_after=60) from e
        except APIStatusError as e:
            # DEBUG: cuerpo completo de la respuesta para diagnosticar errores opacos
            try:
                _body = e.response.text if e.response is not None else "<sin body>"
            except Exception:
                _body = "<error leyendo body>"
            logger.error(f"Error de API (status {e.status_code}): {e.message} | body: {_body[:1500]}")
            # Diferenciar entre overload (529) y otros errores
            if e.status_code == 529:
                raise AIOverloadError(retry_after=10) from e
            else:
                raise AIModelError(retry_after=None) from e
        except APIConnectionError as e:
            logger.error(f"❌ Error de conexión: {e}")
            raise AIConnectionError() from e
        except Exception as e:
            logger.error(f"❌ Error al enviar mensaje: {e}")
            raise

    async def stream_message(
        self,
        user_message: str,
        conversation_history: Optional[list] = None
    ) -> AsyncGenerator[str, None]:
        """Streaming nativo de Anthropic. Yieldea chunks de texto."""
        try:
            client = self._get_anthropic_client()
            internal_messages = self._build_messages(user_message, conversation_history)
            logger.info(f"Iniciando streaming con modelo {config.CHAT_MODEL}")

            system_blocks, rest_messages = _split_system_and_messages(internal_messages)
            stream_kwargs: Dict[str, Any] = {
                "model": config.CHAT_MODEL,
                "system": system_blocks,
                "messages": _openai_messages_to_anthropic(rest_messages),
                "max_tokens": 2000,
                "temperature": config.CHAT_TEMPERATURE,
            }

            async with client.messages.stream(**stream_kwargs) as stream:
                async for text in stream.text_stream:
                    if text:
                        yield text

            logger.info("Streaming completado")

        except RateLimitError as e:
            logger.error(f"Rate limit en streaming: {e}")
            yield "Error: Límite de peticiones excedido."
        except APIStatusError as e:
            logger.error(f"Error API en streaming (status {e.status_code}): {getattr(e, 'message', str(e))}")
            yield f"Error: {getattr(e, 'message', str(e))}"
        except APIConnectionError as e:
            logger.error(f"Error de conexión en streaming: {e}")
            yield "Error: No se pudo conectar al servicio de AI."
        except Exception as e:
            logger.error(f"Error en streaming: {e}")
            yield f"Error: {str(e)}"


# Instancia global del servicio (mismo nombre que antes → agent_service.py no cambia)
azure_ai_service = AzureAIService()