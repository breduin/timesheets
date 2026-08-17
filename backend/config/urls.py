from django.contrib import admin
from django.http import JsonResponse
from django.urls import include, path

admin.site.site_header = "Timesheets"
admin.site.site_title = "Timesheets"
admin.site.index_title = "Timesheets"


def health(_request):
    return JsonResponse({"status": "ok"})


urlpatterns = [
    path("admin/", admin.site.urls),
    path("api/health/", health),
    path("api/auth/", include("djoser.urls")),
    path("api/auth/", include("djoser.urls.jwt")),
    path("api/", include("apps.projects.urls")),
    path("api/", include("apps.tracking.urls")),
    path("api/", include("apps.users.urls")),
]
