"""Quick end-to-end check. Run from backend/:  DATABASE_URL=sqlite:///./test.db python -m tests.smoke_test"""
import os
os.environ.setdefault("JWT_SECRET", "test-only-secret-" + "x" * 40)  # tests only; never a real secret
assert os.getenv("DATABASE_URL", "").startswith("sqlite"), "Safety stop: this test wipes the database it runs on. Run it with a sqlite DATABASE_URL only."
from fastapi.testclient import TestClient
from app.main import app
from app import seed

seed.main(reset=True)
with TestClient(app) as c:
    A = "/api/admin"
    from app.db import SessionLocal; from app.models import AdminUser, LoginAttempt; from app.security import hash_password, jwt_secret
    ADMIN_EMAIL, ADMIN_PW = "owner@eterambere.rw", "Str0ng!Passw0rd#2026"
    with SessionLocal() as _db: _db.add(AdminUser(email=ADMIN_EMAIL, password_hash=hash_password(ADMIN_PW))); _db.commit()
    c.headers["Authorization"] = "Bearer " + c.post("/api/auth/login", json={"email": ADMIN_EMAIL, "password": ADMIN_PW}).json()["access_token"]
    _post, AUTO = c.post, [True]
    def _auto(url, **kw):  # most checks below are about totals, and only approved reports count: approve reports the moment they are created
        res = _post(url, **kw)
        if AUTO[0] and url.endswith("/reports") and res.status_code == 201: _post(f"{url}/{res.json()['id']}/approve")
        return res
    c.post = _auto
    d = c.get(f"{A}/dashboard").json(); print("dashboard", d["kpi"])
    assert d["kpi"]["projects"] == 12 and d["reports_per_day"] and sum(x["amount"] for x in d["cost_by_category"]) == d["kpi"]["cost"]
    pl = c.get(f"{A}/projects?size=5").json(); assert pl["total"] == 12 and len(pl["items"]) == 5
    assert c.get(f"{A}/projects?search=bridge").json()["total"] == 1 and c.get(f"{A}/projects?status=Planning").json()["total"] == 2
    new = c.post(f"{A}/projects", json={"name": "Test Dam", "project_type": "Road", "client": "EDCL", "location": "Huye District", "start_date": "2026-01-01", "end_date": "2026-12-31", "status": "Active", "supervisor_id": 1, "sites": 3, "contract_value": 5_000_000}); assert new.status_code == 201, new.text
    code = new.json()["id"]; print("created", code, new.json()["sites"], "sites")
    assert c.post(f"{A}/projects", json={"name": "test dam", "project_type": "Road", "client": "EDCL", "location": "Huye District", "start_date": "2026-01-01", "end_date": "2026-12-31", "sites": 1, "contract_value": 1}).status_code == 409
    assert c.post(f"{A}/projects", json={"name": "ab", "district": "H", "sites": 0, "contract_value": 0}).status_code == 422
    assert c.put(f"{A}/projects/{code}", json={"name": "Test Dam", "project_type": "Road", "client": "EDCL", "location": "Huye District", "start_date": "2026-01-01", "end_date": "2026-12-31", "status": "Active", "sites": 5, "contract_value": 6_000_000}).json()["sites"] == 5
    b = c.post(f"{A}/projects/{code}/boq-items", json={"description": "Concrete", "unit": "m3", "rate": 80000}); assert b.json()["item_no"] == 1
    assert c.delete(f"{A}/projects/{code}").status_code == 204 and c.get(f"{A}/projects/{code}").status_code == 404
    busy = next(p for p in pl["items"] if p["reports"] > 0)
    assert c.delete(f"{A}/projects/{busy['id']}").status_code == 409
    r = c.get(f"{A}/reports?project={busy['id']}&size=3").json(); assert r["total"] == busy["reports"]
    assert c.get(f"{A}/reports?site=Site 1").status_code == 400
    w = c.get(f"{A}/work-done?project={busy['id']}").json(); print("work-done rows", w["total"], "total", w["total_amount"])
    assert w["items"][0]["item_no"] == 1 and all(i["amount"] == round(i["quantity"] * i["rate"]) or abs(i["amount"] - i["quantity"] * i["rate"]) < 2 for i in w["items"])
    f = c.get(f"{A}/finance/projects/{busy['id']}").json(); print("finance", {k: f[k] for k in ("contract_value", "spent", "earned", "profit", "progress", "forecast_profit")})
    assert f["earned"] == w["total_amount"] and f["progress"] == busy["progress"]
    fl = c.get(f"{A}/finance/projects").json(); assert fl["total"] == 12 and fl["items"][0]["profit"] <= fl["items"][-1]["profit"]
    assert c.get(f"{A}/filters").json()["projects"][0]["sites"]
    sl = c.get(f"{A}/supervisors?size=3").json(); assert sl["total"] == 6 and len(sl["items"]) == 3 and "password_hash" not in str(sl)
    ns = c.post(f"{A}/supervisors", json={"name": "Test Person", "email": "test.person@x.rw", "phone": "+250788111222", "password": "secret123"}); assert ns.status_code == 201, ns.text
    sid = ns.json()["id"]; assert ns.json()["active"] and ns.json()["code"].startswith("SUP-")
    assert c.post(f"{A}/supervisors", json={"name": "Other", "email": "TEST.person@x.rw", "phone": "+250788111222", "password": "secret123"}).status_code == 409
    assert c.post(f"{A}/supervisors", json={"name": "No Pass", "email": "np@x.rw", "phone": "+250788111223"}).status_code == 422
    assert c.post(f"{A}/supervisors", json={"name": "Bad", "email": "nope", "phone": "12", "password": "short"}).status_code == 422
    assert c.put(f"{A}/supervisors/{sid}", json={"name": "Test Renamed", "email": "test.person@x.rw", "phone": "+250788111222"}).json()["name"] == "Test Renamed"
    assert c.patch(f"{A}/supervisors/{sid}/active", json={"active": False}).json()["active"] is False
    assert all(x["id"] != sid for x in c.get(f"{A}/filters").json()["supervisors"])
    assert c.put(f"{A}/projects/{busy['id']}", json={"name": busy["name"], "project_type": "Road", "client": "EDCL", "location": "Huye District", "start_date": "2026-01-01", "end_date": "2026-12-31", "status": "Active", "supervisor_id": sid, "sites": busy["sites"], "contract_value": 9_000_000}).status_code == 200
    assert c.delete(f"{A}/supervisors/{sid}").status_code == 409
    d1 = c.get(f"{A}/supervisors/{sid}").json(); assert len(d1["project_list"]) == 1
    busy_sup = next(x for x in sl["items"] if x["reports"] > 0); assert c.delete(f"{A}/supervisors/{busy_sup['id']}").status_code == 409
    c.put(f"{A}/projects/{busy['id']}", json={"name": busy["name"], "project_type": "Road", "client": "EDCL", "location": "Huye District", "start_date": "2026-01-01", "end_date": "2026-12-31", "status": "Active", "supervisor_id": None, "sites": busy["sites"], "contract_value": 9_000_000})
    assert c.delete(f"{A}/supervisors/{sid}").status_code == 204 and c.get(f"{A}/supervisors/{sid}").status_code == 404
    # ---- reports: create / read / edit / status / delete, and that work + costs flow into finance and the dashboard
    code_p = busy["id"]; boq = c.get(f"{A}/projects/{code_p}/boq-items").json(); assert boq
    f0 = c.get(f"{A}/finance/projects/{code_p}").json(); d0 = c.get(f"{A}/dashboard").json()["kpi"]
    payload = {"project": code_p, "site": "Site 1", "supervisor_id": None, "report_date": "2026-11-10", "activity": "Concrete works", "status": "Pending", "notes": "ok",
               "work": [{"boq_item_id": boq[0]["id"], "quantity": 10}]}
    cr = c.post(f"{A}/reports", json=payload); assert cr.status_code == 201, cr.text
    rc = cr.json()["id"]; assert cr.json()["work"][0]["amount"] == 10 * boq[0]["rate"]
    f1 = c.get(f"{A}/finance/projects/{code_p}").json()
    assert f1["spent"] == f0["spent"] and f1["earned"] == f0["earned"] + 10 * boq[0]["rate"]
    assert c.get(f"{A}/dashboard").json()["kpi"]["cost"] == d0["cost"]
    assert c.post(f"{A}/reports", json={**payload, "work": [{"boq_item_id": boq[0]["id"], "quantity": 1}, {"boq_item_id": boq[0]["id"], "quantity": 2}]}).status_code == 422
    assert c.post(f"{A}/reports", json={**payload, "site": "Site 99"}).status_code == 422
    assert c.post(f"{A}/reports", json={**payload, "report_date": "2999-01-01"}).status_code == 422
    other = next(p for p in pl["items"] if p["id"] != code_p); obq = c.get(f"{A}/projects/{other['id']}/boq-items").json()
    assert c.post(f"{A}/reports", json={**payload, "work": [{"boq_item_id": obq[0]["id"], "quantity": 1}]}).status_code == 422
    up = c.put(f"{A}/reports/{rc}", json={**payload, "activity": "Edited"}); assert up.status_code == 200 and up.json()["status"] == "Pending"
    assert c.put(f"{A}/reports/{rc}", json={**payload, "project": other["id"]}).status_code == 400
    assert c.post(f"{A}/reports/{rc}/return", json={"note": "Please check the quantities"}).json()["status"] == "Returned"
    assert c.get(f"{A}/reports?status=Returned&search=Edited").json()["total"] == 1
    assert c.delete(f"{A}/reports/{rc}").status_code == 204 and c.get(f"{A}/reports/{rc}").status_code == 404
    f2 = c.get(f"{A}/finance/projects/{code_p}").json(); assert f2["spent"] == f0["spent"] and f2["earned"] == f0["earned"]
    # ---- paper-form report: times, work done text, equipment + fuel, materials, casual workers, challenge
    f0 = c.get(f"{A}/finance/projects/{code_p}").json(); d0 = c.get(f"{A}/dashboard").json()["kpi"]
    full = {"project": code_p, "site": "Site 1", "report_date": "2026-11-08", "activity": "Retaining wall", "status": "Pending", "start_time": "07:00", "end_time": "17:00", "challenge": "Rain in the afternoon",
            "activities": [{"description": "Retaining wall construction at CH 14+120"}, {"description": "Exit channel excavation at CH8+050"}],
            "equipment": [{"name": "Test Roller TR1", "details": "Loading trucks", "hours": 0, "fuel_received": 0, "fuel_used": 0, "fuel_balance": 24}],
            "materials": [{"kind": "received", "name": "Sand", "quantity": 0, "unit": "m3"}, {"kind": "used", "name": "Ciment", "quantity": 0, "unit": "bags"}],
            "workers": [{"role": "Helpers", "headcount": 22, "daily_wage": 3000}, {"role": "Masons", "headcount": 4, "daily_wage": 7000}, {"role": "Masons", "headcount": 0, "daily_wage": 8000}]}
    fr = c.post(f"{A}/reports", json=full); assert fr.status_code == 201, fr.text
    fd = fr.json(); rc2 = fd["id"]
    assert fd["start_time"] == "07:00" and fd["challenge"] == "Rain in the afternoon" and len(fd["activities"]) == 2 and len(fd["workers"]) == 3 and fd["workers"][0]["amount"] == 66000 and fd["warnings"] == []
    f1 = c.get(f"{A}/finance/projects/{code_p}").json(); assert f1["spent"] == f0["spent"] + 66000 + 28000, "labor = headcount x wage"
    assert next(b for b in f1["breakdown"] if b["category"] == "labour")["amount"] >= 94000
    d1 = c.get(f"{A}/dashboard").json(); assert d1["kpi"]["cost"] == d0["cost"] + 94000 and sum(x["amount"] for x in d1["cost_by_category"]) == d1["kpi"]["cost"]
    w2 = c.post(f"{A}/reports", json={**full, "report_date": "2026-11-09", "equipment": [{"name": "test roller tr1", "fuel_received": 10, "fuel_used": 4, "fuel_balance": 99}], "workers": []})
    assert w2.status_code == 201 and len(w2.json()["warnings"]) == 1, w2.json()["warnings"]
    ok = c.post(f"{A}/reports", json={**full, "report_date": "2026-11-10", "equipment": [{"name": "Test Roller TR1", "fuel_received": 0, "fuel_used": 0, "fuel_balance": 99}], "workers": []}); assert ok.json()["warnings"] == [], ok.json()["warnings"]
    assert c.post(f"{A}/reports", json={**full, "end_time": "06:00"}).status_code == 422 and c.post(f"{A}/reports", json={**full, "start_time": "7h00"}).status_code == 422
    sg = c.get(f"{A}/suggestions").json(); assert "Test Roller TR1" in sg["equipment"] and any(r["role"] == "Masons" for r in sg["roles"])
    for x in (rc2, w2.json()["id"], ok.json()["id"]): assert c.delete(f"{A}/reports/{x}").status_code == 204
    assert c.get(f"{A}/finance/projects/{code_p}").json()["spent"] == f0["spent"]
    # ---- project costs list (Admin enters from invoices; no labor here)
    pc = c.post(f"{A}/projects/{code_p}/costs", json={"category": "Fuel", "description": "Diesel invoice 114", "amount": 250000, "cost_date": "2026-11-05", "site": "Site 1"}); assert pc.status_code == 201, pc.text
    cid = pc.json()["id"]; assert c.get(f"{A}/finance/projects/{code_p}").json()["spent"] == f0["spent"] + 250000
    assert c.post(f"{A}/projects/{code_p}/costs", json={"category": "Fuel", "description": "x", "amount": 0, "cost_date": "2026-11-05"}).status_code == 422
    assert c.put(f"{A}/costs/{cid}", json={"category": "Materials", "description": "Cement invoice 9", "amount": 300000, "cost_date": "2026-11-06"}).json()["category"] == "Materials"
    lc = c.get(f"{A}/projects/{code_p}/costs?category=Materials").json(); assert lc["total_amount"] >= 300000 and any(i["id"] == cid for i in lc["items"])
    assert c.delete(f"{A}/costs/{cid}").status_code == 204 and c.get(f"{A}/finance/projects/{code_p}").json()["spent"] == f0["spent"]
    # ---- bill of quantities items: add / edit / delete, progress shown per item, and the Work Done table
    npj = c.post(f"{A}/projects", json={"name": "BoQ Test Road", "project_type": "Road", "client": "EDCL", "location": "Huye District", "start_date": "2026-01-01", "end_date": "2026-12-31", "status": "Active", "sites": 1, "contract_value": 10_000_000}).json()["id"]
    bi = c.post(f"{A}/projects/{npj}/boq-items", json={"description": "Excavation", "unit": "m3", "rate": 10000, "quantity": 100}); assert bi.status_code == 201 and bi.json()["item_no"] == 1 and bi.json()["quantity"] == 100
    bi2 = c.post(f"{A}/projects/{npj}/boq-items", json={"description": "Concrete", "unit": "m3", "rate": 90000}).json(); assert bi2["item_no"] == 2 and bi2["quantity"] is None
    assert c.post(f"{A}/projects/{npj}/boq-items", json={"description": "x", "unit": "", "rate": 0}).status_code == 422
    rp = c.post(f"{A}/reports", json={"project": npj, "site": "Site 1", "report_date": "2026-11-10", "activity": "Digging", "activities": [{"description": "Digging"}], "work": [{"boq_item_id": bi.json()["id"], "quantity": 25}]}); assert rp.status_code == 201, rp.text
    lb = c.get(f"{A}/projects/{npj}/boq-items").json(); assert lb[0]["quantity_done"] == 25 and lb[0]["amount_done"] == 250000 and lb[0]["reports"] == 1 and lb[1]["quantity_done"] == 0
    assert c.put(f"/api/admin/boq-items/{bi.json()['id']}", json={"description": "Excavation B", "unit": "m3", "rate": 12000, "quantity": 120}).json()["amount_done"] == 300000
    assert c.get(f"{A}/projects/{npj}").json()["progress"] == 3  # 300,000 of 10,000,000
    assert c.delete(f"/api/admin/boq-items/{bi.json()['id']}").status_code == 409
    wd = c.get(f"{A}/work-done?project={npj}").json(); assert wd["total"] == 1 and wd["items"][0]["project_name"] == "BoQ Test Road" and wd["total_amount"] == 300000
    assert c.delete(f"/api/admin/boq-items/{bi2['id']}").status_code == 204
    assert c.delete(f"{A}/reports/{rp.json()['id']}").status_code == 204 and c.delete(f"/api/admin/boq-items/{bi.json()['id']}").status_code == 204 and c.delete(f"{A}/projects/{npj}").status_code == 204
    # ---- analytics follows the filters and agrees with finance and the dashboard
    an = c.get(f"{A}/analytics").json(); dk = c.get(f"{A}/dashboard").json()["kpi"]
    assert an["kpi"]["cost"] == dk["cost"] and an["kpi"]["reports"] == dk["reports"] and sum(x["amount"] for x in an["cost_per_day"]) == an["kpi"]["cost"] and sum(x["count"] for x in an["reports_by_status"]) == dk["reports"]
    assert len(an["top_projects"]) <= 5 and an["top_projects"] == sorted(an["top_projects"], key=lambda x: -x["amount"]) and an["fuel_by_machine"] == sorted(an["fuel_by_machine"], key=lambda x: -x["fuel_used"])
    one = c.get(f"{A}/analytics?project={busy['id']}").json(); fin = c.get(f"{A}/finance/projects/{busy['id']}").json()
    assert one["kpi"]["cost"] == fin["spent"] and one["top_projects"] == []
    assert c.get(f"{A}/analytics?site=Site 1").status_code == 400
    narrow = c.get(f"{A}/analytics?project={busy['id']}&date_from=2999-01-01").json(); assert narrow["kpi"] == {"cost": 0, "reports": 0, "fuel_used": 0} and narrow["cost_per_day"] == []
    # ---- top bar: search and notifications
    sr = c.get(f"{A}/search?q=bridge").json(); assert [p["name"] for p in sr["projects"]] == ["Rubavu Bridge"]
    assert c.get(f"{A}/search?q=a").status_code == 422
    sup0 = c.get(f"{A}/supervisors").json()["items"][0]; assert any(x["id"] == sup0["id"] for x in c.get(f"{A}/search?q={sup0['name'].split()[0]}").json()["supervisors"])
    rr = c.get(f"{A}/search?q=RPT-").json()["reports"]; assert 0 < len(rr) <= 4 and rr[0]["project_id"].startswith("PRJ-")
    assert c.get(f"{A}/search?q=%25%25").json() == {"projects": [], "supervisors": [], "reports": []}, "a typed % must not match everything"
    nf = c.get(f"{A}/notifications").json(); assert nf and all(n["kind"] == "returned" for n in nf) and len(nf) <= 15
    assert any(n["kind"] == "pending" for n in c.get(f"{A}/notifications?pending=true").json()) and c.get(f"{A}/notifications?flagged=false").json() == []
    # ---- settings
    g = c.get(f"{A}/settings").json(); assert g["name"] == "Admin" and g["org"] == "E-terambere" and g["notify_flagged"] is True
    new_s = {"name": "Djafari", "org": "E-terambere Ltd", "notify_flagged": False, "notify_new_report": True, "notify_weekly": False}
    assert c.put(f"{A}/settings", json=new_s).json()["name"] == "Djafari" and c.get(f"{A}/settings").json() == {**new_s, "email": ADMIN_EMAIL}
    assert c.put(f"{A}/settings", json={**new_s, "name": "D"}).status_code == 422
    assert c.get(f"{A}/settings").json() == {**new_s, "email": ADMIN_EMAIL}
    # ---- project details: type, client, consultant, location, calendar dates, duration calculated by the server
    base_p = {"name": "Duration Test", "project_type": "Bridge", "client": "EDCL", "location": "Nyabarongo, Muhanga District", "start_date": "2026-01-01", "end_date": "2026-12-31", "sites": 1, "contract_value": 1_000_000}
    dp = c.post(f"{A}/projects", json=base_p); assert dp.status_code == 201, dp.text
    dj = dp.json(); assert dj["duration_days"] == 364 and dj["consultant"] is None and dj["location"] == "Nyabarongo, Muhanga District" and dj["start_date"] == "2026-01-01" and dj["project_type"] == "Bridge"
    assert c.post(f"{A}/projects", json={**base_p, "name": "Dur B", "end_date": "2026-01-01"}).status_code == 422 and c.post(f"{A}/projects", json={**base_p, "name": "Dur C", "end_date": "2025-01-01"}).status_code == 422
    assert c.post(f"{A}/projects", json={**base_p, "name": "Dur D", "client": ""}).status_code == 422 and c.post(f"{A}/projects", json={**base_p, "name": "Dur E", "start_date": "not a date"}).status_code == 422
    up2 = c.put(f"{A}/projects/{dj['id']}", json={**base_p, "consultant": "Studio Rwanda", "end_date": "2027-01-01"}).json(); assert up2["consultant"] == "Studio Rwanda" and up2["duration_days"] == 365
    assert c.get(f"{A}/projects?search=Nyabarongo, Muhanga").json()["total"] == 1 and c.get(f"{A}/search?q=Muhanga District").json()["projects"]
    assert c.delete(f"{A}/projects/{dj['id']}").status_code == 204
    # ---- physical progress (work done / contract) and financial progress (spent / contract)
    pg = c.get(f"{A}/projects/{busy['id']}").json(); fz = c.get(f"{A}/finance/projects/{busy['id']}").json()
    assert pg["progress"] == fz["progress"] and pg["spent"] == fz["spent"] and pg["financial_progress"] == round(fz["spent"] * 100 / fz["contract_value"])
    assert all("financial_progress" in x for x in c.get(f"{A}/projects?size=100").json()["items"])
    kk = c.get(f"{A}/dashboard").json()["kpi"]; allp = c.get(f"{A}/projects?size=100").json()["items"]
    assert kk["avg_financial_progress"] == round(sum(x["financial_progress"] for x in allp) / len(allp)) and kk["avg_progress"] == round(sum(x["progress"] for x in allp) / len(allp))
    over = c.post(f"{A}/projects", json={**base_p, "name": "Overspend Test", "contract_value": 100_000}).json()["id"]
    c.post(f"{A}/projects/{over}/costs", json={"category": "material", "description": "Big invoice", "amount": 150_000, "cost_date": "2026-11-05"})
    assert c.get(f"{A}/projects/{over}").json()["financial_progress"] == 150 and c.get(f"{A}/projects/{over}").json()["progress"] == 0
    sd = c.get(f"{A}/supervisors/{busy_sup['id']}").json(); assert all("financial_progress" in x and "progress" in x for x in sd["project_list"])
    # ---- sign-in and access control
    import jwt as _jwt; from datetime import datetime, timedelta, timezone; from fastapi.testclient import TestClient as TC
    anon = TC(app)
    assert anon.get("/health").status_code == 200 and anon.get(f"{A}/projects").status_code == 401 and anon.get(f"{A}/dashboard").status_code == 401 and anon.post(f"{A}/reports", json={}).status_code == 401
    assert anon.get(f"{A}/projects", headers={"Authorization": "Bearer nonsense"}).status_code == 401 and anon.get(f"{A}/projects", headers={"Authorization": "Basic abc"}).status_code == 401
    good = c.headers["Authorization"][7:]
    assert anon.get(f"{A}/projects", headers={"Authorization": "Bearer " + good[:-3] + "abc"}).status_code == 401, "tampered token"
    old = _jwt.encode({"sub": "1", "iss": "eterambere-admin", "tv": 0, "exp": datetime.now(timezone.utc) - timedelta(minutes=1)}, jwt_secret(), algorithm="HS256")
    assert anon.get(f"{A}/projects", headers={"Authorization": "Bearer " + old}).status_code == 401, "expired token"
    forged = _jwt.encode({"sub": "1", "iss": "eterambere-admin", "tv": 0, "exp": datetime.now(timezone.utc) + timedelta(hours=1)}, "a-different-secret-" + "y" * 40, algorithm="HS256")
    assert anon.get(f"{A}/projects", headers={"Authorization": "Bearer " + forged}).status_code == 401, "wrong secret"
    wrong = anon.post("/api/auth/login", json={"email": ADMIN_EMAIL, "password": "Wrong!Passw0rd#2026"}); nobody = anon.post("/api/auth/login", json={"email": "nobody@eterambere.rw", "password": "Wrong!Passw0rd#2026"})
    assert wrong.status_code == nobody.status_code == 401 and wrong.json() == nobody.json() == {"detail": "Incorrect email or password."}, "must not reveal which part was wrong"
    assert anon.post("/api/auth/login", json={"email": "not-an-email", "password": "x"}).status_code == 422 and anon.post("/api/auth/login", json={"email": "name@domain", "password": "x"}).status_code == 422
    assert anon.post("/api/auth/login", json={"email": ADMIN_EMAIL.upper(), "password": ADMIN_PW}).status_code == 200, "email is not case sensitive"
    for _ in range(4): assert anon.post("/api/auth/login", json={"email": "victim@eterambere.rw", "password": "Wrong!Passw0rd#2026"}).status_code == 401
    lk = anon.post("/api/auth/login", json={"email": "victim@eterambere.rw", "password": "Wrong!Passw0rd#2026"}); assert lk.status_code == 401
    lk = anon.post("/api/auth/login", json={"email": "victim@eterambere.rw", "password": "Wrong!Passw0rd#2026"}); assert lk.status_code == 429 and "Try again in" in lk.json()["detail"]
    for _ in range(5): anon.post("/api/auth/login", json={"email": ADMIN_EMAIL, "password": "Wrong!Passw0rd#2026"})
    assert anon.post("/api/auth/login", json={"email": ADMIN_EMAIL, "password": ADMIN_PW}).status_code == 429, "locked even with the right password"
    with SessionLocal() as _db: _db.query(LoginAttempt).delete(); _db.commit()
    assert anon.post("/api/auth/login", json={"email": ADMIN_EMAIL, "password": ADMIN_PW}).status_code == 200
    assert c.get("/api/auth/me").json() == {"email": ADMIN_EMAIL} and c.post("/api/auth/refresh").json()["access_token"]
    cp = lambda cur, new: c.post("/api/auth/change-password", json={"current_password": cur, "new_password": new})
    assert cp("nope", "An0ther!Str0ngOne#1").status_code == 400
    for weak in ("short1!A", "alllowercase!!aa11", "ALLUPPERCASE!!AA11", "NoNumbersHere!!!x", "NoSymbols1234Abcdx", "Passw0rd!Passw0rd!", "Owner!Aaaa1234xyz", ADMIN_PW):
        assert cp(ADMIN_PW, weak).status_code == 422, weak
    ok2 = cp(ADMIN_PW, "An0ther!Str0ngOne#1"); assert ok2.status_code == 200
    assert anon.get(f"{A}/projects", headers={"Authorization": "Bearer " + good}).status_code == 401, "old sessions end when the password changes"
    assert anon.get(f"{A}/projects", headers={"Authorization": "Bearer " + ok2.json()["access_token"]}).status_code == 200
    assert anon.post("/api/auth/login", json={"email": ADMIN_EMAIL, "password": ADMIN_PW}).status_code == 401 and anon.post("/api/auth/login", json={"email": ADMIN_EMAIL, "password": "An0ther!Str0ngOne#1"}).status_code == 200
    with SessionLocal() as _db: u = _db.query(AdminUser).first(); assert u.password_hash.startswith("$argon2") and "An0ther" not in u.password_hash
    c.headers["Authorization"] = "Bearer " + anon.post("/api/auth/login", json={"email": ADMIN_EMAIL, "password": "An0ther!Str0ngOne#1"}).json()["access_token"]  # the password was changed above
    # ---- dashboard cards: totals for projects, reports, supervisors and reports awaiting review
    kd = c.get(f"{A}/dashboard").json()["kpi"]; sl2 = c.get(f"{A}/supervisors?size=100").json()["items"]
    assert kd["supervisors"] == len(sl2) and kd["active_supervisors"] == sum(x["active"] for x in sl2)
    assert kd["projects"] == c.get(f"{A}/projects?size=1").json()["total"] and kd["reports"] == c.get(f"{A}/reports?size=1").json()["total"] and kd["pending"] == c.get(f"{A}/reports?status=Pending&size=1").json()["total"]
    print("ALL CHECKS PASSED")
