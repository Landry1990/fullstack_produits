"""Profile les requêtes du rapport général Excel : regroupement par pattern SQL."""
import os
import re
import time
from collections import Counter

import django

os.environ.setdefault('DJANGO_SETTINGS_MODULE', 'backend.settings')
django.setup()

from django.db import connection
from django.test.utils import CaptureQueriesContext
from django.utils import timezone


def normalize(sql):
    sql = re.sub(r'\d+', 'N', sql)
    return re.sub(r'\s+', ' ', sql)[:220]


from api.views.rapports.excel_general import _collect_data, build_rapport_general_excel

today = timezone.localdate()
start = timezone.make_aware(timezone.datetime(today.year, today.month, 1))
end = start + timezone.timedelta(days=32)

with CaptureQueriesContext(connection) as ctx:
    t0 = time.perf_counter()
    _collect_data(start, end, lang='fr')
    dt_collect = time.perf_counter() - t0
n_collect = len(ctx)

with CaptureQueriesContext(connection) as ctx2:
    t0 = time.perf_counter()
    build_rapport_general_excel(start, end, 'Test', lang='fr')
    dt_full = time.perf_counter() - t0

print(f"_collect_data : {n_collect} requêtes en {dt_collect*1000:.0f} ms")
print(f"build complet : {len(ctx2)} requêtes en {dt_full*1000:.0f} ms\n")

counter = Counter(normalize(q['sql']) for q in ctx)
print("── _collect_data : patterns répétés ──")
for sql, n in counter.most_common(15):
    print(f"{n:>4}x  {sql}")

counter2 = Counter(normalize(q['sql']) for q in ctx2)
print("\n── build complet : top patterns ──")
for sql, n in counter2.most_common(15):
    print(f"{n:>4}x  {sql}")
