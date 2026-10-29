
from contextlib import asynccontextmanager
from pathlib import Path

from fastapi import FastAPI, HTTPException, Query
from fastapi.responses import FileResponse
from fastapi.staticfiles import StaticFiles
from pydantic import BaseModel, Field

from app.analyzer import analyze_python_code
from app.database import (
    get_analysis,
    get_analysis_history,
    initialize_database,
    save_analysis,
)


BASE_DIR = Path(__file__).resolve().parent.parent
STATIC_DIR = BASE_DIR / "static"


@asynccontextmanager
async def lifespan(app: FastAPI):
    initialize_database()
    yield


app = FastAPI(
    title="Nexora Verify API",
    description=(
        "A developer tool for validating Python projects "
        "and detecting potential code quality issues."
    ),
    version="0.4.0",
    lifespan=lifespan,
)

app.mount(
    "/static",
    StaticFiles(directory=str(STATIC_DIR)),
    name="static",
)


class HealthResponse(BaseModel):
    status: str
    application: str
    version: str


class ProjectRequest(BaseModel):
    name: str = Field(min_length=1, max_length=100)
    language: str = Field(min_length=1, max_length=50)


class CodeAnalysisRequest(BaseModel):
    filename: str = Field(min_length=1, max_length=255)
    source_code: str = Field(max_length=100_000)


@app.get("/", tags=["General"])
def root():
    return {
        "message": "Welcome to Nexora Verify",
        "docs": "/docs",
        "app": "/app",
    }


@app.get("/app", include_in_schema=False)
def frontend():
    return FileResponse(STATIC_DIR / "index.html")


@app.get("/health", response_model=HealthResponse, tags=["General"])
def health_check():
    return HealthResponse(
        status="healthy",
        application="Nexora Verify",
        version="0.4.0",
    )


@app.post("/projects/validate", tags=["Projects"])
def validate_project(project: ProjectRequest):
    return {
        "valid": True,
        "project_name": project.name,
        "language": project.language,
        "message": "Project information passed basic validation.",
    }


@app.post("/analyze", tags=["Code Analysis"])
def analyze_code(request: CodeAnalysisRequest):
    if not request.filename.lower().endswith(".py"):
        return {
            "filename": request.filename,
            "analyzed": False,
            "issue_count": 0,
            "issues": [],
            "message": "Only Python (.py) files are supported.",
        }

    issues = analyze_python_code(request.source_code)

    analysis_id = save_analysis(
        filename=request.filename,
        source_code=request.source_code,
        issues=issues,
    )

    return {
        "id": analysis_id,
        "filename": request.filename,
        "analyzed": True,
        "issue_count": len(issues),
        "issues": issues,
        "message": (
            "Analysis completed."
            if not issues
            else "Analysis completed. Potential issues were found."
        ),
    }


@app.get("/analyses", tags=["Analysis History"])
def analysis_history(
    limit: int = Query(default=20, ge=1, le=100),
):
    items = get_analysis_history(limit=limit)

    return {
        "items": items,
        "count": len(items),
    }


@app.get("/analyses/{analysis_id}", tags=["Analysis History"])
def analysis_details(analysis_id: int):
    analysis = get_analysis(analysis_id)

    if analysis is None:
        raise HTTPException(
            status_code=404,
            detail="Analysis not found.",
        )

    return analysis


@app.get("/statistics", tags=["Statistics"])
def analysis_statistics():
    items = get_analysis_history(limit=100)

    total_analyses = len(items)
    total_issues = sum(item["issue_count"] for item in items)
    clean_analyses = sum(
        1 for item in items if item["issue_count"] == 0
    )
    analyses_with_issues = sum(
        1 for item in items if item["issue_count"] > 0
    )

    return {
        "analyses_in_latest_100": total_analyses,
        "total_issues_in_latest_100": total_issues,
        "clean_analyses_in_latest_100": clean_analyses,
        "analyses_with_issues_in_latest_100": analyses_with_issues,
    }
