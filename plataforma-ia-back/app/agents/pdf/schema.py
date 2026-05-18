"""Modelos Pydantic para la spec declarativa de reportes PDF."""
from typing import Literal, Optional

from pydantic import BaseModel, ConfigDict, Field


class PDFKpi(BaseModel):
    model_config = ConfigDict(extra="ignore")

    label: str = Field(min_length=1, max_length=80)
    value: str = Field(min_length=1, max_length=40)
    trend: Optional[Literal["up", "down", "flat"]] = None
    caption: Optional[str] = Field(default=None, max_length=120)


class PDFTable(BaseModel):
    model_config = ConfigDict(extra="ignore")

    headers: list[str] = Field(min_length=1, max_length=12)
    rows: list[list[str]] = Field(default_factory=list, max_length=200)
    caption: Optional[str] = None


class PDFSection(BaseModel):
    model_config = ConfigDict(extra="ignore")

    heading: Optional[str] = Field(default=None, max_length=200)
    body: Optional[str] = Field(default=None, max_length=20000)
    bullets: Optional[list[str]] = Field(default=None, max_length=30)
    table: Optional[PDFTable] = None
    kpis: Optional[list[PDFKpi]] = Field(default=None, max_length=8)
    page_break: bool = False


class PDFReportSpec(BaseModel):
    model_config = ConfigDict(extra="ignore")

    filename: str = Field(pattern=r"^[\w\-. ]+\.pdf$")
    title: str = Field(min_length=1, max_length=200)
    subtitle: Optional[str] = Field(default=None, max_length=300)
    author: Optional[str] = Field(default=None, max_length=120)
    division: Optional[str] = Field(default=None, max_length=80)
    date: Optional[str] = Field(default=None, max_length=40)
    sections: list[PDFSection] = Field(min_length=1, max_length=40)
