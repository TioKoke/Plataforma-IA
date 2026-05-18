"""Modelos Pydantic para la especificación declarativa de reportes Excel."""
from __future__ import annotations

from typing import Any, Literal, Optional, Union

from pydantic import BaseModel, ConfigDict, Field

ColumnType = Literal["text", "number", "integer", "date", "currency", "percent"]
StylePreset = Literal[
    "modern_orange",
    "corporate_navy",
    "financial",
    "minimal_gray",
    "executive",
]
ReportType = Literal[
    "data_table",
    "kpi_dashboard",
    "financial_report",
    "ranking",
    "comparison",
    "timeseries",
    "auto",
]
TotalFunc = Literal["sum", "average", "count", "max", "min", "std_dev"]
CondFormat = Literal[
    "data_bar", "3_color_scale", "2_color_scale", "top_5", "bottom_5"
]
ChartType = Literal[
    "bar", "column", "line", "pie", "doughnut", "area", "scatter"
]
KPIColor = Literal["green", "red", "blue", "neutral", "orange"]
AutoOrNone = Optional[Literal["auto"]]


class ColumnSpec(BaseModel):
    model_config = ConfigDict(extra="ignore")

    header: str
    key: str
    type: ColumnType = "text"
    width: Optional[float] = None
    number_format: Optional[str] = None


class KPISpec(BaseModel):
    """Tile KPI grande para hoja Resumen."""
    model_config = ConfigDict(extra="ignore")

    label: str
    value: Union[float, int, str]
    delta: Optional[float] = None
    format: ColumnType = "number"
    color: KPIColor = "neutral"


class ChartSpec(BaseModel):
    """Gráfico embebido junto a la tabla o en hoja Resumen."""
    model_config = ConfigDict(extra="ignore")

    type: ChartType
    title: Optional[str] = None
    x_column: str
    y_columns: list[str] = Field(min_length=1)
    position: str = "auto"
    style: int = Field(default=11, ge=1, le=48)


class SummarySheetSpec(BaseModel):
    """Hoja Resumen con KPIs grandes y gráfico opcional."""
    model_config = ConfigDict(extra="ignore")

    name: str = Field(default="Resumen", max_length=31, min_length=1)
    kpis: list[KPISpec] = Field(default_factory=list, max_length=12)
    chart: Optional[ChartSpec] = None
    notes: Optional[str] = None


class SheetSpec(BaseModel):
    model_config = ConfigDict(extra="ignore")

    name: str = Field(max_length=31, min_length=1)
    columns: list[ColumnSpec] = Field(min_length=1)
    rows: list[dict[str, Any]] = Field(default_factory=list)
    table: bool = True
    freeze_header: bool = True
    title: Optional[str] = None
    subtitle: Optional[str] = None
    totals: Union[dict[str, TotalFunc], Literal["auto"], None] = "auto"
    conditional_formats: Union[dict[str, CondFormat], Literal["auto"], None] = "auto"
    chart: Optional[ChartSpec] = None
    sparklines: Optional[dict[str, list[str]]] = None
    group_by: Optional[str] = None
    style_preset: Optional[StylePreset] = None


class ExcelReportSpec(BaseModel):
    model_config = ConfigDict(extra="ignore")

    filename: str = Field(pattern=r"^[\w\-. ]+\.xlsx$")
    sheets: list[SheetSpec] = Field(min_length=1, max_length=20)
    author: Optional[str] = None
    division: Optional[str] = None
    report_type: ReportType = "auto"
    cover_sheet: bool = False
    summary_sheet: Optional[SummarySheetSpec] = None
    style_preset: StylePreset = "modern_orange"
