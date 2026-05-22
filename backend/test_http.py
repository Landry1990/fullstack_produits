import requests

url = "http://127.0.0.1:80/api/factures/mobile/"
print("Testing POST to:", url)

try:
    # We don't even need valid auth or payload, just want to see the response status and Server header!
    response = requests.post(url, json={})
    print("Status Code:", response.status_code)
    print("Headers:", dict(response.headers))
    print("Content:", response.text[:500])
except Exception as e:
    print("Error:", e)
