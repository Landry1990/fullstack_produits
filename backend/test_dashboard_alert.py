import os
import django

os.environ.setdefault('DJANGO_SETTINGS_MODULE', 'backend.settings')
django.setup()


from django.test import RequestFactory
from api.views.dashboard import DashboardViewSet

factory = RequestFactory()
request = factory.get('/')

# Mock the current user if needed, but it's not strictly required by this action
# except for decorators. We will call the method directly.

view = DashboardViewSet()
view.request = request

response = view.clients_depassement(request)
print("Status Code:", response.status_code)
print("Data:", response.data)
print("SUCCESS")
