"""
Tests avancés du verrouillage pessimiste : TTL, race condition, WebSocket.
"""
import json
import subprocess
import threading
import time

import requests

BASE = 'http://localhost:8000'
TOKEN_A = '1de8ad310a0cb8c971849f187edea04052993f87'  # loadtest
TOKEN_B = '0553224e1246967767d1cd9bb486289417eff0bc'  # loadtest2
HA = {'Authorization': f'Token {TOKEN_A}'}
HB = {'Authorization': f'Token {TOKEN_B}'}


def test_ttl():
    print('=== TEST 5: TTL Expiration ===')
    r = requests.post(f'{BASE}/api/commandes/1/lock/', headers=HA)
    print(f'5a. A lock:    {r.status_code} {r.json()}')
    assert r.status_code == 200

    result = subprocess.run(
        ['docker', 'exec', 'zenith-pharma-redis', 'redis-cli', 'TTL', ':1:doc_lock:commande:1'],
        capture_output=True, text=True
    )
    ttl = int(result.stdout.strip())
    print(f'5b. Redis TTL: {ttl}s (should be <= 30)')
    assert 0 < ttl <= 30, f'TTL should be between 1 and 30, got {ttl}'

    r = requests.post(f'{BASE}/api/commandes/1/unlock/', headers=HA)
    print(f'5c. A unlock:  {r.status_code} {r.json()}')
    print('TEST 5 PASSED\n')


def test_race_condition():
    print('=== TEST 6: Concurrent lock race condition ===')
    results = {}

    def try_lock(user, token):
        h = {'Authorization': f'Token {token}'}
        r = requests.post(f'{BASE}/api/commandes/2/lock/', headers=h)
        results[user] = (r.status_code, r.json())

    t1 = threading.Thread(target=try_lock, args=('A', TOKEN_A))
    t2 = threading.Thread(target=try_lock, args=('B', TOKEN_B))
    t1.start()
    t2.start()
    t1.join()
    t2.join()

    print(f'6a. A result: {results["A"]}')
    print(f'6b. B result: {results["B"]}')

    statuses = {results['A'][0], results['B'][0]}
    assert 200 in statuses and 423 in statuses, f'Expected one 200 and one 423, got {statuses}'
    print('6c. Race condition handled: exactly one winner')

    winner = 'A' if results['A'][0] == 200 else 'B'
    winner_token = TOKEN_A if winner == 'A' else TOKEN_B
    r = requests.post(f'{BASE}/api/commandes/2/unlock/', headers={'Authorization': f'Token {winner_token}'})
    print(f'6d. Cleanup ({winner} unlock): {r.status_code}')
    print('TEST 6 PASSED\n')


def test_websocket():
    print('=== TEST 7: WebSocket lock protocol ===')
    try:
        import websocket
    except ImportError:
        print('7. websocket-client not installed, skipping WebSocket test')
        print('TEST 7 SKIPPED\n')
        return

    ws_url = f'ws://localhost:8000/ws/lock/commande/1/?token={TOKEN_A}'
    ws = websocket.create_connection(ws_url, timeout=5)

    # On connect, should receive initial state
    msg = json.loads(ws.recv())
    print(f'7a. On connect: {msg}')
    assert msg['type'] in ('lock_released', 'lock_denied'), f'Unexpected initial message: {msg}'

    # Acquire lock
    ws.send(json.dumps({'type': 'acquire'}))
    # May receive lock_acquired + broadcast lock_update
    messages = []
    for _ in range(2):
        try:
            msg = json.loads(ws.recv())
            messages.append(msg)
        except Exception:
            break
    acquired_msg = next((m for m in messages if m['type'] == 'lock_acquired'), None)
    print(f'7b. After acquire: {messages}')
    assert acquired_msg is not None, f'Expected lock_acquired in {messages}'
    assert acquired_msg['holder'] == 'loadtest'

    # Heartbeat
    ws.send(json.dumps({'type': 'heartbeat'}))
    time.sleep(0.5)

    # Release lock
    ws.send(json.dumps({'type': 'release'}))
    # Should receive broadcast lock_update with holder=null
    msg = json.loads(ws.recv())
    print(f'7c. After release: {msg}')
    assert msg['type'] == 'lock_update' and msg['holder'] is None

    ws.close()
    print('TEST 7 PASSED\n')


def test_websocket_concurrent():
    print('=== TEST 8: WebSocket - second user sees lock_update ===')
    try:
        import websocket
    except ImportError:
        print('8. websocket-client not installed, skipping')
        print('TEST 8 SKIPPED\n')
        return

    # User A connects and acquires lock
    ws_a = websocket.create_connection(f'ws://localhost:8000/ws/lock/commande/3/?token={TOKEN_A}', timeout=5)
    msg_a = json.loads(ws_a.recv())  # initial state
    print(f'8a. A initial: {msg_a}')

    ws_a.send(json.dumps({'type': 'acquire'}))
    # May receive lock_acquired + broadcast lock_update
    msgs_a = []
    for _ in range(2):
        try:
            msgs_a.append(json.loads(ws_a.recv()))
        except Exception:
            break
    print(f'8b. A acquired: {msgs_a}')
    acquired = next((m for m in msgs_a if m['type'] == 'lock_acquired'), None)
    assert acquired is not None, f'Expected lock_acquired in {msgs_a}'

    # User B connects to same document
    ws_b = websocket.create_connection(f'ws://localhost:8000/ws/lock/commande/3/?token={TOKEN_B}', timeout=5)
    msg_b = json.loads(ws_b.recv())  # should get lock_denied
    print(f'8c. B initial: {msg_b}')
    assert msg_b['type'] == 'lock_denied' and msg_b['holder'] == 'loadtest'

    # User A releases
    ws_a.send(json.dumps({'type': 'release'}))
    # A receives broadcast lock_update with holder=null
    msg_a = json.loads(ws_a.recv())
    print(f'8d. A after release: {msg_a}')

    # User B should also receive the broadcast
    msg_b = json.loads(ws_b.recv())
    print(f'8e. B received broadcast: {msg_b}')
    assert msg_b['type'] == 'lock_update' and msg_b['holder'] is None

    # Now B can acquire
    ws_b.send(json.dumps({'type': 'acquire'}))
    msgs_b = []
    for _ in range(2):
        try:
            msgs_b.append(json.loads(ws_b.recv()))
        except Exception:
            break
    print(f'8f. B acquired: {msgs_b}')
    acquired_b = next((m for m in msgs_b if m['type'] == 'lock_acquired'), None)
    assert acquired_b is not None, f'Expected lock_acquired in {msgs_b}'

    # Cleanup
    ws_b.send(json.dumps({'type': 'release'}))
    ws_a.close()
    ws_b.close()
    print('TEST 8 PASSED\n')


def test_idempotent_unlock():
    print('=== TEST 9: Idempotent unlock (no holder) ===')
    r = requests.post(f'{BASE}/api/commandes/99/unlock/', headers=HA)
    print(f'9a. Unlock no holder: {r.status_code} {r.json()}')
    assert r.status_code == 200
    print('TEST 9 PASSED\n')


if __name__ == '__main__':
    test_ttl()
    test_race_condition()
    test_websocket()
    test_websocket_concurrent()
    test_idempotent_unlock()
    print('=' * 50)
    print('ALL TESTS PASSED')
