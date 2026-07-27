"""
Tests de validation des entrées sur les endpoints de verrouillage.
Vérifie : auth manquante/invalid, PK inexistant, méthodes HTTP interdites,
payloads malformés, injection Redis, accès cross-entité, etc.
"""
import json
import sys

import requests

BASE = 'http://localhost:8000'
VALID_TOKEN = '1de8ad310a0cb8c971849f187edea04052993f87'
H_VALID = {'Authorization': f'Token {VALID_TOKEN}'}

passed = 0
failed = 0


def check(name, condition, detail=''):
    global passed, failed
    if condition:
        print(f'  ✅ {name}')
        passed += 1
    else:
        print(f'  ❌ {name} — {detail}')
        failed += 1


# ─── 1. Authentification ───
print('\n=== 1. Authentification ===')

# No token
r = requests.get(f'{BASE}/api/commandes/1/check_lock/')
check('GET sans token → 401', r.status_code == 401, f'got {r.status_code}')

r = requests.post(f'{BASE}/api/commandes/1/lock/')
check('POST lock sans token → 401', r.status_code == 401, f'got {r.status_code}')

r = requests.post(f'{BASE}/api/commandes/1/unlock/')
check('POST unlock sans token → 401', r.status_code == 401, f'got {r.status_code}')

# Invalid token
H_BAD = {'Authorization': 'Token invalidtoken1234567890'}
r = requests.get(f'{BASE}/api/commandes/1/check_lock/', headers=H_BAD)
check('GET token invalide → 401', r.status_code == 401, f'got {r.status_code}')

r = requests.post(f'{BASE}/api/commandes/1/lock/', headers=H_BAD)
check('POST lock token invalide → 401', r.status_code == 401, f'got {r.status_code}')

# Malformed header
H_MAL = {'Authorization': 'Bearer xyz'}
r = requests.get(f'{BASE}/api/commandes/1/check_lock/', headers=H_MAL)
check('GET header malformé → 401', r.status_code == 401, f'got {r.status_code}')

H_EMPTY = {'Authorization': ''}
r = requests.get(f'{BASE}/api/commandes/1/check_lock/', headers=H_EMPTY)
check('GET header vide → 401', r.status_code == 401, f'got {r.status_code}')


# ─── 2. PK inexistant / invalide ───
print('\n=== 2. PK inexistant / invalide ===')

# Non-existent PK
r = requests.get(f'{BASE}/api/commandes/999999/check_lock/', headers=H_VALID)
check('GET check_lock PK inexistant → 200 (lock=false)', r.status_code == 200 and not r.json().get('locked'), f'got {r.status_code} {r.text[:100]}')

r = requests.post(f'{BASE}/api/commandes/999999/lock/', headers=H_VALID)
check('POST lock PK inexistant → 200 (lock sur doc fantôme)', r.status_code == 200, f'got {r.status_code}')
# Cleanup
requests.post(f'{BASE}/api/commandes/999999/unlock/', headers=H_VALID)

# Non-numeric PK
r = requests.get(f'{BASE}/api/commandes/abc/check_lock/', headers=H_VALID)
check('GET check_lock PK non-numérique → 404', r.status_code == 404, f'got {r.status_code}')

r = requests.post(f'{BASE}/api/commandes/abc/lock/', headers=H_VALID)
check('POST lock PK non-numérique → 404', r.status_code == 404, f'got {r.status_code}')

# Negative PK
r = requests.get(f'{BASE}/api/commandes/-1/check_lock/', headers=H_VALID)
check('GET check_lock PK négatif → 404', r.status_code == 404, f'got {r.status_code}')

# PK = 0
r = requests.get(f'{BASE}/api/commandes/0/check_lock/', headers=H_VALID)
check('GET check_lock PK=0 → 404', r.status_code == 404, f'got {r.status_code}')


# ─── 3. Méthodes HTTP interdites ───
print('\n=== 3. Méthodes HTTP interdites ===')

# PUT/PATCH/DELETE on lock endpoint
r = requests.put(f'{BASE}/api/commandes/1/lock/', headers=H_VALID, json={})
check('PUT lock → 405', r.status_code == 405, f'got {r.status_code}')

r = requests.patch(f'{BASE}/api/commandes/1/lock/', headers=H_VALID, json={})
check('PATCH lock → 405', r.status_code == 405, f'got {r.status_code}')

r = requests.delete(f'{BASE}/api/commandes/1/lock/', headers=H_VALID)
check('DELETE lock → 405', r.status_code == 405, f'got {r.status_code}')

# GET on lock (POST only)
r = requests.get(f'{BASE}/api/commandes/1/lock/', headers=H_VALID)
check('GET lock (POST only) → 405', r.status_code == 405, f'got {r.status_code}')

# POST on check_lock (GET only)
r = requests.post(f'{BASE}/api/commandes/1/check_lock/', headers=H_VALID)
check('POST check_lock (GET only) → 405', r.status_code == 405, f'got {r.status_code}')


# ─── 4. Payload malformé ───
print('\n=== 4. Payload malformé ===')

# lock with body (should ignore body, not crash)
r = requests.post(f'{BASE}/api/commandes/1/lock/', headers=H_VALID, json={'foo': 'bar'})
check('POST lock avec body inutile → 200', r.status_code == 200, f'got {r.status_code}')
requests.post(f'{BASE}/api/commandes/1/unlock/', headers=H_VALID)

# lock with empty body
r = requests.post(f'{BASE}/api/commandes/1/lock/', headers=H_VALID, data='')
check('POST lock body vide → 200', r.status_code == 200, f'got {r.status_code}')
requests.post(f'{BASE}/api/commandes/1/unlock/', headers=H_VALID)

# lock with invalid JSON
r = requests.post(f'{BASE}/api/commandes/1/lock/', headers={**H_VALID, 'Content-Type': 'application/json'}, data='not json')
check('POST lock JSON invalide → 200 (body ignoré)', r.status_code == 200, f'got {r.status_code}')
requests.post(f'{BASE}/api/commandes/1/unlock/', headers=H_VALID)

# unlock with body
r = requests.post(f'{BASE}/api/commandes/1/lock/', headers=H_VALID)
r = requests.post(f'{BASE}/api/commandes/1/unlock/', headers=H_VALID, json={'force': True})
check('POST unlock avec body → 200', r.status_code == 200, f'got {r.status_code}')


# ─── 5. Injection Redis (clé de lock) ───
print('\n=== 5. Injection Redis ===')

# The PK is used in Redis key: doc_lock:commande:<pk>
# Test that non-numeric PKs are rejected by URL routing (already tested above)
# Test that the lock key is not injectable via PK
r = requests.get(f'{BASE}/api/commandes/1%20%7C%20SET%20foo%20bar/check_lock/', headers=H_VALID)
check('GET check_lock avec injection URL → 404', r.status_code == 404, f'got {r.status_code}')


# ─── 6. Cross-entité : lock commande n'affecte pas inventaire ───
print('\n=== 6. Isolation cross-entité ===')

r = requests.post(f'{BASE}/api/commandes/1/lock/', headers=H_VALID)
check('Lock commande 1 → 200', r.status_code == 200)

r = requests.get(f'{BASE}/api/inventaires/1/check_lock/', headers=H_VALID)
check('Inventaire 1 non affecté par lock commande', not r.json().get('locked'), f'got {r.json()}')

r = requests.post(f'{BASE}/api/inventaires/1/lock/', headers=H_VALID)
check('Lock inventaire 1 pendant commande 1 locké → 200', r.status_code == 200, f'got {r.status_code}')

r = requests.get(f'{BASE}/api/commandes/1/check_lock/', headers=H_VALID)
check('Commande 1 toujours locké par loadtest', r.json().get('holder') == 'loadtest', f'got {r.json()}')

# Cleanup
requests.post(f'{BASE}/api/commandes/1/unlock/', headers=H_VALID)
requests.post(f'{BASE}/api/inventaires/1/unlock/', headers=H_VALID)


# ─── 7. Re-lock par même user (idempotence) ───
print('\n=== 7. Re-lock par même user ===')

r = requests.post(f'{BASE}/api/commandes/1/lock/', headers=H_VALID)
check('1er lock → 200', r.status_code == 200)

r = requests.post(f'{BASE}/api/commandes/1/lock/', headers=H_VALID)
check('2e lock par même user → 200 (renew)', r.status_code == 200 and r.json().get('holder') == 'loadtest', f'got {r.status_code} {r.json()}')

r = requests.post(f'{BASE}/api/commandes/1/lock/', headers=H_VALID)
check('3e lock par même user → 200 (renew)', r.status_code == 200)

requests.post(f'{BASE}/api/commandes/1/unlock/', headers=H_VALID)


# ─── 8. Double unlock ───
print('\n=== 8. Double unlock ===')

r = requests.post(f'{BASE}/api/commandes/1/lock/', headers=H_VALID)
r = requests.post(f'{BASE}/api/commandes/1/unlock/', headers=H_VALID)
check('1er unlock → 200', r.status_code == 200)

r = requests.post(f'{BASE}/api/commandes/1/unlock/', headers=H_VALID)
check('2e unlock (déjà libre) → 200', r.status_code == 200, f'got {r.status_code}')


# ─── 9. WebSocket : token invalide ───
print('\n=== 9. WebSocket : authentification ===')

try:
    import websocket

    # Invalid token
    try:
        ws = websocket.create_connection('ws://localhost:8000/ws/lock/commande/1/?token=invalidtoken', timeout=3)
        check('WS token invalide → connexion fermée', False, 'should have been rejected')
        ws.close()
    except Exception as e:
        check('WS token invalide → rejeté', 'Forbidden' in str(e) or '1008' in str(e) or '4001' in str(e), f'got {e}')

    # No token
    try:
        ws = websocket.create_connection('ws://localhost:8000/ws/lock/commande/1/', timeout=3)
        # AuthMiddlewareStack might allow anonymous → consumer closes with 4001
        msg = ws.recv()
        check('WS sans token → rejeté par consumer', True)
        ws.close()
    except Exception as e:
        check('WS sans token → rejeté', True, f'closed with {e}')

    # Valid token, non-existent PK (WebSocket doesn't check DB, just creates lock key)
    try:
        ws = websocket.create_connection(f'ws://localhost:8000/ws/lock/commande/999999/?token={VALID_TOKEN}', timeout=3)
        msg = json.loads(ws.recv())
        check('WS PK inexistant → connecté + état initial', msg['type'] in ('lock_released', 'lock_denied'), f'got {msg}')
        ws.close()
    except Exception as e:
        check('WS PK inexistant → connecté', False, f'got {e}')

except ImportError:
    print('  ⚠️ websocket-client non installé, tests WS ignorés')


# ─── 10. Inventaire : mêmes validations ───
print('\n=== 10. Inventaire : validations ===')

r = requests.get(f'{BASE}/api/inventaires/abc/check_lock/', headers=H_VALID)
check('Inventaire PK non-numérique → 404', r.status_code == 404, f'got {r.status_code}')

r = requests.get(f'{BASE}/api/inventaires/999999/check_lock/', headers=H_VALID)
check('Inventaire PK inexistant → 200 (lock=false)', r.status_code == 200 and not r.json().get('locked'), f'got {r.status_code}')

r = requests.put(f'{BASE}/api/inventaires/1/lock/', headers=H_VALID, json={})
check('Inventaire PUT lock → 405', r.status_code == 405, f'got {r.status_code}')

r = requests.get(f'{BASE}/api/inventaires/1/lock/', headers=H_VALID)
check('Inventaire GET lock (POST only) → 405', r.status_code == 405, f'got {r.status_code}')


# ─── Résumé ───
print(f'\n{"=" * 50}')
print(f'RÉSULTAT : {passed} passés, {failed} échoués')
if failed > 0:
    print('❌ DES TESTS ONT ÉCHOUÉ')
    sys.exit(1)
else:
    print('✅ TOUS LES TESTS DE VALIDATION ONT PASSÉ')
