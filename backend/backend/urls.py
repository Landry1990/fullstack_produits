from django.contrib import admin
from django.urls import path, include

urlpatterns = [
    path('silk/', include('silk.urls', namespace='silk')),
    path('admin/', admin.site.urls),
    path('api/', include('api.urls')),
    path('api-token-auth/', include('api.urls')), # Compatibility for existing frontend calls if any
]
