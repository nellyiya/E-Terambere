"""Project Management: the five-category table, the detail behind each category, review actions on daily reports,
manually managed Subcontractors, the rates Admin records, and the progress timeline.
Everything report-based counts APPROVED reports only. Nothing here changes what a supervisor submitted."""
import re
from collections import defaultdict
from datetime import date, timedelta
from typing import Literal
from fastapi import APIRouter, Depends, HTTPException
from pydantic import BaseModel, Field, field_validator, model_validator
from sqlalchemy import func, select
from sqlalchemy.orm import Session
from .admin import fin_progress, find_project, find_report, log_event, time_progress
from .auth import admin_only
from .costing import APPROVED, LABELS, cost_events, mkey, norm, period_args
from .db import get_db
from .models import AdminUser, BoqItem, CostEntry, Project, ProjectRate, Report, ReportEquipment, ReportEvent, ReportMaterial, ReportWork, ReportWorker, Site, Subcontractor, SubcontractorCost
from .security import now
router = APIRouter(prefix="/api/admin", dependencies=[Depends(admin_only)])

def fmt(x: float) -> str:
    return f"{x:,.2f}".rstrip("0").rstrip(".")

def rep_cond(pid: int, a: date | None, b: date | None) -> list:
    c = [Report.project_id == pid, Report.status == APPROVED]
    if a: c.append(Report.report_date >= a)
    if b: c.append(Report.report_date <= b)
    return c

def in_period(d: date, a: date | None, b: date | None) -> bool:
    return (a is None or d >= a) and (b is None or d <= b)

# ---------------------------------------------------------------- the five categories
def equipment_groups(db: Session, pid: int, a, b) -> list[dict]:
    rates = {r.key: r for r in db.scalars(select(ProjectRate).where(ProjectRate.project_id == pid, ProjectRate.kind == "equipment"))}
    rows = db.execute(select(Report.report_date, Report.id, Report.code, Site.name, ReportEquipment.name, ReportEquipment.details, ReportEquipment.hours, ReportEquipment.fuel_received, ReportEquipment.fuel_used, ReportEquipment.fuel_balance)
                      .join(Report, Report.id == ReportEquipment.report_id).join(Site, Site.id == Report.site_id).where(*rep_cond(pid, a, b)).order_by(Report.report_date, Report.id, ReportEquipment.id)).all()
    g: dict[str, dict] = {}
    for d, rid, code, site, name, details, hours, fr, fu, fb in rows:  # same machine = same name and registration, however it is spaced or capitalised
        k = norm(name); rate = rates.get(k)
        x = g.setdefault(k, dict(name=name, dates=set(), reports=set(), hours=0.0, trips=0, fr=0.0, fu=0.0, fb=0.0, records=[]))
        trips = sum(int(t) for t in re.findall(r"(\d+)\s*trips?", details or "", re.I))
        x.update(name=name, fb=float(fb)); x["dates"].add(d); x["reports"].add(rid)
        x["hours"] += float(hours); x["trips"] += trips; x["fr"] += float(fr); x["fu"] += float(fu)
        x["records"].append(dict(date=d, report=code, site=site, hours=float(hours), trips=trips, fuel_received=float(fr), fuel_used=float(fu), fuel_balance=float(fb), details=details,
                                 amount=round(float(hours) * rate.rate) if rate else None))
    out = []
    for k, x in sorted(g.items(), key=lambda kv: kv[1]["name"].lower()):
        rate = rates.get(k); amount = sum(r["amount"] for r in x["records"]) if rate else None
        out.append(dict(key=k, name=x["name"], days_used=len(x["dates"]), reports=len(x["reports"]), hours=round(x["hours"], 2), trips=x["trips"], fuel_received=round(x["fr"], 2), fuel_used=round(x["fu"], 2), fuel_balance=x["fb"],
                        rate=rate.rate if rate else None, rate_id=rate.id if rate else None, amount=amount,
                        calc=f"{fmt(x['hours'])} hours × {rate.rate:,} RWF per hour = {amount:,} RWF" if rate else "No hire rate has been recorded for this machine, so no amount is calculated. Hours, trips and fuel are still tracked.",
                        records=x["records"]))
    return out

def labour_groups(db: Session, pid: int, a, b) -> list[dict]:
    rows = db.execute(select(Report.report_date, Report.code, Site.name, ReportWorker.role, ReportWorker.headcount, ReportWorker.daily_wage)
                      .join(Report, Report.id == ReportWorker.report_id).join(Site, Site.id == Report.site_id).where(*rep_cond(pid, a, b)).order_by(Report.report_date, Report.id, ReportWorker.id)).all()
    g: dict[str, dict] = {}
    for d, code, site, role, hc, wage in rows:
        x = g.setdefault(role.strip().lower(), dict(role=role.strip(), dates=set(), pd=0, amount=0, by_rate=defaultdict(lambda: [0, 0]), records=[]))
        x["dates"].add(d); x["pd"] += hc; x["amount"] += hc * wage; x["by_rate"][wage][0] += hc; x["by_rate"][wage][1] += hc * wage
        x["records"].append(dict(date=d, report=code, site=site, headcount=hc, wage=wage, amount=hc * wage))
    out = []
    for k, x in sorted(g.items()):
        if x["pd"] == 0:
            continue  # a role listed with nobody working that period
        rates = [dict(wage=w, person_days=v[0], amount=v[1]) for w, v in sorted(x["by_rate"].items()) if v[0]]
        out.append(dict(key=k, role=x["role"], days=len(x["dates"]), person_days=x["pd"], amount=x["amount"], rate=rates[0]["wage"] if len(rates) == 1 else None, rates=rates,
                        calc=" + ".join(f"{r['person_days']:,} person-days × {r['wage']:,}" for r in rates) + f" = {x['amount']:,} RWF", records=[r for r in x["records"] if r["headcount"]]))
    return out

def material_groups(db: Session, pid: int, a, b) -> list[dict]:
    rates = {r.key: r for r in db.scalars(select(ProjectRate).where(ProjectRate.project_id == pid, ProjectRate.kind == "material"))}
    rows = db.execute(select(Report.report_date, Report.code, Site.name, ReportMaterial.kind, ReportMaterial.name, ReportMaterial.unit, ReportMaterial.quantity)
                      .join(Report, Report.id == ReportMaterial.report_id).join(Site, Site.id == Report.site_id).where(*rep_cond(pid, a, b)).order_by(Report.report_date, Report.id, ReportMaterial.id)).all()
    g: dict[str, dict] = {}
    for d, code, site, kind, name, unit, qty in rows:
        k = mkey(name, unit); rate = rates.get(k)
        x = g.setdefault(k, dict(name=name.strip(), unit=unit.strip(), received=0.0, used=0.0, records=[]))
        x["received" if kind == "received" else "used"] += float(qty)
        x["records"].append(dict(date=d, report=code, site=site, kind=kind, quantity=float(qty), amount=round(float(qty) * rate.rate) if rate and kind == "received" else None))
    out = []
    for k, x in sorted(g.items(), key=lambda kv: kv[1]["name"].lower()):
        rate = rates.get(k); amount = sum(r["amount"] for r in x["records"] if r["amount"] is not None) if rate else None
        out.append(dict(key=k, name=x["name"], unit=x["unit"], received=round(x["received"], 2), used=round(x["used"], 2), balance=round(x["received"] - x["used"], 2), rate=rate.rate if rate else None, rate_id=rate.id if rate else None,
                        amount=amount, calc=(f"{fmt(x['received'])} {x['unit']} received × {rate.rate:,} RWF per {x['unit']} = {amount:,} RWF. Materials used ({fmt(x['used'])} {x['unit']}) are tracked separately and are not added again." if rate
                                             else "No unit rate has been recorded for this material, so no amount is calculated. Quantities received and used are still tracked."), records=x["records"]))
    return out

def other_costs(db: Session, pid: int, a, b) -> dict:
    cond = [CostEntry.project_id == pid, CostEntry.report_id.is_(None)]
    if a: cond.append(CostEntry.cost_date >= a)
    if b: cond.append(CostEntry.cost_date <= b)
    rows = db.execute(select(CostEntry, Site.name).outerjoin(Site, Site.id == CostEntry.site_id).where(*cond).order_by(CostEntry.cost_date.desc(), CostEntry.id.desc())).all()
    cats: dict[str, list[int]] = defaultdict(lambda: [0, 0])
    for c, _ in rows:
        cats[c.category][0] += 1; cats[c.category][1] += c.amount
    return dict(records=[dict(id=c.id, date=c.cost_date, category=c.category, description=c.description, quantity=float(c.quantity) if c.quantity is not None else None, unit=c.unit, rate=c.rate, amount=c.amount, notes=c.notes, site=sn) for c, sn in rows],
                groups=[dict(category=k, count=v[0], amount=v[1]) for k, v in sorted(cats.items())], total=sum(c.amount for c, _ in rows))

def sub_row(c: SubcontractorCost) -> dict:
    return dict(id=c.id, date=c.cost_date, description=c.description, quantity=float(c.quantity) if c.quantity is not None else None, unit=c.unit, rate=c.rate, amount=c.amount, notes=c.notes)

def subcontractor_groups(db: Session, pid: int, a, b) -> list[dict]:
    out = []
    for s in db.scalars(select(Subcontractor).where(Subcontractor.project_id == pid).order_by(Subcontractor.name)):
        inside = [c for c in s.costs if in_period(c.cost_date, a, b)]
        spent_in, spent_all = sum(c.amount for c in inside), sum(c.amount for c in s.costs)
        out.append(dict(id=s.id, name=s.name, scope=s.scope, agreed_amount=s.agreed_amount, start_date=s.start_date, end_date=s.end_date, status=s.status, notes=s.notes,
                        spent_in_period=spent_in, spent_total=spent_all, remaining=s.agreed_amount - spent_all, over_agreed=spent_all > s.agreed_amount, records=[sub_row(c) for c in reversed(inside)],
                        calc=f"{len(inside)} cost record{'s' if len(inside) != 1 else ''} in this period = {spent_in:,} RWF. The agreed amount ({s.agreed_amount:,} RWF) is not counted as spent."))
    return out

# ---------------------------------------------------------------- the management table
def build_table(db: Session, pid: int, a, b) -> dict:
    eq, lab, mat, oth, subs = equipment_groups(db, pid, a, b), labour_groups(db, pid, a, b), material_groups(db, pid, a, b), other_costs(db, pid, a, b), subcontractor_groups(db, pid, a, b)
    def one_rate(items):
        r = {i["rate"] for i in items if i["rate"] is not None}
        return (next(iter(r)) if len(r) == 1 and all(i["rate"] is not None for i in items) else None), len(r) > 1
    eq_priced = [g for g in eq if g["rate"] is not None]; mat_recv = [g for g in mat if g["received"] > 0]; mat_priced = [g for g in mat_recv if g["rate"] is not None]
    eq_rate, eq_var = one_rate(eq); lab_rate, lab_var = one_rate(lab)
    sub_active = [s for s in subs if s["records"]]
    rows = [
        dict(item_no=1, key="equipment", description=LABELS["equipment"], unit="hours", quantity=round(sum(g["hours"] for g in eq), 2), rate=eq_rate, rate_varies=eq_var, amount=sum(g["amount"] for g in eq_priced) if eq_priced else None,
             note=f"{len(eq) - len(eq_priced)} of {len(eq)} machines have no hire rate yet, so their cost is not included." if len(eq) > len(eq_priced) else None),
        dict(item_no=2, key="labour", description=LABELS["labour"], unit="person-days", quantity=sum(g["person_days"] for g in lab), rate=lab_rate, rate_varies=lab_var, amount=sum(g["amount"] for g in lab), note=None),
        dict(item_no=3, key="materials", description=LABELS["materials"], unit="materials", quantity=len(mat), rate=None, rate_varies=False, amount=sum(g["amount"] for g in mat_priced) if mat_priced else None,
             note=f"{len(mat_recv) - len(mat_priced)} of {len(mat_recv)} received materials have no unit rate yet, so their cost is not included." if len(mat_recv) > len(mat_priced) else None),
        dict(item_no=4, key="other", description=LABELS["other"], unit="records", quantity=len(oth["records"]), rate=None, rate_varies=False, amount=oth["total"], note=None),
        dict(item_no=5, key="subcontractors", description=LABELS["subcontractors"], unit="subcontractors", quantity=len(sub_active), rate=None, rate_varies=False, amount=sum(s["spent_in_period"] for s in subs), note=None)]
    return {"rows": rows, "total": sum(r["amount"] for r in rows if r["amount"] is not None), "incomplete": any(r["note"] for r in rows)}

def period_out(period: dict) -> dict:
    return {"key": period["key"], "from": period["from"], "to": period["to"]}

@router.get("/projects/{code}/management")
def management_table(code: str, period: dict = Depends(period_args), db: Session = Depends(get_db)):
    p = find_project(db, code)
    return {"period": period_out(period), **build_table(db, p.id, period["from"], period["to"])}

@router.get("/projects/{code}/management/{section}")
def management_section(code: str, section: Literal["equipment", "labour", "materials", "other-costs", "subcontractors"], period: dict = Depends(period_args), db: Session = Depends(get_db)):
    p = find_project(db, code); a, b = period["from"], period["to"]
    if section == "other-costs":
        return {"period": period_out(period), **other_costs(db, p.id, a, b)}
    fn = {"equipment": equipment_groups, "labour": labour_groups, "materials": material_groups, "subcontractors": subcontractor_groups}[section]
    return {"period": period_out(period), "groups": fn(db, p.id, a, b)}

# ---------------------------------------------------------------- rates (machines per hour, materials per unit)
class RateIn(BaseModel):
    kind: Literal["equipment", "material"]
    name: str = Field(min_length=2, max_length=160)
    unit: str | None = Field(default=None, max_length=20)
    rate: int = Field(gt=0, le=10**10)
    @model_validator(mode="after")
    def need_unit(self):
        if self.kind == "material" and not (self.unit or "").strip():
            raise ValueError("a material rate needs its unit")
        return self

@router.put("/projects/{code}/rates")
def set_rate(code: str, body: RateIn, db: Session = Depends(get_db)):
    p = find_project(db, code)
    key = norm(body.name) if body.kind == "equipment" else mkey(body.name, body.unit or "")
    row = db.scalar(select(ProjectRate).where(ProjectRate.project_id == p.id, ProjectRate.kind == body.kind, ProjectRate.key == key))
    if not row:
        row = ProjectRate(project_id=p.id, kind=body.kind, key=key); db.add(row)
    row.label, row.unit, row.rate = body.name.strip(), (body.unit or "hour").strip() if body.kind == "material" else "hour", body.rate
    db.commit()
    return dict(id=row.id, kind=row.kind, label=row.label, unit=row.unit, rate=row.rate)

@router.delete("/rates/{rid}", status_code=204)
def remove_rate(rid: int, db: Session = Depends(get_db)):
    row = db.get(ProjectRate, rid)
    if not row:
        raise HTTPException(404, "Rate not found.")
    db.delete(row); db.commit()

# ---------------------------------------------------------------- subcontractors (added and managed by Admin only)
class SubIn(BaseModel):
    name: str = Field(min_length=2, max_length=160)
    scope: str = Field(min_length=2, max_length=300)
    agreed_amount: int = Field(gt=0, le=10**11)
    start_date: date | None = None
    end_date: date | None = None
    status: Literal["Planned", "Active", "Completed", "Terminated"] = "Active"
    notes: str | None = Field(default=None, max_length=1000)
    @field_validator("name", "scope")
    @classmethod
    def strip_text(cls, v: str):
        v = v.strip()
        if len(v) < 2:
            raise ValueError("is too short")
        return v
    @model_validator(mode="after")
    def check_dates(self):
        if self.start_date and self.end_date and self.end_date < self.start_date:
            raise ValueError("the end date must not be before the start date")
        return self

class SubCostIn(BaseModel):
    cost_date: date
    description: str = Field(min_length=2, max_length=200)
    quantity: float | None = Field(default=None, gt=0, le=10**9)
    unit: str | None = Field(default=None, max_length=20)
    rate: int | None = Field(default=None, gt=0, le=10**10)
    amount: int | None = Field(default=None, gt=0, le=10**11)
    notes: str | None = Field(default=None, max_length=1000)
    @field_validator("description")
    @classmethod
    def strip_text(cls, v: str):
        v = v.strip()
        if len(v) < 2:
            raise ValueError("is too short")
        return v
    @model_validator(mode="after")
    def check_amounts(self):
        if (self.quantity is None) != (self.rate is None):
            raise ValueError("enter both a quantity and a rate, or neither")
        if self.quantity is not None and not (self.unit or "").strip():
            raise ValueError("enter the unit for the quantity")
        if self.quantity is None and self.amount is None:
            raise ValueError("enter an amount, or a quantity and a rate")
        return self
    def total(self) -> int:
        return round(self.quantity * self.rate) if self.quantity is not None else int(self.amount)

def find_sub(db: Session, sid: int) -> Subcontractor:
    s = db.get(Subcontractor, sid)
    if not s:
        raise HTTPException(404, "Subcontractor not found.")
    return s

def sub_dup(db: Session, pid: int, name: str, except_id: int | None = None):
    q = select(Subcontractor.id).where(Subcontractor.project_id == pid, func.lower(Subcontractor.name) == name.strip().lower())
    if except_id: q = q.where(Subcontractor.id != except_id)
    if db.scalar(q):
        raise HTTPException(409, "This project already has a subcontractor with that name.")

@router.post("/projects/{code}/subcontractors", status_code=201)
def add_sub(code: str, body: SubIn, db: Session = Depends(get_db)):
    p = find_project(db, code); sub_dup(db, p.id, body.name)
    s = Subcontractor(project_id=p.id, name=body.name, scope=body.scope, agreed_amount=body.agreed_amount, start_date=body.start_date, end_date=body.end_date, status=body.status, notes=(body.notes or "").strip() or None)
    db.add(s); db.commit()
    return {"id": s.id}

@router.put("/subcontractors/{sid}")
def edit_sub(sid: int, body: SubIn, db: Session = Depends(get_db)):
    s = find_sub(db, sid); sub_dup(db, s.project_id, body.name, sid)
    s.name, s.scope, s.agreed_amount, s.start_date, s.end_date, s.status, s.notes = body.name, body.scope, body.agreed_amount, body.start_date, body.end_date, body.status, (body.notes or "").strip() or None
    db.commit()
    return {"id": s.id}

@router.delete("/subcontractors/{sid}", status_code=204)
def delete_sub(sid: int, db: Session = Depends(get_db)):
    db.delete(find_sub(db, sid)); db.commit()  # its cost records go with it

def check_date(d: date):
    if d > date.today() + timedelta(days=1):
        raise HTTPException(422, "cost_date: a cost can't be dated in the future.")

def apply_sub_cost(c: SubcontractorCost, b: SubCostIn):
    c.cost_date, c.description, c.quantity, c.unit, c.rate, c.amount, c.notes = b.cost_date, b.description.strip(), b.quantity, (b.unit or "").strip() or None, b.rate, b.total(), (b.notes or "").strip() or None

@router.post("/subcontractors/{sid}/costs", status_code=201)
def add_sub_cost(sid: int, body: SubCostIn, db: Session = Depends(get_db)):
    s = find_sub(db, sid); check_date(body.cost_date)
    c = SubcontractorCost(subcontractor_id=s.id); apply_sub_cost(c, body); db.add(c); db.commit()
    return sub_row(c)

def find_sub_cost(db: Session, cid: int) -> SubcontractorCost:
    c = db.get(SubcontractorCost, cid)
    if not c:
        raise HTTPException(404, "Cost record not found.")
    return c

@router.put("/subcontractor-costs/{cid}")
def edit_sub_cost(cid: int, body: SubCostIn, db: Session = Depends(get_db)):
    c = find_sub_cost(db, cid); check_date(body.cost_date); apply_sub_cost(c, body); db.commit()
    return sub_row(c)

@router.delete("/subcontractor-costs/{cid}", status_code=204)
def delete_sub_cost(cid: int, db: Session = Depends(get_db)):
    db.delete(find_sub_cost(db, cid)); db.commit()

# ---------------------------------------------------------------- reviewing daily reports
class ReturnIn(BaseModel):
    note: str = Field(min_length=3, max_length=500)

def history_out(db: Session, r: Report) -> list[dict]:
    return [dict(action=e.action, note=e.note, by=e.by, at=e.at) for e in db.scalars(select(ReportEvent).where(ReportEvent.report_id == r.id).order_by(ReportEvent.id.desc()))]

@router.post("/reports/{code}/approve")
def approve_report(code: str, db: Session = Depends(get_db), admin: AdminUser = Depends(admin_only)):
    r = find_report(db, code)
    if r.status == "Approved":
        raise HTTPException(409, "This report is already approved.")
    if r.status == "Returned":
        raise HTTPException(409, "This report was returned for correction. It must be corrected and resubmitted before it can be approved.")
    r.status, r.return_note, r.reviewed_at, r.reviewed_by = "Approved", None, now(), admin.email
    log_event(db, r, "approved", admin.email); db.commit()
    return {"id": r.code, "status": r.status}

@router.post("/reports/{code}/return")
def return_report(code: str, body: ReturnIn, db: Session = Depends(get_db), admin: AdminUser = Depends(admin_only)):
    r = find_report(db, code)
    if r.status == "Returned":
        raise HTTPException(409, "This report has already been returned for correction.")
    r.status, r.return_note, r.reviewed_at, r.reviewed_by = "Returned", body.note.strip(), now(), admin.email
    log_event(db, r, "returned", admin.email, r.return_note); db.commit()
    return {"id": r.code, "status": r.status}

@router.post("/reports/{code}/resubmit")
def resubmit_report(code: str, db: Session = Depends(get_db), admin: AdminUser = Depends(admin_only)):
    r = find_report(db, code)
    if r.status != "Returned":
        raise HTTPException(409, "Only a returned report can be resubmitted.")
    r.status, r.return_note, r.reviewed_at, r.reviewed_by = "Pending", None, None, None
    log_event(db, r, "resubmitted", admin.email); db.commit()
    return {"id": r.code, "status": r.status}

@router.get("/reports/{code}/history")
def report_history(code: str, db: Session = Depends(get_db)):
    return history_out(db, find_report(db, code))

# ---------------------------------------------------------------- progress over time
@router.get("/projects/{code}/progress")
def project_progress(code: str, db: Session = Depends(get_db)):
    p = find_project(db, code)
    # physical progress timeline
    rows = db.execute(select(Report.report_date, func.sum(ReportWork.quantity * BoqItem.rate), func.count(func.distinct(Report.id)))
                      .join(ReportWork, ReportWork.report_id == Report.id).join(BoqItem, BoqItem.id == ReportWork.boq_item_id)
                      .where(Report.project_id == p.id, Report.status == APPROVED).group_by(Report.report_date).order_by(Report.report_date)).all()
    cum, timeline = 0.0, []
    for d, v, n in rows:
        cum += float(v)
        timeline.append(dict(date=d, work_value=int(round(float(v))), cumulative=int(round(cum)), progress=min(100, round(cum * 100 / p.contract_value)) if p.contract_value else 0, reports=n))
    by_status = {k: v for k, v in db.execute(select(Report.status, func.count()).where(Report.project_id == p.id).group_by(Report.status)).all()}
    # financial progress: use cost_events — the single source of truth used by dashboard and analytics
    events = cost_events(db, [p.id])
    total_costs = sum(amt for _, _, _, amt in events)
    fin_pct = fin_progress(p.contract_value, total_costs)  # same function as the project header, list and dashboard
    # time progress
    today = date.today()
    if p.start_date and p.end_date and p.end_date > p.start_date:
        total_days = (p.end_date - p.start_date).days
        elapsed = max(0, (min(today, p.end_date) - p.start_date).days)
        remaining = max(0, (p.end_date - today).days)
        time_pct = time_progress(p)  # same function as the project header, list and dashboard
    else:
        total_days = elapsed = remaining = time_pct = None
    return {
        "contract_value": p.contract_value,
        "timeline": timeline,
        "reports": {k: by_status.get(k, 0) for k in ("Pending", "Approved", "Returned")},
        "financial": {"total_costs": total_costs, "budget": p.contract_value, "remaining": p.contract_value - total_costs, "pct": fin_pct},
        "time": {"start_date": p.start_date, "end_date": p.end_date, "total_days": total_days, "elapsed": elapsed, "remaining": remaining, "pct": time_pct},
    }