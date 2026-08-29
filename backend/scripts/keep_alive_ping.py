import os
import urllib.request
import ssl
import sys

def ping_insforge():
    insforge_url = os.getenv("INSFORGE_GATEWAY") or os.getenv("NEXT_PUBLIC_SUPABASE_URL") or "https://pa5riyqv.eu-central.insforge.app"
    service_key = os.getenv("SUPABASE_SERVICE_ROLE_KEY") or "ik_4697b4a8df7380fb98a348d2d8c6d163"

    ctx = ssl.create_default_context()
    ctx.check_hostname = False
    ctx.verify_mode = ssl.CERT_NONE

    endpoints = [
        (f"{insforge_url}/health", {}),
        (f"{insforge_url}/rest/v1/", {"apikey": service_key, "Authorization": f"Bearer {service_key}"}),
        (f"{insforge_url}/api/auth/sessions", {"apikey": service_key, "Authorization": f"Bearer {service_key}"})
    ]

    print(f"[Keep-Alive] Pinging InsForge backend: {insforge_url}")
    success_count = 0

    for url, headers in endpoints:
        headers["User-Agent"] = "HotelPlus-KeepAlive/1.0"
        req = urllib.request.Request(url, headers=headers)
        try:
            res = urllib.request.urlopen(req, timeout=5, context=ctx)
            print(f"  [OK] {url} -> HTTP {res.status}")
            success_count += 1
        except urllib.error.HTTPError as e:
            print(f"  [!] {url} -> HTTP {e.code} ({e.reason})")
        except Exception as e:
            print(f"  [X] {url} -> Error: {e}")

    return success_count > 0

if __name__ == "__main__":
    ok = ping_insforge()
    sys.exit(0 if ok else 1)
