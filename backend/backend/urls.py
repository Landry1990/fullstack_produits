
from django.contrib import admin
from django.urls import path, include
from django.views.generic.base import RedirectView

urlpatterns = [
    path('admin/', admin.site.urls),
    path('api/', include('api.urls')),
    # Redirige la racine du site (/) vers la racine de l'API (/api/) pour plus de commodité.
    path('', RedirectView.as_view(url='/api/', permanent=False)),
]
