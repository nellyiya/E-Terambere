"""One place that decides what counts as a cost. The Dashboard, Finance, Analytics and Project Management all read from here,
so their totals can never disagree.

What counts:
  labour         headcount x wage from APPROVED reports
  equipment      operating hours x the hire rate Admin recorded, from APPROVED reports (no rate recorded = no amount)
  materials      quantity RECEIVED x the unit rate Admin recorded, from APPROVED reports (materials used are tracked but are not a second cost)
  other          costs Admin entered by hand
  subcontractors the dated cost records Admin entered (never the whole agreed amount)
"""
import calendar
import re
from collections import defaultdict
from datetime import date, timedelta
from typing import Literal
from fastapi import HTTPException
from sqlalchemy import select
from sqlalchemy.orm import Session
from .models import CostEntry, ProjectRate, Report, ReportEquipment, ReportMaterial, ReportWorker, Subcontractor, SubcontractorCost
APPROVED = "Approved"
CATEGORIES = ["equipment", "labour", "materials", "other", "subcontractors"]
LABELS = {"equipment": "Equipment", "labour": "Casual Labour", "materials": "Material Costs", "other": "Other Costs", "subcontractors": "Subcontractors"}

def norm(s: str) -> str:  # "Excavator 320 (RAH993U)" and "Excavator320 RAH 993U" are the same machine
    return re.sub(r"[^a-z0-9]", "", s.lower())

def mkey(name: str, unit: str) -> str:
    return f"{norm(name)}|{unit.strip().lower()}"

# ---- time periods (decided here, on the server, from the real calendar)
PeriodKey = Literal["all", "this_week", "this_month", "last_month", "last_2_months", "custom"]

def resolve_period(key: str, d_from: date | None, d_to: date | None, today: date | None = None) -> tuple[date | None, date | None]:
    today = today or date.today()
    if key == "all":
        return None, None
    if key == "this_week":
        start = today - timedelta(days=today.weekday())  # Monday to Sunday
        return start, start + timedelta(days=6)
    if key == "this_month":
        return today.replace(day=1), today.replace(day=calendar.monthrange(today.year, today.month)[1])
    last_end = today.replace(day=1) - timedelta(days=1)
    if key == "last_month":
        return last_end.replace(day=1), last_end
    if key == "last_2_months":  # the two complete calendar months before this one
        return (last_end.replace(day=1) - timedelta(days=1)).replace(day=1), last_end
    if not d_from or not d_to:
        raise HTTPException(422, "Choose both a start date and an end date.")
    if d_from > d_to:
        raise HTTPException(422, "The start date must not be after the end date.")
    return d_from, d_to

def period_args(period: PeriodKey = "all", date_from: date | None = None, date_to: date | None = None) -> dict:
    a, b = resolve_period(period, date_from, date_to)
    return {"key": period, "from": a, "to": b}

# ---- the single source of cost figures
def rate_map(db: Session, pids: list[int] | None) -> dict[tuple[int, str, str], int]:
    q = select(ProjectRate.project_id, ProjectRate.kind, ProjectRate.key, ProjectRate.rate)
    if pids is not None:
        q = q.where(ProjectRate.project_id.in_(pids))
    return {(p, k, key): r for p, k, key, r in db.execute(q).all()}

def cost_events(db: Session, pids: list[int] | None, d_from: date | None = None, d_to: date | None = None, site_id: int | None = None) -> list[tuple[date, int, str, int]]:
    """Every counted cost as (date, project_id, category, amount). Totals by category, project or day are just sums of these."""
    ev: list[tuple[date, int, str, int]] = []
    rc = [Report.status == APPROVED]
    if pids is not None: rc.append(Report.project_id.in_(pids))
    if d_from: rc.append(Report.report_date >= d_from)
    if d_to: rc.append(Report.report_date <= d_to)
    if site_id: rc.append(Report.site_id == site_id)
    for d, pid, hc, wage in db.execute(select(Report.report_date, Report.project_id, ReportWorker.headcount, ReportWorker.daily_wage).join(ReportWorker, ReportWorker.report_id == Report.id).where(*rc)).all():
        ev.append((d, pid, "labour", hc * wage))
    rates = rate_map(db, pids)
    for d, pid, name, hours in db.execute(select(Report.report_date, Report.project_id, ReportEquipment.name, ReportEquipment.hours).join(ReportEquipment, ReportEquipment.report_id == Report.id).where(*rc)).all():
        r = rates.get((pid, "equipment", norm(name)))
        if r is not None: ev.append((d, pid, "equipment", round(float(hours) * r)))
    for d, pid, name, unit, qty in db.execute(select(Report.report_date, Report.project_id, ReportMaterial.name, ReportMaterial.unit, ReportMaterial.quantity).join(ReportMaterial, ReportMaterial.report_id == Report.id)
                                              .where(*rc, ReportMaterial.kind == "received")).all():
        r = rates.get((pid, "material", mkey(name, unit)))
        if r is not None: ev.append((d, pid, "materials", round(float(qty) * r)))
    oc = [CostEntry.report_id.is_(None)]
    if pids is not None: oc.append(CostEntry.project_id.in_(pids))
    if d_from: oc.append(CostEntry.cost_date >= d_from)
    if d_to: oc.append(CostEntry.cost_date <= d_to)
    if site_id: oc.append(CostEntry.site_id == site_id)
    for d, pid, amt in db.execute(select(CostEntry.cost_date, CostEntry.project_id, CostEntry.amount).where(*oc)).all():
        ev.append((d, pid, "other", amt))
    if site_id is None:  # subcontractor costs are not tied to a site
        sc = []
        if pids is not None: sc.append(Subcontractor.project_id.in_(pids))
        if d_from: sc.append(SubcontractorCost.cost_date >= d_from)
        if d_to: sc.append(SubcontractorCost.cost_date <= d_to)
        for d, pid, amt in db.execute(select(SubcontractorCost.cost_date, Subcontractor.project_id, SubcontractorCost.amount).join(Subcontractor, Subcontractor.id == SubcontractorCost.subcontractor_id).where(*sc)).all():
            ev.append((d, pid, "subcontractors", amt))
    return ev

def totals_by_project(events) -> dict[int, dict[str, int]]:
    out: dict[int, dict[str, int]] = defaultdict(lambda: defaultdict(int))
    for _, pid, cat, amt in events:
        out[pid][cat] += amt
    return out
