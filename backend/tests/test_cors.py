import pytest


@pytest.fixture
def cors_strict(settings):
    settings.DEBUG = False
    settings.CORS_ALLOW_ALL_ORIGINS = False
    settings.CORS_ALLOWED_ORIGIN_REGEXES = []
    settings.CORS_ALLOWED_ORIGINS = ["http://localhost:5173", "http://127.0.0.1:5173"]
    settings.CORS_ALLOW_CREDENTIALS = True
    settings.CORS_EXPOSE_HEADERS = ["Content-Disposition"]
    settings.CORS_ALLOW_PRIVATE_NETWORK = True
    settings.CSRF_TRUSTED_ORIGINS = list(settings.CORS_ALLOWED_ORIGINS)


@pytest.mark.django_db
@pytest.mark.parametrize("origin", ["http://localhost:5173", "http://127.0.0.1:5173"])
def test_cors_allows_frontend_origins(api, cors_strict, origin):
    response = api.get("/api/health/", HTTP_ORIGIN=origin)
    assert response.status_code == 200
    assert response["Access-Control-Allow-Origin"] == origin
    assert response["Access-Control-Allow-Credentials"] == "true"


@pytest.mark.django_db
def test_cors_rejects_unknown_origin(api, cors_strict):
    response = api.get("/api/health/", HTTP_ORIGIN="http://evil.example")
    assert response.status_code == 200
    assert "Access-Control-Allow-Origin" not in response


@pytest.mark.django_db
def test_cors_preflight_api(api, cors_strict):
    response = api.options(
        "/api/auth/jwt/create/",
        HTTP_ORIGIN="http://localhost:5173",
        HTTP_ACCESS_CONTROL_REQUEST_METHOD="POST",
        HTTP_ACCESS_CONTROL_REQUEST_HEADERS="content-type,authorization",
    )
    assert response.status_code == 200
    assert response["Access-Control-Allow-Origin"] == "http://localhost:5173"
    allow_headers = response["Access-Control-Allow-Headers"].lower()
    assert "authorization" in allow_headers
    assert "content-type" in allow_headers
    allow_methods = response["Access-Control-Allow-Methods"]
    assert "POST" in allow_methods
    assert "PATCH" in allow_methods
    assert "DELETE" in allow_methods


@pytest.mark.django_db
def test_cors_preflight_private_network(api, cors_strict):
    response = api.options(
        "/api/health/",
        HTTP_ORIGIN="http://localhost:5173",
        HTTP_ACCESS_CONTROL_REQUEST_METHOD="GET",
        HTTP_ACCESS_CONTROL_REQUEST_PRIVATE_NETWORK="true",
    )
    assert response.status_code == 200
    assert response["Access-Control-Allow-Private-Network"] == "true"


@pytest.mark.django_db
def test_cors_debug_allows_lan_origin(api, settings):
    settings.DEBUG = True
    settings.CORS_ALLOW_ALL_ORIGINS = True
    response = api.get("/api/health/", HTTP_ORIGIN="http://172.18.0.1:5173")
    assert response.status_code == 200
    assert response["Access-Control-Allow-Origin"] == "http://172.18.0.1:5173"
