"""Hoja Portada y hoja Resumen con KPI tiles grandes."""
from __future__ import annotations

from datetime import datetime
from typing import TYPE_CHECKING

from app.agents.excel.schema import KPISpec, SummarySheetSpec
from app.agents.excel.theme import NUMBER_FORMATS

if TYPE_CHECKING:
    import xlsxwriter


def build_cover_sheet(
    workbook: "xlsxwriter.Workbook",
    formats: dict,
    *,
    title: str,
    subtitle: str | None = None,
    author: str | None = None,
    division: str | None = None,
) -> None:
    ws = workbook.add_worksheet("Portada")
    ws.set_tab_color(formats["preset"]["accent_color"])
    ws.hide_gridlines(2)

    for c in range(0, 12):
        ws.set_column(c, c, 12)
    for r in range(0, 25):
        ws.set_row(r, 22)

    ws.set_row(6, 56)
    ws.merge_range(6, 1, 6, 10, title, formats["cover_title"])

    if subtitle:
        ws.set_row(8, 28)
        ws.merge_range(8, 1, 8, 10, subtitle, formats["cover_sub"])

    today = datetime.now().strftime("%d-%m-%Y")
    rows: list[tuple[str, str]] = [("Fecha", today)]
    if author:
        rows.append(("Autor", author))
    if division:
        rows.append(("División", division))
    rows.append(("Generado por", "Plataforma IA"))

    start_row = 12
    for offset, (label, value) in enumerate(rows):
        ws.merge_range(start_row + offset, 2, start_row + offset, 4,
                       label, formats["cover_meta_label"])
        ws.merge_range(start_row + offset, 5, start_row + offset, 9,
                       value, formats["cover_meta_value"])

    ws.set_footer("&LPlataforma IA&C&D&RPortada")


def build_summary_sheet(
    workbook: "xlsxwriter.Workbook",
    formats: dict,
    spec: SummarySheetSpec,
) -> None:
    ws = workbook.add_worksheet(spec.name[:31])
    ws.set_tab_color(formats["preset"]["accent_color"])
    ws.hide_gridlines(2)

    for c in range(0, 16):
        ws.set_column(c, c, 11)

    ws.set_row(0, 30)
    ws.merge_range(0, 0, 0, 11, spec.name, formats["title"])

    if spec.kpis:
        _render_kpi_tiles(workbook, ws, formats, spec.kpis, start_row=2)
        next_row = 2 + 4 + 1
    else:
        next_row = 2

    # Nota: `_render_summary_chart` produce un chart sin series enlazadas a una
    # hoja de datos concreta, lo que rompe `workbook.close()` con
    # EmptyChartSeries. Mientras no haya pipeline para resolver el rango fuente
    # desde la hoja Resumen, omitimos la inserción y dejamos los KPI tiles como
    # contenido principal. Para charts de detalle, usar `sheet_spec.chart` —
    # ese sí se enlaza vía `insert_chart` en `_render_sheet`.

    if spec.notes:
        ws.set_row(next_row, 60)
        ws.merge_range(next_row, 0, next_row, 11, spec.notes, formats["notes"])

    ws.set_footer("&LPlataforma IA&C&D&R&A")


def _render_kpi_tiles(
    workbook: "xlsxwriter.Workbook",
    ws,
    formats: dict,
    kpis: list[KPISpec],
    start_row: int,
) -> None:
    """Renderiza tiles 3 cols × N filas: label / value / delta."""
    cols_per_tile = 3
    tiles_per_row = 4
    gap = 1

    for idx, kpi in enumerate(kpis):
        row_block = idx // tiles_per_row
        col_in_row = idx % tiles_per_row
        r = start_row + row_block * 5
        c = col_in_row * (cols_per_tile + gap)

        ws.set_row(r, 22)
        ws.set_row(r + 1, 36)
        ws.set_row(r + 2, 18)

        ws.merge_range(r, c, r, c + cols_per_tile - 1, kpi.label, formats["kpi_label"])

        value_fmt_key = f"kpi_value_{kpi.color}"
        value_fmt = formats.get(value_fmt_key, formats["kpi_value_neutral"])

        if isinstance(kpi.value, (int, float)) and not isinstance(kpi.value, bool):
            value_fmt_with_num = workbook.add_format({
                "bold": True,
                "font_size": 22,
                "align": "center",
                "valign": "vcenter",
                "left": 1, "right": 1,
                "left_color": "#D0D5DD", "right_color": "#D0D5DD",
                "num_format": NUMBER_FORMATS.get(kpi.format, "#,##0.00"),
                "font_color": value_fmt.__dict__.get("font_color", "#1A1A1A"),
            })
            ws.merge_range(r + 1, c, r + 1, c + cols_per_tile - 1,
                           kpi.value, value_fmt_with_num)
        else:
            ws.merge_range(r + 1, c, r + 1, c + cols_per_tile - 1,
                           str(kpi.value), value_fmt)

        if kpi.delta is None:
            delta_text = ""
            delta_fmt = formats["kpi_delta_zero"]
        else:
            arrow = "▲" if kpi.delta > 0 else ("▼" if kpi.delta < 0 else "■")
            delta_text = f"{arrow} {kpi.delta:+.1f}%"
            delta_fmt = (
                formats["kpi_delta_pos"] if kpi.delta > 0
                else formats["kpi_delta_neg"] if kpi.delta < 0
                else formats["kpi_delta_zero"]
            )
        ws.merge_range(r + 2, c, r + 2, c + cols_per_tile - 1, delta_text, delta_fmt)
