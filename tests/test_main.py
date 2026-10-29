
import pytest
from fastapi.testclient import TestClient

from app.database import initialize_database
from app.main import app


@pytest.fixture
def client():
    initialize_database()

    with TestClient(app) as test_client:
        yield test_client


def test_root_endpoint(client):
    response = client.get("/")

    assert response.status_code == 200
    assert response.json()["message"] == "Welcome to Nexora Verify"


def test_health_endpoint(client):
    response = client.get("/health")

    assert response.status_code == 200
    assert response.json()["status"] == "healthy"
    assert response.json()["application"] == "Nexora Verify"


def test_validate_project_successfully(client):
    response = client.post(
        "/projects/validate",
        json={
            "name": "My Python Project",
            "language": "Python",
        },
    )

    assert response.status_code == 200
    assert response.json()["valid"] is True
    assert response.json()["project_name"] == "My Python Project"


def test_validate_project_rejects_empty_name(client):
    response = client.post(
        "/projects/validate",
        json={
            "name": "",
            "language": "Python",
        },
    )

    assert response.status_code == 422


def test_analyze_clean_python_code(client):
    response = client.post(
        "/analyze",
        json={
            "filename": "hello.py",
            "source_code": "def greet():\n    return 'Hello'\n",
        },
    )

    assert response.status_code == 200
    assert response.json()["analyzed"] is True
    assert response.json()["issue_count"] == 0
    assert isinstance(response.json()["id"], int)


def test_analyze_detects_syntax_error(client):
    response = client.post(
        "/analyze",
        json={
            "filename": "broken.py",
            "source_code": "def greet(:\n    return 'Hello'\n",
        },
    )

    assert response.status_code == 200
    assert any(
        issue["code"] == "SYNTAX_ERROR"
        for issue in response.json()["issues"]
    )


def test_analyze_rejects_non_python_file(client):
    response = client.post(
        "/analyze",
        json={
            "filename": "notes.txt",
            "source_code": "Hello world",
        },
    )

    assert response.status_code == 200
    assert response.json()["analyzed"] is False


def test_analyze_rejects_oversized_source_code(client):
    response = client.post(
        "/analyze",
        json={
            "filename": "large.py",
            "source_code": "x" * 100_001,
        },
    )

    assert response.status_code == 422

def test_analysis_history_endpoint(client):
    response = client.get("/analyses")

    assert response.status_code == 200
    assert "items" in response.json()
    assert "count" in response.json()


def test_get_analysis_details(client):
    create_response = client.post(
        "/analyze",
        json={
            "filename": "details_test.py",
            "source_code": "print('Hello')\n",
        },
    )

    analysis_id = create_response.json()["id"]

    response = client.get(f"/analyses/{analysis_id}")

    assert response.status_code == 200
    assert response.json()["id"] == analysis_id
    assert response.json()["filename"] == "details_test.py"
    assert "issues" in response.json()


def test_get_analysis_that_does_not_exist(client):
    response = client.get("/analyses/999999999")

    assert response.status_code == 404
    
    
def test_statistics_endpoint(client):
    response = client.get("/statistics")

    assert response.status_code == 200

    data = response.json()

    assert "analyses_in_latest_100" in data
    assert "total_issues_in_latest_100" in data
    assert "clean_analyses_in_latest_100" in data
    assert "analyses_with_issues_in_latest_100" in data


def test_statistics_counts_analysis_correctly(client):
    client.post(
        "/analyze",
        json={
            "filename": "statistics_test.py",
            "source_code": "print('Hello')\n",
        },
    )

    response = client.get("/statistics")

    assert response.status_code == 200

    data = response.json()

    assert data["analyses_in_latest_100"] >= 1
    assert (
        data["clean_analyses_in_latest_100"]
        + data["analyses_with_issues_in_latest_100"]
        == data["analyses_in_latest_100"]
    )
