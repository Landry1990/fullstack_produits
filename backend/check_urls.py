import os
import django
import traceback

os.environ.setdefault('DJANGO_SETTINGS_MODULE', 'backend.settings')

try:
    django.setup()
    from api.urls import router
    print("Router registry keys:")
    for prefix, viewset, basename in router.registry:
        print(f" - Prefix: {prefix}, Basename: {basename}")
except Exception:
    with open('error_log.txt', 'w') as f:
        traceback.print_exc(file=f)
    traceback.print_exc()


try:
    print("Checking 'labeltemplate-list'...")
    url = reverse('labeltemplate-list')
    print(f"Found URL: {url}")
except Exception as e:
    print(f"Error checking labeltemplate-list: {e}")

