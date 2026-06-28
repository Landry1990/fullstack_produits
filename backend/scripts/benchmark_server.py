
import requests
import threading
import time
import random
import sys

# Configuration
BASE_URL = "http://127.0.0.1:8000"
AUTH_URL = f"{BASE_URL}/api-token-auth/"
SEARCH_URL = f"{BASE_URL}/api/produits/"
NUM_THREADS = 10
DURATION_SECONDS = 30
USERNAME = "benchmark_user"
PASSWORD = "password123"

def get_auth_token():
    try:
        response = requests.post(AUTH_URL, json={'username': USERNAME, 'password': PASSWORD})
        response.raise_for_status()
        return response.json()['token']
    except Exception as e:
        print(f"Authentication failed: {e}")
        print(response.text)
        sys.exit(1)

def user_scenario(token, results, errors):
    headers = {'Authorization': f'Token {token}'}
    start_time = time.time()
    
    # Common search terms based on pharmacy context
    search_terms = ['doli', 'paracetamol', 'augmentin', 'vitamine', 'sirop', 'comrpime', '250', '500', '1000']
    
    while time.time() - start_time < DURATION_SECONDS:
        try:
            # Action 1: Search for products (Heavy read)
            term = random.choice(search_terms)
            resp = requests.get(SEARCH_URL, params={'search': term}, headers=headers, timeout=5)
            record_request(resp, results)
            
            # Action 2: Get a random page of products
            page = random.randint(1, 5)
            resp = requests.get(SEARCH_URL, params={'page': page}, headers=headers, timeout=5)
            # 404 is acceptable if page doesn't exist, but we record it
            record_request(resp, results)
            
        except Exception as e:
            errors.append(str(e))

def record_request(response, results):
    results['total_requests'] += 1
    if response.status_code < 400:
        results['success_requests'] += 1
        results['total_time'] += response.elapsed.total_seconds()
    else:
        results['failed_requests'] += 1

def main():
    print(f"Starting server benchmark with {NUM_THREADS} concurrent users for {DURATION_SECONDS} seconds...")
    print(f"Target: {BASE_URL}")
    
    # Authenticate
    print("Authenticating...")
    token = get_auth_token()
    print("Authentication successful.")
    
    threads = []
    # Shared results container (not thread-safe strictly, but for approx stats it's fine or use a Lock)
    # Using a simple lock for correctness
    results = {'total_requests': 0, 'success_requests': 0, 'failed_requests': 0, 'total_time': 0}
    errors = []
    lock = threading.Lock()
    
    # Wrapper for thread safety
    def thread_wrapper():
        local_results = {'total_requests': 0, 'success_requests': 0, 'failed_requests': 0, 'total_time': 0}
        user_scenario(token, local_results, errors)
        with lock:
            results['total_requests'] += local_results['total_requests']
            results['success_requests'] += local_results['success_requests']
            results['failed_requests'] += local_results['failed_requests']
            results['total_time'] += local_results['total_time']

    # Start threads
    for _ in range(NUM_THREADS):
        t = threading.Thread(target=thread_wrapper)
        t.start()
        threads.append(t)
        
    # Wait for completion
    for t in threads:
        t.join()
        
    # Calculate stats
    total_reqs = results['total_requests']
    avg_response_time = (results['total_time'] / results['success_requests']) * 1000 if results['success_requests'] > 0 else 0
    rps = total_reqs / DURATION_SECONDS
    
    print("\n" + "="*40)
    print("BENCHMARK RESULTS")
    print("="*40)
    print(f"Concurrent Users: {NUM_THREADS}")
    print(f"Duration:         {DURATION_SECONDS} s")
    print(f"Total Requests:   {total_reqs}")
    print(f"Successful:       {results['success_requests']}")
    print(f"Failed:           {results['failed_requests']}")
    print(f"Errors:           {len(errors)} (First: {errors[0] if errors else 'None'})")
    print("-" * 40)
    print(f"RPS (Requests/sec): {rps:.2f}")
    print(f"Avg Response Time:  {avg_response_time:.2f} ms")
    print("-" * 40)
    
    # Projections
    day_capacity_10h = rps * 3600 * 10
    print(f"Estimated Daily Capacity (10h active): ~{int(day_capacity_10h):,} requests")
    print("="*40)

if __name__ == "__main__":
    main()
