"""Evaluador seguro de expresiones aritméticas sobre columnas de DataFrame.

Reemplaza el uso de `eval()` con un walker AST que sólo permite:
- Literales numéricos (int, float).
- Nombres de columnas (resueltos vs un dict de columnas pre-validado).
- Operadores binarios: + - * / // % **.
- Operador unario: + -.
- Llamadas a un whitelist explícito de funciones (`abs`, `min`, `max`, `round`).

Cualquier otro nodo (atributos, subscripts, llamadas no whitelisteadas,
imports, lambdas, comprehensions) levanta `UnsafeExpressionError`.
"""
from __future__ import annotations

import ast
import operator
from typing import Any, Mapping


class UnsafeExpressionError(ValueError):
    """Expresión contiene construcciones no permitidas."""


_BIN_OPS = {
    ast.Add: operator.add,
    ast.Sub: operator.sub,
    ast.Mult: operator.mul,
    ast.Div: operator.truediv,
    ast.FloorDiv: operator.floordiv,
    ast.Mod: operator.mod,
    ast.Pow: operator.pow,
}

_UNARY_OPS = {
    ast.UAdd: operator.pos,
    ast.USub: operator.neg,
}

_ALLOWED_FUNCS = {
    "abs": abs,
    "min": min,
    "max": max,
    "round": round,
}

_MAX_POW = 6  # impide ** que cause explosión computacional


def safe_arith_eval(expression: str, columns: Mapping[str, Any]) -> Any:
    """Evalúa una expresión aritmética usando los nombres de `columns` como variables.

    Args:
        expression: Cadena (ej: "(precio * cantidad) - descuento").
        columns: dict {nombre: valor/Series} usado para resolver nombres.

    Returns:
        Resultado de la evaluación (típicamente una Series de pandas/polars o
        escalar numérico).

    Raises:
        UnsafeExpressionError: si la expresión contiene construcciones prohibidas
            o referencia un nombre desconocido.
    """
    if not isinstance(expression, str) or not expression.strip():
        raise UnsafeExpressionError("expresión vacía")
    try:
        tree = ast.parse(expression, mode="eval")
    except SyntaxError as exc:
        raise UnsafeExpressionError(f"sintaxis inválida: {exc.msg}") from exc

    return _eval(tree.body, columns)


def _eval(node: ast.AST, columns: Mapping[str, Any]) -> Any:
    if isinstance(node, ast.Constant):
        if isinstance(node.value, (int, float)):
            return node.value
        raise UnsafeExpressionError(
            f"literal no permitido: {type(node.value).__name__}"
        )

    if isinstance(node, ast.Name):
        if node.id in columns:
            return columns[node.id]
        raise UnsafeExpressionError(f"nombre desconocido: {node.id!r}")

    if isinstance(node, ast.BinOp):
        op_type = type(node.op)
        if op_type not in _BIN_OPS:
            raise UnsafeExpressionError(f"operador binario no permitido: {op_type.__name__}")
        left = _eval(node.left, columns)
        right = _eval(node.right, columns)
        if op_type is ast.Pow and isinstance(right, (int, float)) and abs(right) > _MAX_POW:
            raise UnsafeExpressionError(f"exponente fuera de rango (máx {_MAX_POW})")
        return _BIN_OPS[op_type](left, right)

    if isinstance(node, ast.UnaryOp):
        op_type = type(node.op)
        if op_type not in _UNARY_OPS:
            raise UnsafeExpressionError(f"operador unario no permitido: {op_type.__name__}")
        return _UNARY_OPS[op_type](_eval(node.operand, columns))

    if isinstance(node, ast.Call):
        if not isinstance(node.func, ast.Name):
            raise UnsafeExpressionError("solo se permiten llamadas a funciones simples")
        fname = node.func.id
        if fname not in _ALLOWED_FUNCS:
            raise UnsafeExpressionError(f"función no permitida: {fname!r}")
        if node.keywords:
            raise UnsafeExpressionError("kwargs no permitidos en llamadas")
        args = [_eval(arg, columns) for arg in node.args]
        return _ALLOWED_FUNCS[fname](*args)

    if isinstance(node, ast.Tuple):
        return tuple(_eval(elt, columns) for elt in node.elts)

    raise UnsafeExpressionError(f"construcción no permitida: {type(node).__name__}")
