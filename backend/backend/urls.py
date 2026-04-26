from django.contrib import admin
from django.urls import path, include
from api.views import CustomAuthToken
from django.conf import settings
from django.conf.urls.static import static

urlpatterns = [
    path('silk/', include('silk.urls', namespace='silk')),
    path('admin/', admin.site.urls),
    path('api/', include('api.urls')),
    path('api-token-auth/', CustomAuthToken.as_view()), # Direct mapping to token view
]

if settings.DEBUG:
    urlpatterns += static(settings.MEDIA_URL, document_root=settings.MEDIA_ROOT)
