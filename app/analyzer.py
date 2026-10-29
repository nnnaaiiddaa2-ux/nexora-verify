
import ast
from typing import Any


MAX_LINE_LENGTH = 100


def analyze_python_code(source: str) -> list[dict[str, Any]]:
    """Analyze Python source code and return a list of issues."""

    issues: list[dict[str, Any]] = []

    if not source.strip():
        return [
            {
                "code": "EMPTY_FILE",
                "severity": "warning",
                "line": 1,
                "message": "The Python file is empty.",
            }
        ]

    try:
        tree = ast.parse(source)
    except SyntaxError as error:
        issues.append(
            {
                "code": "SYNTAX_ERROR",
                "severity": "error",
                "line": error.lineno or 1,
                "message": error.msg,
            }
        )
        return issues

    lines = source.splitlines()

    if source and not source.endswith("\n"):
        issues.append(
            {
                "code": "MISSING_FINAL_NEWLINE",
                "severity": "info",
                "line": len(lines),
                "message": "The file should end with a newline.",
            }
        )

    for line_number, line in enumerate(lines, start=1):
        if len(line) > MAX_LINE_LENGTH:
            issues.append(
                {
                    "code": "LINE_TOO_LONG",
                    "severity": "warning",
                    "line": line_number,
                    "message": (
                        f"Line contains {len(line)} characters; "
                        f"the recommended maximum is {MAX_LINE_LENGTH}."
                    ),
                }
            )

    imported_names: dict[str, int] = {}

    for node in ast.walk(tree):
        if isinstance(node, ast.Import):
            for alias in node.names:
                name = alias.asname or alias.name.split(".")[0]
                imported_names[name] = node.lineno

        elif isinstance(node, ast.ImportFrom):
            for alias in node.names:
                if alias.name == "*":
                    continue

                name = alias.asname or alias.name
                imported_names[name] = node.lineno

    used_names = {
        node.id
        for node in ast.walk(tree)
        if isinstance(node, ast.Name)
        and isinstance(node.ctx, ast.Load)
    }

    for name, line_number in imported_names.items():
        if name not in used_names:
            issues.append(
                {
                    "code": "UNUSED_IMPORT",
                    "severity": "warning",
                    "line": line_number,
                    "message": f"Imported name '{name}' is not used.",
                }
            )

    return sorted(
        issues,
        key=lambda issue: (
            issue["line"],
            issue["code"],
        ),
    )
