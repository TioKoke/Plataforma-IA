"""Inserción de charts embebidos sobre la tabla escrita por polars.write_excel.

La tabla ocupa un rango conocido (``first_row, first_col, last_row, last_col``)
a partir del cual calculamos posiciones relativas y fórmulas de serie.
"""
from __future__ import annotations

from typing import TYPE_CHECKING

from app.agents.excel.schema import ChartSpec

if TYPE_CHECKING:
    import xlsxwriter
    from xlsxwriter.worksheet import Worksheet


XLSX_CHART_TYPES = {
    "bar": {"type": "bar"},
    "column": {"type": "column"},
    "line": {"type": "line"},
    "pie": {"type": "pie"},
    "doughnut": {"type": "doughnut"},
    "area": {"type": "area"},
    "scatter": {"type": "scatter"},
}


def _col_letter(idx: int) -> str:
    """0 -> A, 25 -> Z, 26 -> AA..."""
    result = ""
    n = idx
    while True:
        result = chr(ord("A") + (n % 26)) + result
        n = n // 26 - 1
        if n < 0:
            break
    return result


def _cell_ref(sheet_name: str, row: int, col: int) -> str:
    return f"'{sheet_name}'!${_col_letter(col)}${row + 1}"


def _range_ref(sheet_name: str, r1: int, c1: int, r2: int, c2: int) -> str:
    return (
        f"'{sheet_name}'!${_col_letter(c1)}${r1 + 1}:"
        f"${_col_letter(c2)}${r2 + 1}"
    )


def insert_chart(
    workbook: "xlsxwriter.Workbook",
    worksheet: "Worksheet",
    chart_spec: ChartSpec,
    sheet_name: str,
    data_columns: list[str],
    data_first_row: int,
    data_last_row: int,
    data_first_col: int = 0,
    anchor_cell: str | None = None,
) -> None:
    """Dibuja un chart junto a la tabla.

    Args:
        workbook: workbook xlsxwriter activo.
        worksheet: worksheet donde va el chart.
        chart_spec: configuración del chart (tipo, ejes, etc).
        sheet_name: nombre EXACTO de la hoja donde viven los datos (para fórmulas).
        data_columns: lista ordenada de column keys (misma orden que la tabla en Excel).
        data_first_row: fila 0-indexed del header.
        data_last_row: fila 0-indexed de la última fila de datos (sin totals).
        data_first_col: columna 0-indexed donde empieza la tabla.
        anchor_cell: celda ``"A15"`` donde pegar el chart. Si None → calculado.
    """
    chart_type = XLSX_CHART_TYPES.get(chart_spec.type, {"type": "column"})
    chart = workbook.add_chart(chart_type)
    chart.set_style(chart_spec.style)

    try:
        x_idx = data_columns.index(chart_spec.x_column)
    except ValueError:
        return
    y_indices: list[int] = []
    for y in chart_spec.y_columns:
        if y in data_columns:
            y_indices.append(data_columns.index(y))
    if not y_indices:
        return

    cat_first = data_first_row + 1
    cat_last = data_last_row
    categories = _range_ref(
        sheet_name,
        cat_first, data_first_col + x_idx,
        cat_last, data_first_col + x_idx,
    )

    for y_idx in y_indices:
        col = data_first_col + y_idx
        values = _range_ref(sheet_name, cat_first, col, cat_last, col)
        name = _cell_ref(sheet_name, data_first_row, col)
        chart.add_series({
            "name": name,
            "categories": categories,
            "values": values,
            "smooth": chart_spec.type == "line",
        })

    if chart_spec.title:
        chart.set_title({"name": chart_spec.title, "name_font": {"size": 14, "bold": True}})
    chart.set_legend({"position": "bottom" if len(y_indices) > 1 else "none"})
    chart.set_x_axis({"name": chart_spec.x_column})
    if len(chart_spec.y_columns) == 1:
        chart.set_y_axis({"name": chart_spec.y_columns[0]})

    if anchor_cell is None:
        anchor_row = data_last_row + 3
        anchor_col = data_first_col
        anchor_cell = f"{_col_letter(anchor_col)}{anchor_row + 1}"

    worksheet.insert_chart(
        anchor_cell, chart,
        {"x_scale": 1.2, "y_scale": 1.15},
    )
