from django.contrib import admin
from django.urls import path, include
from api.views import CustomAuthToken

urlpatterns = [
    path('silk/', include('silk.urls', namespace='silk')),
    path('admin/', admin.site.urls),
    path('api/', include('api.urls')),
    path('api-token-auth/', CustomAuthToken.as_view()), # Direct mapping to token view
]
