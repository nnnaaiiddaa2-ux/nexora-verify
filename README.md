# Nexora Verify

A Python code analysis web application built with FastAPI, SQLite, and JavaScript.

Nexora Verify helps developers identify common Python code issues through a modern web dashboard. It combines automated code analysis, analysis history, and selected automatic fixes in one application.

## Features

- **Python code analysis** — detect common code issues.
- **Syntax error detection** — identify invalid Python syntax.
- **Unused import detection** — identify imports that are not used.
- **Code quality checks** — detect empty files, missing final newlines, and long lines.
- **Automatic fixes** — fix supported issues directly in the editor.
- **Analysis history** — review previous analyses.
- **Analysis details** — inspect detected issues.
- **Statistics** — view analysis statistics.
- **REST API** — access application functionality through FastAPI.
- **SQLite database** — store analysis records.
- **Modern web interface** — interact with the analyzer through a browser.

## Tech Stack

- Python
- FastAPI
- SQLite
- HTML
- CSS
- JavaScript
- pytest

## Getting Started

### Prerequisites

- Python 3.10 or newer
- Git

### 1. Clone the repository

```bash
git clone https://github.com/nnnaaiiddaa2-ux/nexora-verify.git
cd nexora-verify
```

### 2. Create a virtual environment

Windows PowerShell:

```powershell
python -m venv .venv
.\.venv\Scripts\Activate.ps1
```

### 3. Install dependencies

```bash
python -m pip install -r requirements.txt
```

### 4. Start the application

```bash
python -m uvicorn app.main:app
```

Open the web application:

http://127.0.0.1:8000/app

Interactive API documentation:

http://127.0.0.1:8000/docs

Health check:

http://127.0.0.1:8000/health

## Running Tests

Run the test suite with:

```bash
python -m pytest -v
```

## Project Structure

```text
nexora-verify/
├── app/
│   ├── __init__.py
│   ├── analyzer.py
│   ├── database.py
│   └── main.py
├── static/
│   ├── app.js
│   ├── index.html
│   └── styles.css
├── tests/
│   ├── test_analyzer.py
│   └── test_main.py
├── .gitignore
├── README.md
└── requirements.txt
```

## Purpose

Nexora Verify is a portfolio project focused on Python development, automated code analysis, REST API development, database integration, testing, and frontend integration.

## Author

**Naida Ljajic**

GitHub: [nnnaaiiddaa2-ux](https://github.com/nnnaaiiddaa2-ux)

---

Built as a Python development portfolio project.
