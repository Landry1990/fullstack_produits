import re
from datetime import date, datetime
from decimal import Decimal

from openpyxl.cell.cell import MergedCell
from openpyxl.utils import get_column_letter


MAX_COLUMN_WIDTH = 50
COLUMN_PADDING = 2


def _display_value(cell):
    value = cell.value
    if value is None:
        return ''
    if isinstance(value, bool):
        return 'TRUE' if value else 'FALSE'
    if isinstance(value, (datetime, date)):
        return value.strftime('%d/%m/%Y %H:%M:%S' if isinstance(value, datetime) else '%d/%m/%Y')
    if isinstance(value, (int, float, Decimal)):
        number_format = cell.number_format.split(';')[0]
        if number_format == 'General':
            return str(value)
        pattern = re.search(r'[0#][0#,]*(?:\.([0#]+))?', number_format)
        if pattern:
            decimals = len(pattern.group(1) or '')
            grouping = ',' if ',' in pattern.group(0).split('.')[0] else ''
            percent = '%' in number_format
            text = format(value * 100 if percent else value, f'{grouping}.{decimals}f')
            return text + ('%' if percent else '')
    return str(value)


def fit_excel_columns(ws, min_row=1, max_row=None, max_width=MAX_COLUMN_WIDTH):
    merged = tuple(ws.merged_cells.ranges)
    widths = {}
    for row in ws.iter_rows(min_row=min_row, max_row=max_row or ws.max_row):
        for cell in row:
            if isinstance(cell, MergedCell):
                continue
            if any(r.min_row <= cell.row <= r.max_row and r.min_col <= cell.column <= r.max_col for r in merged):
                continue
            text = _display_value(cell)
            length = max((len(line) for line in text.splitlines()), default=0)
            widths[cell.column] = max(widths.get(cell.column, 0), length)
    for column, length in widths.items():
        dimension = ws.column_dimensions[get_column_letter(column)]
        dimension.width = min(length + COLUMN_PADDING, max_width)
        dimension.bestFit = False
