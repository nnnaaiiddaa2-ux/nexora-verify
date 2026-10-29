
from app.analyzer import analyze_python_code


def test_clean_code_has_no_issues():
    source = "def greet():\n    return 'Hello'\n"

    assert analyze_python_code(source) == []


def test_detects_syntax_error():
    source = "def greet(:\n    return 'Hello'\n"

    issues = analyze_python_code(source)

    assert any(
        issue["code"] == "SYNTAX_ERROR"
        for issue in issues
    )


def test_detects_unused_import():
    source = "import os\n\nprint('Hello')\n"

    issues = analyze_python_code(source)

    assert any(
        issue["code"] == "UNUSED_IMPORT"
        for issue in issues
    )


def test_detects_empty_file():
    issues = analyze_python_code("")

    assert issues[0]["code"] == "EMPTY_FILE"


def test_detects_missing_final_newline():
    source = "print('Hello')"

    issues = analyze_python_code(source)

    assert any(
        issue["code"] == "MISSING_FINAL_NEWLINE"
        for issue in issues
    )


def test_detects_long_line():
    source = "x = '" + ("a" * 110) + "'\n"

    issues = analyze_python_code(source)

    assert any(
        issue["code"] == "LINE_TOO_LONG"
        for issue in issues
    )
