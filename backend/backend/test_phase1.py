"""
Phase 1 integration test.
Requires the backend running: uvicorn app.main:app --reload --port 8000
"""
import sys
import requests

BASE = "http://localhost:8000/api"

def ok(label, r, expected=200):
    if r.status_code == expected:
        print(f"  PASS  {label} ({r.status_code})")
        return r.json()
    else:
        print(f"  FAIL  {label} -- expected {expected}, got {r.status_code}: {r.text[:200]}")
        return None

def fail(label, r, expected_status):
    if r.status_code == expected_status:
        print(f"  PASS  {label} correctly rejected ({r.status_code})")
    else:
        print(f"  FAIL  {label} -- expected {expected_status}, got {r.status_code}: {r.text[:200]}")

# ── 1. Admin login still works (wrong password must 401) ─────────────────────
print("\n[1] Admin login guard")
r = requests.post(f"{BASE}/auth/login", json={"email": "admin@eterambere.rw", "password": "wrong"})
fail("Admin login with wrong password -> 401", r, 401)

# ── 2. Supervisor login with wrong password ───────────────────────────────────
print("\n[2] Supervisor login - wrong password")
r = requests.post(f"{BASE}/supervisor/login",
                  json={"email": "habitus3@yahoo.fr", "password": "wrongpassword"})
fail("Wrong password -> 401", r, 401)

# ── 3. Supervisor login with unknown email ────────────────────────────────────
print("\n[3] Supervisor login - unknown email")
r = requests.post(f"{BASE}/supervisor/login",
                  json={"email": "nobody@example.com", "password": "somepassword"})
fail("Unknown email -> 401", r, 401)

# ── 4. Get admin token ────────────────────────────────────────────────────────
print("\n[4] Admin token")
admin_token = None
for pw in ["Admin@Eterambere2024!", "Admin@Eterambere2024", "Terambere@2024!", "Admin@2024!"]:
    r = requests.post(f"{BASE}/auth/login", json={"email": "admin@eterambere.rw", "password": pw})
    if r.status_code == 200:
        admin_token = r.json()["access_token"]
        print(f"  INFO  Admin token obtained")
        break
if not admin_token:
    print(f"  SKIP  Cannot obtain admin token (status {r.status_code}) -- enter your admin password below")
    pw = input("  Admin password: ").strip()
    r = requests.post(f"{BASE}/auth/login", json={"email": "admin@eterambere.rw", "password": pw})
    if r.status_code == 200:
        admin_token = r.json()["access_token"]
        print(f"  INFO  Admin token obtained")
    else:
        print(f"  FAIL  Still cannot get admin token: {r.text[:200]}")

if admin_token:
    headers = {"Authorization": f"Bearer {admin_token}"}

    # ── 5. Admin resets supervisor 1 password ─────────────────────────────────
    print("\n[5] Admin reset-password for supervisor 1")
    r = requests.post(f"{BASE}/admin/supervisors/1/reset-password",
                      json={"password": "TestPass@Phase1!"},
                      headers=headers)
    data = ok("Admin reset supervisor password -> 200", r, 200)
    if data:
        print(f"  INFO  {data}")

    # ── 6. Supervisor login with reset password ───────────────────────────────
    print("\n[6] Supervisor login with reset password")
    r = requests.post(f"{BASE}/supervisor/login",
                      json={"email": "habitus3@yahoo.fr", "password": "TestPass@Phase1!"})
    data = ok("Supervisor login -> 200", r, 200)
    if data:
        sup_token = data["access_token"]
        print(f"  INFO  Token for: {data['supervisor']['name']} ({data['supervisor']['code']})")

        # ── 7. GET /me ────────────────────────────────────────────────────────
        print("\n[7] GET /supervisor/me")
        r = requests.get(f"{BASE}/supervisor/me",
                         headers={"Authorization": f"Bearer {sup_token}"})
        me = ok("GET /me -> 200", r, 200)
        if me:
            print(f"  INFO  {me}")

        # ── 8. Admin token must NOT work on supervisor /me ────────────────────
        print("\n[8] Token isolation - admin token on supervisor endpoint")
        r = requests.get(f"{BASE}/supervisor/me",
                         headers={"Authorization": f"Bearer {admin_token}"})
        fail("Admin token on /supervisor/me -> 401", r, 401)

        # ── 9. Supervisor token must NOT work on admin endpoint ───────────────
        print("\n[9] Token isolation - supervisor token on admin endpoint")
        r = requests.get(f"{BASE}/admin/dashboard",
                         headers={"Authorization": f"Bearer {sup_token}"})
        fail("Supervisor token on /admin/dashboard -> 401", r, 401)

        # ── 10. Supervisor change-password ────────────────────────────────────
        print("\n[10] Supervisor change-password")
        r = requests.post(f"{BASE}/supervisor/change-password",
                          json={"current_password": "TestPass@Phase1!",
                                "new_password": "NewPass@Phase1!"},
                          headers={"Authorization": f"Bearer {sup_token}"})
        ok("Change password -> 200", r, 200)

        # Verify new password works
        r = requests.post(f"{BASE}/supervisor/login",
                          json={"email": "habitus3@yahoo.fr", "password": "NewPass@Phase1!"})
        ok("Login with new password -> 200", r, 200)

        # Restore password via admin reset
        print("\n[11] Restore original password via admin reset")
        r = requests.post(f"{BASE}/admin/supervisors/1/reset-password",
                          json={"password": "TestPass@Phase1!"},
                          headers=headers)
        ok("Restore password -> 200", r, 200)

        # Verify restored password works
        r = requests.post(f"{BASE}/supervisor/login",
                          json={"email": "habitus3@yahoo.fr", "password": "TestPass@Phase1!"})
        ok("Login with restored password -> 200", r, 200)

print("\nPhase 1 tests complete.")
