"""Project Management checks. Run from backend/:  DATABASE_URL=sqlite:///./mgmt.db python -m tests.test_management"""
import os
os.environ.setdefault("JWT_SECRET", "test-only-secret-" + "x" * 40)  # tests only; never a real secret
assert os.getenv("DATABASE_URL", "").startswith("sqlite"), "Safety stop: this test wipes the database. Run it with a sqlite DATABASE_URL only."
from datetime import date, timedelta
from fastapi.testclient import TestClient
from app.db import Base, SessionLocal, engine
from app.main import app
from app.models import AdminUser
from app.security import hash_password
Base.metadata.drop_all(bind=engine)
A, EMAIL, PW = "/api/admin", "owner@eterambere.rw", "Str0ng!Passw0rd#2026"

def new_client() -> TestClient:  # a brand-new browser session: nothing is remembered except what is in the database
    c = TestClient(app)
    c.headers["Authorization"] = "Bearer " + c.post("/api/auth/login", json={"email": EMAIL, "password": PW}).json()["access_token"]
    return c

today = date.today()
first_last = (today.replace(day=1) - timedelta(days=1)).replace(day=1)          # first day of last month
first_prev = (first_last - timedelta(days=1)).replace(day=1)                     # first day of the month before last
D_NOW, D_LAST, D_PREV, D_OLD = today, first_last, first_prev, today - timedelta(days=100)

with TestClient(app) as boot:
    with SessionLocal() as db:
        db.add(AdminUser(email=EMAIL, password_hash=hash_password(PW))); db.commit()
c = new_client()
P = c.post(f"{A}/projects", json={"name": "Nyabarongo Dam", "project_type": "Dam", "client": "EDCL", "location": "Muhanga", "start_date": "2026-01-01", "end_date": "2027-01-01", "sites": 2, "contract_value": 10_000_000}).json()["id"]

def table(cl=None, **q):
    r = (cl or c).get(f"{A}/projects/{P}/management", params=q); assert r.status_code == 200, r.text
    d = r.json(); return {x["key"]: x for x in d["rows"]}, d
def amounts(**q):
    rows, d = table(**q); return {k: v["amount"] for k, v in rows.items()}, d["total"]
def report(day, helpers, masons, machine, hours, mats, details="", extra=None):
    body = {"project": P, "site": "Site 1", "report_date": day.isoformat(), "activity": "Retaining wall", "start_time": "07:00", "end_time": "17:00", "activities": [{"description": "Retaining wall at CH 14+120"}],
            "equipment": [{"name": machine, "details": details, "hours": hours, "fuel_received": 5, "fuel_used": 3, "fuel_balance": 20}], "materials": mats,
            "workers": [{"role": "Helpers", "headcount": h[0], "daily_wage": h[1]} for h in helpers] + [{"role": "Masons", "headcount": m[0], "daily_wage": m[1]} for m in masons], **(extra or {})}
    r = c.post(f"{A}/reports", json=body); assert r.status_code == 201, r.text
    return r.json()["id"]
EX = "Excavator 320 (RAH993U)"
rA = report(D_NOW, [(22, 3000)], [(4, 7000)], EX, 6, [{"kind": "received", "name": "Sand", "quantity": 10, "unit": "m3"}, {"kind": "used", "name": "Sand", "quantity": 4, "unit": "m3"}, {"kind": "received", "name": "Ciment", "quantity": 100, "unit": "bags"}],
            extra={"costs": [{"category": "material", "description": "must be ignored", "amount": 5000}]})
rB = report(D_LAST, [(20, 3000)], [], "Excavator320 RAH 993U", 4, [{"kind": "received", "name": "Sand", "quantity": 5, "unit": "m3"}, {"kind": "used", "name": "Cement", "quantity": 20, "unit": "bags"}])
rC = report(D_PREV, [(10, 3500)], [], "Camion RAB 497D", 3, [], details="2 trips of sand, 1 trip of stone")
rD = report(D_OLD, [(5, 3000)], [], EX, 2, [])

# ---- admin enters Other Costs and Subcontractors by hand, so they exist before any report is approved
oc = lambda **k: c.post(f"{A}/projects/{P}/costs", json=k)
assert oc(category="Transport", description="Site transport", cost_date=D_NOW.isoformat(), amount=150_000).status_code == 201
b = oc(category="Fuel", description="Diesel", cost_date=D_LAST.isoformat(), quantity=10, unit="litre", rate=5_000); assert b.status_code == 201 and b.json()["amount"] == 50_000, "quantity x rate is calculated"
assert oc(category="Permits", description="Permit fee", cost_date=D_PREV.isoformat(), amount=40_000).status_code == 201
assert oc(category="Fuel", description="x", cost_date=D_NOW.isoformat()).status_code == 422 and oc(category="Fuel", description="Diesel", cost_date=D_NOW.isoformat(), quantity=5, amount=100).status_code == 422
sub = c.post(f"{A}/projects/{P}/subcontractors", json={"name": "Kigali Electrical", "scope": "Wiring", "agreed_amount": 5_000_000, "start_date": "2026-03-01", "end_date": "2026-12-31"}).json()["id"]
assert c.post(f"{A}/projects/{P}/subcontractors", json={"name": "kigali electrical", "scope": "Other", "agreed_amount": 1}).status_code == 409
sc = lambda day, amt: c.post(f"{A}/subcontractors/{sub}/costs", json={"cost_date": day.isoformat(), "description": "Interim valuation", "amount": amt})
assert [sc(D_NOW, 300_000).status_code, sc(D_LAST, 200_000).status_code, sc(D_OLD, 100_000).status_code] == [201, 201, 201]
am, tot = amounts(); assert am == {"equipment": None, "labour": 0, "materials": None, "other": 240_000, "subcontractors": 600_000} and tot == 840_000, (am, tot)
print("1. nothing is approved yet: reports add nothing; manual costs and subcontractor records already count ->", tot)

# ---- approving updates the project records; returning removes them; resubmitting never duplicates
for rid in (rA, rB, rC): assert c.post(f"{A}/reports/{rid}/approve").status_code == 200
assert c.post(f"{A}/reports/{rA}/approve").status_code == 409, "already approved"
rows, d = table(); assert rows["labour"]["quantity"] == 26 + 20 + 10 and rows["labour"]["amount"] == 94_000 + 60_000 + 35_000
c.put(f"{A}/projects/{P}/rates", json={"kind": "equipment", "name": EX, "rate": 50_000})
c.put(f"{A}/projects/{P}/rates", json={"kind": "material", "name": "Sand", "unit": "m3", "rate": 20_000})
c.put(f"{A}/projects/{P}/rates", json={"kind": "material", "name": "Ciment", "unit": "bags", "rate": 10_000})
assert c.put(f"{A}/projects/{P}/rates", json={"kind": "material", "name": "Sand", "rate": 5}).status_code == 422, "a material rate needs its unit"
rows, d = table()
assert rows["equipment"]["quantity"] == 13 and rows["equipment"]["amount"] == 500_000 and "1 of 2 machines" in rows["equipment"]["note"]
assert rows["materials"]["quantity"] == 3 and rows["materials"]["amount"] == 1_300_000 and rows["materials"]["note"] is None
assert d["total"] == 500_000 + 189_000 + 1_300_000 + 240_000 + 600_000 and d["incomplete"] is True
total_before = d["total"]
assert c.post(f"{A}/reports/{rB}/return", json={"note": "x"}).status_code == 422
assert c.post(f"{A}/reports/{rB}/return", json={"note": "Wrong helper count, please check"}).json()["status"] == "Returned"
am, tot = amounts(); assert am["labour"] == 94_000 + 35_000 and am["equipment"] == 300_000 and am["materials"] == 1_200_000 and tot == total_before - 60_000 - 200_000 - 100_000, (am, tot)
assert c.post(f"{A}/reports/{rB}/approve").status_code == 409, "a returned report must be corrected and resubmitted first"
assert c.post(f"{A}/reports/{rB}/resubmit").json()["status"] == "Pending" and amounts()[1] == tot, "pending does not count"
assert c.post(f"{A}/reports/{rB}/resubmit").status_code == 409 and c.post(f"{A}/reports/{rB}/approve").status_code == 200 and amounts()[1] == total_before
n_reports = c.get(f"{A}/reports?project={P}&size=100").json()["total"]
assert c.post(f"{A}/reports/{rD}/return", json={"note": "Missing wages"}).status_code == 200
full = c.get(f"{A}/reports/{rD}").json()
fix = {k: full[k] for k in ("project", "site", "activity", "start_time", "end_time", "challenge")} | {"report_date": full["report_date"], "activities": [{"description": a} for a in full["activities"]],
       "equipment": [{k: e[k] for k in ("name", "details", "hours", "fuel_received", "fuel_used", "fuel_balance")} for e in full["equipment"]], "materials": full["materials"],
       "workers": [{k: w[k] for k in ("role", "headcount", "daily_wage")} for w in full["workers"]]}
up = c.put(f"{A}/reports/{rD}", json=fix); assert up.status_code == 200 and up.json()["status"] == "Pending" and up.json()["id"] == rD
assert c.get(f"{A}/reports?project={P}&size=100").json()["total"] == n_reports, "resubmitting reuses the same report"
assert amounts()[1] == total_before, "pending again, so still not counted"
assert c.post(f"{A}/reports/{rD}/approve").status_code == 200
h = [e["action"] for e in c.get(f"{A}/reports/{rD}/history").json()]; assert h == ["approved", "resubmitted", "returned", "submitted"], h
assert c.post(f"{A}/reports/{rA}/return", json={"note": "Recheck after approval"}).status_code == 200 and c.post(f"{A}/reports/{rA}/resubmit").status_code == 200 and c.post(f"{A}/reports/{rA}/approve").status_code == 200
print("2. approve counts, return removes, resubmit reuses the same record, history is kept")

# ---- labour accumulates, rates are preserved; equipment accumulates per machine; materials stay separate
lab = {g["role"]: g for g in c.get(f"{A}/projects/{P}/management/labour").json()["groups"]}
assert lab["Helpers"]["person_days"] == 22 + 20 + 10 + 5 and lab["Helpers"]["days"] == 4 and [(r["wage"], r["person_days"]) for r in lab["Helpers"]["rates"]] == [(3000, 47), (3500, 10)] and lab["Helpers"]["amount"] == 47 * 3000 + 10 * 3500
assert lab["Masons"]["person_days"] == 4 and lab["Helpers"]["rate"] is None and lab["Masons"]["rate"] == 7000
eq = {g["name"]: g for g in c.get(f"{A}/projects/{P}/management/equipment").json()["groups"]}
assert len(eq) == 2, "the same machine is one entry however it is spaced"; ex = next(g for n, g in eq.items() if "320" in n); cam = next(g for n, g in eq.items() if "RAB" in n)
assert ex["hours"] == 12 and ex["days_used"] == 3 and ex["reports"] == 3 and ex["fuel_received"] == 15 and ex["fuel_used"] == 9 and ex["amount"] == 12 * 50_000 and len(ex["records"]) == 3
assert cam["hours"] == 3 and cam["trips"] == 3 and cam["amount"] is None and cam["rate"] is None
mat = {(g["name"], g["unit"]): g for g in c.get(f"{A}/projects/{P}/management/materials").json()["groups"]}
s = mat[("Sand", "m3")]; assert (s["received"], s["used"], s["balance"], s["amount"]) == (15, 4, 11, 300_000), "received is not consumed"
assert mat[("Cement", "bags")]["received"] == 0 and mat[("Cement", "bags")]["used"] == 20 and mat[("Cement", "bags")]["amount"] is None and mat[("Ciment", "bags")]["amount"] == 1_000_000
print("3. labour, equipment and materials accumulate correctly")

# ---- filters use the real dates; switching filters never changes the stored data
all_before = amounts()
exp = {"this_week": 2_044_000, "this_month": 2_044_000, "last_month": 610_000, "last_2_months": 685_000, "all": 500_000 + 100_000 + 189_000 + 15_000 + 1_300_000 + 240_000 + 600_000}
for k, v in exp.items():
    got = amounts(period=k)[1]; assert got == v, (k, got, v)
assert amounts(period="last_month")[0] == {"equipment": 200_000, "labour": 60_000, "materials": 100_000, "other": 50_000, "subcontractors": 200_000}
assert amounts(period="custom", date_from=D_PREV.isoformat(), date_to=D_LAST.isoformat()) == amounts(period="last_2_months")
assert amounts(period="custom", date_from=D_LAST.isoformat(), date_to=D_LAST.isoformat()) == amounts(period="last_month")
assert c.get(f"{A}/projects/{P}/management", params={"period": "custom", "date_from": D_NOW.isoformat()}).status_code == 422 and c.get(f"{A}/projects/{P}/management", params={"period": "custom", "date_from": D_NOW.isoformat(), "date_to": D_PREV.isoformat()}).status_code == 422
assert amounts(period="this_month")[0]["subcontractors"] == 300_000, "only the dated records in the period count, not the agreed 5,000,000"
sub_in = next(g for g in c.get(f"{A}/projects/{P}/management/subcontractors", params={"period": "last_month"}).json()["groups"]); assert sub_in["spent_in_period"] == 200_000 and sub_in["spent_total"] == 600_000 and sub_in["agreed_amount"] == 5_000_000
assert c.get(f"{A}/projects/{P}/management/other-costs", params={"period": "last_2_months"}).json()["total"] == 90_000
assert amounts() == all_before == (amounts(period="all")), "switching filters changes nothing that is stored"
print("4. every period filter returns the right totals ->", exp)

# ---- the totals agree everywhere
fin = c.get(f"{A}/finance/projects/{P}").json(); dash = c.get(f"{A}/dashboard").json(); proj = c.get(f"{A}/projects/{P}").json()
rows, d = table()
assert fin["spent"] == d["total"] == dash["kpi"]["cost"] == proj["spent"] == c.get(f"{A}/analytics").json()["kpi"]["cost"]
assert {b["category"]: b["amount"] for b in fin["breakdown"]} == {k: (v["amount"] or 0) for k, v in rows.items()} == {x["category"]: x["amount"] for x in dash["cost_by_category"]}
prog = c.get(f"{A}/projects/{P}/progress").json(); assert prog["reports"] == {"Pending": 0, "Approved": 4, "Returned": 0}
print("5. Project Management, Finance, Dashboard, Analytics and the project list all agree ->", d["total"])

# ---- managing Other Costs and Subcontractors
lst = c.get(f"{A}/projects/{P}/costs").json(); assert lst["total"] == 3 and lst["total_amount"] == 240_000 and all(i["description"] != "must be ignored" for i in lst["items"]), "reports never create Other Costs"
cid = lst["items"][0]["id"]
assert c.put(f"{A}/costs/{cid}", json={"category": "Transport", "description": "Site transport (edited)", "cost_date": D_NOW.isoformat(), "amount": 175_000, "notes": "two trips"}).json()["amount"] == 175_000 and amounts()[1] == d["total"] + 25_000
assert c.delete(f"{A}/costs/{cid}").status_code == 204 and c.get(f"{A}/costs/{cid}").status_code in (404, 405) and amounts()[1] == d["total"] - 150_000
assert c.put(f"{A}/subcontractors/{sub}", json={"name": "Kigali Electrical", "scope": "Wiring and lighting", "agreed_amount": 500_000, "status": "Completed", "start_date": "2026-03-01", "end_date": "2026-12-31"}).status_code == 200
g = c.get(f"{A}/projects/{P}/management/subcontractors").json()["groups"][0]; assert g["status"] == "Completed" and g["over_agreed"] is True and g["remaining"] == -100_000
cost_id = g["records"][0]["id"]; assert c.put(f"{A}/subcontractor-costs/{cost_id}", json={"cost_date": D_NOW.isoformat(), "description": "Final valuation", "amount": 350_000}).json()["amount"] == 350_000
assert c.delete(f"{A}/subcontractor-costs/{cost_id}").status_code == 204
assert c.delete(f"{A}/rates/{ex['rate_id']}").status_code == 204 and next(r for r in table()[0].values() if r["key"] == "equipment")["amount"] is None
assert c.delete(f"{A}/subcontractors/{sub}").status_code == 204 and table()[0]["subcontractors"]["amount"] == 0
print("6. Other Costs and Subcontractors can be added, edited and deleted by Admin")

# ---- data persists: a brand-new session reads the same figures from the database
c2 = new_client(); r2, d2 = table(c2); assert d2["total"] == amounts()[1] and c2.get(f"{A}/projects/{P}/management/labour").json()["groups"][0]["person_days"] > 0
anon = TestClient(app); assert anon.get(f"{A}/projects/{P}/management").status_code == 401 and anon.post(f"{A}/reports/{rA}/approve").status_code == 401, "review actions need a sign-in"
print("7. figures survive a fresh session; the new routes need a sign-in")
print("ALL PROJECT MANAGEMENT CHECKS PASSED")
