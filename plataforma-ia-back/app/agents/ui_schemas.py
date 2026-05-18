"""
Pydantic models que espejan los tipos TypeScript del frontend
(src/components/chat/{chart,dashboard,kpi,infographic,widget}/types.ts).

Se usan para:
  1. Validar specs que el modelo produce antes de emitirlos al frontend.
  2. Generar JSON Schemas strict para Structured Outputs de Azure OpenAI.
  3. Dar un contrato tipado al UI Designer sub-agente.

Cualquier cambio en los tipos TS del frontend debe reflejarse aquí.
"""
from __future__ import annotations

from typing import Annotated, Literal, Union

from pydantic import BaseModel, ConfigDict, Field


# ─── Base strict config ──────────────────────────────────────────────────────

class _Strict(BaseModel):
    """Base con `extra=forbid` para habilitar Structured Outputs strict."""

    model_config = ConfigDict(extra="forbid")


# ─── Chart ───────────────────────────────────────────────────────────────────

ChartType = Literal[
    "bar", "line", "pie", "area", "donut", "stacked_area",
    "stacked_bar", "waterfall",
]


class YKeySpec(_Strict):
    key: str
    label: str
    color: str
    unit: str | None = None
    axis: Literal["left", "right"] | None = None


class FilterOption(_Strict):
    id: str
    label: str


class ChartFilterSpec(_Strict):
    id: str
    label: str
    type: Literal["radio", "dropdown"]
    key_to_filter: str
    options: list[FilterOption]
    default: str


class ChartSpec(_Strict):
    id: str
    type: ChartType
    title: str
    x_key: str
    y_keys: list[YKeySpec]
    data: list[dict]
    description: str | None = None
    filters: list[ChartFilterSpec] | None = None
    on_click_message: str | None = None
    selectable: bool | None = None


# ─── KPI Standalone ──────────────────────────────────────────────────────────

KPIFormat = Literal["number", "currency", "percentage", "compact"]


class KPITrend(_Strict):
    direction: Literal["up", "down", "flat"]
    value: str
    label: str | None = None


class KPIComparison(_Strict):
    value: str | float
    label: str


class KPITarget(_Strict):
    value: float
    label: str


class KPICardSpec(_Strict):
    id: str
    label: str
    value: str | float
    format: KPIFormat | None = None
    unit: str | None = None
    icon: str | None = None
    color: str | None = None
    trend: KPITrend | None = None
    comparison: KPIComparison | None = None
    sparkline: list[float] | None = None
    target: KPITarget | None = None


class StandaloneKPISpec(_Strict):
    id: str
    title: str
    cards: list[KPICardSpec]
    description: str | None = None
    columns: int | None = Field(default=None, ge=1, le=4)


# ─── Dashboard ───────────────────────────────────────────────────────────────

PanelType = Literal[
    "bar", "line", "pie", "area", "donut", "stacked_area", "stacked_bar",
    "waterfall", "kpi", "table",
]


class DashboardFilterSpec(_Strict):
    id: str
    label: str
    type: Literal["radio", "dropdown", "multi_select"]
    key_to_filter: str
    options: list[FilterOption]
    default: Union[str, list[str]]
    applies_to: list[str] | None = None


class DashboardKPISpec(_Strict):
    """Versión simplificada de KPI embebida dentro de un panel de dashboard."""

    value: str | float
    label: str
    trend: KPITrend | None = None
    format: Literal["number", "currency", "percentage"] | None = None


class TableColumnSpec(_Strict):
    key: str
    label: str


class PanelOnClickFilter(_Strict):
    target_panels: list[str]
    filter_key: str


class PanelSpec(_Strict):
    id: str
    type: PanelType
    title: str
    description: str | None = None
    span: int | None = Field(default=None, ge=1, le=4)
    data: list[dict] | None = None
    x_key: str | None = None
    y_keys: list[YKeySpec] | None = None
    kpi: DashboardKPISpec | None = None
    table_columns: list[TableColumnSpec] | None = None
    on_click_filter: PanelOnClickFilter | None = None
    exclude_filters: list[str] | None = None
    selectable: bool | None = None
    on_click_message: str | None = None


class DashboardLayout(_Strict):
    columns: Annotated[int, Field(ge=1, le=4)]


class DashboardSpec(_Strict):
    id: str
    title: str
    layout: DashboardLayout
    panels: list[PanelSpec]
    description: str | None = None
    filters: list[DashboardFilterSpec] | None = None
    auto_refresh: bool | None = None


# ─── Infographic ─────────────────────────────────────────────────────────────

InfographicType = Literal["flowchart", "orgchart", "timeline"]
LayoutDirection = Literal["TB", "LR", "BT", "RL"]
NodeCategory = Literal["start", "process", "decision", "end", "info", "warning"]


class InfographicNodeSpec(_Strict):
    id: str
    label: str
    description: str | None = None
    icon: str | None = None
    category: NodeCategory | None = None
    color: str | None = None


class InfographicEdgeSpec(_Strict):
    id: str
    source: str
    target: str
    label: str | None = None
    style: Literal["solid", "dashed", "dotted"] | None = None


class InfographicSpec(_Strict):
    id: str
    type: InfographicType
    title: str
    nodes: list[InfographicNodeSpec]
    edges: list[InfographicEdgeSpec]
    description: str | None = None
    direction: LayoutDirection | None = None


# ─── Widgets ─────────────────────────────────────────────────────────────────

WidgetType = Literal[
    "comparison", "checklist", "ranking", "swot", "risk_matrix",
]


class ComparisonFeature(_Strict):
    label: str
    value: str | bool


class ComparisonOption(_Strict):
    title: str
    features: list[ComparisonFeature]
    description: str | None = None
    icon: str | None = None
    color: str | None = None
    badge: str | None = None


class ChecklistItem(_Strict):
    label: str
    checked: bool
    description: str | None = None
    priority: Literal["high", "medium", "low"] | None = None


class RankingItem(_Strict):
    label: str
    value: float
    unit: str | None = None
    icon: str | None = None
    color: str | None = None
    change: float | None = None


class SwotData(_Strict):
    strengths: list[str]
    weaknesses: list[str]
    opportunities: list[str]
    threats: list[str]


class RiskItem(_Strict):
    label: str
    likelihood: Annotated[int, Field(ge=1, le=5)]
    impact: Annotated[int, Field(ge=1, le=5)]
    description: str | None = None
    color: str | None = None


# Widgets tipados por discriminador `type` — cada subclase sólo expone los
# campos relevantes. Esto le da al modelo un schema más acotado cuando se usa
# Structured Outputs.

class _WidgetBase(_Strict):
    id: str
    title: str
    description: str | None = None


class ComparisonWidgetSpec(_WidgetBase):
    type: Literal["comparison"] = "comparison"
    options: list[ComparisonOption]


class ChecklistWidgetSpec(_WidgetBase):
    type: Literal["checklist"] = "checklist"
    items: list[ChecklistItem]


class RankingWidgetSpec(_WidgetBase):
    type: Literal["ranking"] = "ranking"
    items: list[RankingItem]


class SwotWidgetSpec(_WidgetBase):
    type: Literal["swot"] = "swot"
    swot: SwotData


class RiskMatrixWidgetSpec(_WidgetBase):
    type: Literal["risk_matrix"] = "risk_matrix"
    risks: list[RiskItem]


WidgetSpec = Annotated[
    Union[
        ComparisonWidgetSpec,
        ChecklistWidgetSpec,
        RankingWidgetSpec,
        SwotWidgetSpec,
        RiskMatrixWidgetSpec,
    ],
    Field(discriminator="type"),
]


# ─── Evento WebSocket ────────────────────────────────────────────────────────

UIComponentKind = Literal["chart", "dashboard", "kpi", "infographic", "widget"]


class UIComponentEvent(_Strict):
    """
    Payload del evento WebSocket `ui-component` emitido por el backend al
    frontend cuando una tool genera un spec validado.

    El frontend renderiza directamente con el `spec`, sin pasar por parser
    de markdown.
    """

    message_id: str
    kind: UIComponentKind
    spec: dict  # serialización del *Spec — el frontend hace su propia validación final


__all__ = [
    # Chart
    "ChartSpec", "ChartType", "YKeySpec", "ChartFilterSpec", "FilterOption",
    # KPI
    "StandaloneKPISpec", "KPICardSpec", "KPITrend", "KPIComparison", "KPITarget", "KPIFormat",
    # Dashboard
    "DashboardSpec", "PanelSpec", "PanelType", "DashboardFilterSpec",
    "DashboardKPISpec", "TableColumnSpec", "PanelOnClickFilter", "DashboardLayout",
    # Infographic
    "InfographicSpec", "InfographicType", "InfographicNodeSpec", "InfographicEdgeSpec",
    "LayoutDirection", "NodeCategory",
    # Widgets (unión + subtypes)
    "WidgetSpec", "WidgetType",
    "ComparisonWidgetSpec", "ChecklistWidgetSpec", "RankingWidgetSpec",
    "SwotWidgetSpec", "RiskMatrixWidgetSpec",
    # Event
    "UIComponentEvent", "UIComponentKind",
]
