import re
import uuid
from collections import defaultdict
from datetime import date, timedelta
from typing import Literal
from fastapi import APIRouter, Depends, HTTPException, Query, Request, UploadFile, File, Form
from pydantic import BaseModel, Field, field_validator, model_validator
from sqlalchemy import delete, func, or_, select
from sqlalchemy.orm import Session, joinedload
from .auth import admin_only
from .db import get_db
from .costing import APPROVED, CATEGORIES, cost_events, period_args, totals_by_project
from .security import hash_password, now, password_problems, verify_password
from .models import AdminSettings, AdminUser, BoqItem, CostEntry, Project, ProjectSupervisor, Report, ReportActivity, ReportEquipment, ReportEvent, ReportMaterial, ReportPhoto, ReportWork, ReportWorker, Site, Supervisor

router = APIRouter(prefix="/api/admin", dependencies=[Depends(admin_only)])
Status = Literal["Planning", "Active", "On Hold", "Completed"]
ALL_CATEGORIES = CATEGORIES  # equipment, labour, materials, other, subcontractors (see costing.py)

class ProjectIn(BaseModel):
    name: str
    project_type: str
    client: str
    consultant: str | None = None
    location: str
    start_date: date
    end_date: date  # expected completion
    status: Status = "Planning"
    supervisor_ids: list[int] = []
    sites: int = Field(ge=1, le=50)
    contract_value: int = Field(gt=0, le=10**12)
    @field_validator("name", "project_type", "client", "location")
    @classmethod
    def clean(cls, v: str, info):
        v = v.strip()
        if len(v) < (3 if info.field_name == "name" else 2):
            raise ValueError("is too short")
        if len(v) > {"name": 120, "project_type": 80, "client": 160, "location": 200}[info.field_name]:
            raise ValueError("is too long")
        return v
    @field_validator("consultant")
    @classmethod
    def clean_consultant(cls, v):
        v = (v or "").strip()
        if v and not 2 <= len(v) <= 160:
            raise ValueError("must be 2 to 160 characters, or empty")
        return v or None
    @model_validator(mode="after")
    def check_dates(self):
        if self.end_date <= self.start_date:
            raise ValueError("the expected completion date must be after the start date")
        return self

class BoqIn(BaseModel):
    description: str = Field(min_length=2, max_length=200)
    unit: str = Field(min_length=1, max_length=20)
    rate: int = Field(gt=0, le=10**10)
    quantity: float | None = Field(default=None, ge=0, le=10**9)  # contract quantity, optional

# ---------- helpers
def time_progress(p: 'Project') -> int:
    """Physical progress: days elapsed as a share of total planned days. Pure date calculation, no reports needed."""
    if not p.start_date or not p.end_date or p.end_date <= p.start_date:
        return 0
    total = (p.end_date - p.start_date).days
    elapsed = max(0, (min(date.today(), p.end_date) - p.start_date).days)
    return min(100, round(elapsed * 100 / total))

def fin_progress(contract: int, spent: int) -> int:
    """Financial progress: recorded costs as a share of the contract value, in percent.
    Not capped: 120 means the project has spent 20% more than the contract value, and that must stay visible."""
    return round(spent * 100 / contract) if contract else 0

def stats(db: Session, ids: list[int]) -> dict[int, dict]:
    if not ids:
        return {}
    def q(stmt):
        return {r[0]: r[1] for r in db.execute(stmt).all()}
    earned = q(select(BoqItem.project_id, func.sum(ReportWork.quantity * BoqItem.rate)).join(ReportWork, ReportWork.boq_item_id == BoqItem.id).join(Report, Report.id == ReportWork.report_id)
               .where(BoqItem.project_id.in_(ids), Report.status == APPROVED).group_by(BoqItem.project_id))
    reports = q(select(Report.project_id, func.count()).where(Report.project_id.in_(ids)).group_by(Report.project_id))
    approved = q(select(Report.project_id, func.count()).where(Report.project_id.in_(ids), Report.status == APPROVED).group_by(Report.project_id))
    sites = q(select(Site.project_id, func.count()).where(Site.project_id.in_(ids)).group_by(Site.project_id))
    parts = totals_by_project(cost_events(db, ids))
    return {i: dict(earned=int(round(earned.get(i) or 0)), spent=sum(parts[i].values()) if i in parts else 0, parts=dict(parts[i]) if i in parts else {}, reports=reports.get(i, 0), approved=approved.get(i, 0), sites=sites.get(i, 0)) for i in ids}

def project_out(p: Project, s: dict) -> dict:
    return dict(id=p.code, name=p.name, project_type=p.project_type, client=p.client, consultant=p.consultant, location=p.location or p.district, start_date=p.start_date, end_date=p.end_date,
                duration_days=(p.end_date - p.start_date).days if p.start_date and p.end_date else None, status=p.status, contract_value=p.contract_value, progress=time_progress(p), financial_progress=fin_progress(p.contract_value, s["spent"]), spent=s["spent"],
                sites=s["sites"], reports=s["reports"], supervisor=({"id": p.supervisor.id, "name": p.supervisor.name} if p.supervisor else None),
                supervisors=[{"id": sv.id, "name": sv.name} for sv in p.supervisors])

def next_project_code(db: Session) -> str:
    count = db.scalar(select(func.count()).select_from(Project)) or 0
    return f"PRJ-{count:03d}"

def find_project(db: Session, code: str) -> Project:
    p = db.scalar(select(Project).options(joinedload(Project.supervisor)).where(Project.code == code))
    if not p:
        raise HTTPException(404, "Project not found.")
    return p

def check_supervisors(db: Session, ids: list[int]):
    for sid in ids:
        if not db.get(Supervisor, sid):
            raise HTTPException(422, f"Supervisor {sid} does not exist.")

def sync_supervisors(db: Session, p: Project, ids: list[int]):
    db.execute(delete(ProjectSupervisor).where(ProjectSupervisor.project_id == p.id))
    for sid in ids:
        db.add(ProjectSupervisor(project_id=p.id, supervisor_id=sid))
    p.supervisor_id = ids[0] if ids else None

def scope(db: Session, project: str | None, site: str | None):
    pid = sid = None
    if project:
        pid = find_project(db, project).id
        if site:
            s = db.scalar(select(Site).where(Site.project_id == pid, Site.name == site))
            if not s:
                raise HTTPException(404, "Site not found in this project.")
            sid = s.id
    elif site:
        raise HTTPException(400, "Choose a project before choosing a site.")
    return pid, sid

def report_filters(pid, sid, d_from: date | None, d_to: date | None):
    c = []
    if pid: c.append(Report.project_id == pid)
    if sid: c.append(Report.site_id == sid)
    if d_from: c.append(Report.report_date >= d_from)
    if d_to: c.append(Report.report_date <= d_to)
    return c

def page_args(page: int = Query(1, ge=1), size: int = Query(12, ge=1, le=100)):
    return page, size

# ---------- filters / options
@router.get("/filters")
def filters(db: Session = Depends(get_db)):
    projects = db.scalars(select(Project).options(joinedload(Project.sites)).order_by(Project.code)).unique().all()
    return {"projects": [{"id": p.code, "name": p.name, "sites": [s.name for s in p.sites]} for p in projects],
            "supervisors": [{"id": s.id, "name": s.name} for s in db.scalars(select(Supervisor).where(Supervisor.active).order_by(Supervisor.name))]}

# ---------- projects
@router.get("/projects")
def list_projects(search: str = "", status: Status | None = None, pa=Depends(page_args), db: Session = Depends(get_db)):
    page, size = pa
    cond = []
    if search.strip():
        like = f"%{search.strip()}%"
        cond.append(or_(Project.name.ilike(like), Project.code.ilike(like), Project.district.ilike(like), Project.location.ilike(like), Project.client.ilike(like)))
    if status: cond.append(Project.status == status)
    total = db.scalar(select(func.count()).select_from(Project).where(*cond)) or 0
    rows = db.scalars(select(Project).options(joinedload(Project.supervisor)).where(*cond).order_by(Project.id).offset((page - 1) * size).limit(size)).all()
    st = stats(db, [p.id for p in rows])
    return {"items": [project_out(p, st[p.id]) for p in rows], "total": total, "page": page, "size": size}

@router.post("/projects", status_code=201)
def create_project(body: ProjectIn, db: Session = Depends(get_db)):
    check_supervisors(db, body.supervisor_ids)
    if db.scalar(select(Project.id).where(func.lower(Project.name) == body.name.lower())):
        raise HTTPException(409, "A project with this name already exists.")
    p = Project(code="TMP-" + uuid.uuid4().hex[:10], name=body.name, district=body.location[:60], status=body.status, contract_value=body.contract_value,
                supervisor_id=body.supervisor_ids[0] if body.supervisor_ids else None,
                project_type=body.project_type, client=body.client, consultant=body.consultant, location=body.location, start_date=body.start_date, end_date=body.end_date)
    p.sites = [Site(name=f"Site {i}") for i in range(1, body.sites + 1)]
    db.add(p); db.flush()
    p.code = next_project_code(db)
    db.flush()
    sync_supervisors(db, p, body.supervisor_ids)
    db.commit()
    return project_out(find_project(db, p.code), stats(db, [p.id])[p.id])

@router.get("/projects/{code}")
def get_project(code: str, db: Session = Depends(get_db)):
    p = find_project(db, code)
    return project_out(p, stats(db, [p.id])[p.id])

@router.put("/projects/{code}")
def update_project(code: str, body: ProjectIn, db: Session = Depends(get_db)):
    p = find_project(db, code)
    check_supervisors(db, body.supervisor_ids)
    if db.scalar(select(Project.id).where(func.lower(Project.name) == body.name.lower(), Project.id != p.id)):
        raise HTTPException(409, "A project with this name already exists.")
    num = lambda s: int(s.name.split()[-1])
    used = {r for r in db.scalars(select(Report.site_id).where(Report.project_id == p.id).distinct())}
    max_used = max([num(s) for s in p.sites if s.id in used], default=0)
    if body.sites < max_used:
        raise HTTPException(409, f"Reports already exist for Site {max_used}. Keep at least {max_used} sites.")
    have = max([num(s) for s in p.sites], default=0)
    for i in range(have + 1, body.sites + 1):
        p.sites.append(Site(name=f"Site {i}"))
    for s in [s for s in p.sites if num(s) > body.sites]:
        p.sites.remove(s)
    p.name, p.district, p.status, p.contract_value = body.name, body.location[:60], body.status, body.contract_value
    p.project_type, p.client, p.consultant, p.location, p.start_date, p.end_date = body.project_type, body.client, body.consultant, body.location, body.start_date, body.end_date
    sync_supervisors(db, p, body.supervisor_ids)
    db.commit()
    db.expire_all()
    return project_out(find_project(db, code), stats(db, [p.id])[p.id])

@router.delete("/projects/{code}", status_code=204)
def delete_project(code: str, db: Session = Depends(get_db)):
    p = find_project(db, code)
    n = db.scalar(select(func.count()).select_from(Report).where(Report.project_id == p.id)) or 0
    if n:
        raise HTTPException(409, f"This project has {n} reports, so it can't be deleted. Set its status to Completed or On Hold instead.")
    db.delete(p); db.commit()

@router.get("/projects/{code}/sites")
def project_sites(code: str, db: Session = Depends(get_db)):
    p = find_project(db, code)
    agg = {r[0]: (r[1], r[2]) for r in db.execute(select(Report.site_id, func.count(), func.max(Report.report_date)).where(Report.project_id == p.id).group_by(Report.site_id)).all()}
    return [{"name": s.name, "reports": agg.get(s.id, (0, None))[0], "last_report": agg.get(s.id, (0, None))[1]} for s in p.sites]

def boq_out(b: BoqItem, done: float = 0, reports: int = 0) -> dict:
    return dict(id=b.id, item_no=b.item_no, description=b.description, unit=b.unit, rate=b.rate, quantity=float(b.quantity) if b.quantity is not None else None,
                quantity_done=done, amount_done=int(round(done * b.rate)), reports=reports)

def find_boq(db: Session, bid: int) -> BoqItem:
    b = db.get(BoqItem, bid)
    if not b:
        raise HTTPException(404, "Item not found.")
    return b

@router.get("/projects/{code}/boq-items")
def list_boq(code: str, db: Session = Depends(get_db)):
    p = find_project(db, code)
    agg = {r[0]: (float(r[1]), r[2]) for r in db.execute(select(ReportWork.boq_item_id, func.sum(ReportWork.quantity), func.count()).join(BoqItem, BoqItem.id == ReportWork.boq_item_id)
                                                        .join(Report, Report.id == ReportWork.report_id).where(BoqItem.project_id == p.id, Report.status == APPROVED).group_by(ReportWork.boq_item_id)).all()}
    return [boq_out(b, *agg.get(b.id, (0, 0))) for b in p.boq_items]

@router.post("/projects/{code}/boq-items", status_code=201)
def add_boq(code: str, body: BoqIn, db: Session = Depends(get_db)):
    p = find_project(db, code)
    nxt = (db.scalar(select(func.max(BoqItem.item_no)).where(BoqItem.project_id == p.id)) or 0) + 1
    b = BoqItem(project_id=p.id, item_no=nxt, description=body.description.strip(), unit=body.unit.strip(), rate=body.rate, quantity=body.quantity)
    db.add(b); db.commit()
    return boq_out(b)

@router.put("/boq-items/{bid}")
def update_boq(bid: int, body: BoqIn, db: Session = Depends(get_db)):
    b = find_boq(db, bid)
    b.description, b.unit, b.rate, b.quantity = body.description.strip(), body.unit.strip(), body.rate, body.quantity
    db.commit()
    row = db.execute(select(func.coalesce(func.sum(ReportWork.quantity), 0), func.count()).join(Report, Report.id == ReportWork.report_id).where(ReportWork.boq_item_id == bid, Report.status == APPROVED)).one()
    return boq_out(b, float(row[0]), row[1])

@router.delete("/boq-items/{bid}", status_code=204)
def delete_boq(bid: int, db: Session = Depends(get_db)):
    b = find_boq(db, bid)
    n = db.scalar(select(func.count()).select_from(ReportWork).where(ReportWork.boq_item_id == bid)) or 0
    if n:
        raise HTTPException(409, f"This item is used in {n} report lines, so it can't be deleted. Remove it from those reports first.")
    db.delete(b); db.commit()

# ---------- supervisors
class SupervisorIn(BaseModel):
    name: str
    email: str = Field(pattern=r"^[^@\s]+@[^@\s]+\.[^@\s]+$", max_length=160)
    phone: str = Field(pattern=r"^\+?\d{9,15}$")
    password: str | None = Field(default=None, min_length=8, max_length=128)
    @field_validator("name")
    @classmethod
    def clean_name(cls, v: str):
        v = v.strip()
        if len(v) < 3:
            raise ValueError("is too short")
        return v

def sup_stats(db: Session, ids: list[int]) -> dict[int, dict]:
    if not ids:
        return {}
    pr = {r[0]: r[1] for r in db.execute(select(Project.supervisor_id, func.count()).where(Project.supervisor_id.in_(ids)).group_by(Project.supervisor_id)).all()}
    rp = {r[0]: (r[1], r[2]) for r in db.execute(select(Report.supervisor_id, func.count(), func.max(Report.report_date)).where(Report.supervisor_id.in_(ids)).group_by(Report.supervisor_id)).all()}
    return {i: dict(projects=pr.get(i, 0), reports=rp.get(i, (0, None))[0], last_report=rp.get(i, (0, None))[1]) for i in ids}

def sup_out(s: Supervisor, st: dict) -> dict:
    return dict(id=s.id, code=s.code, name=s.name, email=s.email, phone=s.phone, active=s.active, **st)

def find_supervisor(db: Session, sid: int) -> Supervisor:
    s = db.get(Supervisor, sid)
    if not s:
        raise HTTPException(404, "Supervisor not found.")
    return s

def email_taken(db: Session, email: str, except_id: int | None = None) -> bool:
    q = select(Supervisor.id).where(func.lower(Supervisor.email) == email.strip().lower())
    if except_id:
        q = q.where(Supervisor.id != except_id)
    return db.scalar(q) is not None

@router.get("/supervisors")
def list_supervisors(search: str = "", pa=Depends(page_args), db: Session = Depends(get_db)):
    page, size = pa
    cond = []
    if search.strip():
        like = f"%{search.strip()}%"
        cond.append(or_(Supervisor.name.ilike(like), Supervisor.email.ilike(like), Supervisor.phone.ilike(like)))
    total = db.scalar(select(func.count()).select_from(Supervisor).where(*cond)) or 0
    rows = db.scalars(select(Supervisor).where(*cond).order_by(Supervisor.name).offset((page - 1) * size).limit(size)).all()
    st = sup_stats(db, [s.id for s in rows])
    return {"items": [sup_out(s, st[s.id]) for s in rows], "total": total, "page": page, "size": size}

@router.post("/supervisors", status_code=201)
def create_supervisor(body: SupervisorIn, db: Session = Depends(get_db)):
    if not body.password:
        raise HTTPException(422, "password: a temporary password of at least 8 characters is required.")
    if email_taken(db, body.email):
        raise HTTPException(409, "A supervisor with this email already exists.")
    s = Supervisor(name=body.name, email=body.email.strip(), phone=body.phone, active=True, password_hash=hash_password(body.password))
    db.add(s); db.flush()
    count = db.scalar(select(func.count()).select_from(Supervisor)) or 0
    s.code = f"SUP-{count:03d}"
    db.commit()
    return sup_out(s, sup_stats(db, [s.id])[s.id])

@router.get("/supervisors/{sid}")
def get_supervisor(sid: int, db: Session = Depends(get_db)):
    s = find_supervisor(db, sid)
    projects = db.scalars(select(Project).where(Project.supervisor_id == sid).order_by(Project.code)).all()
    pst = stats(db, [p.id for p in projects])
    reports = db.execute(select(Report, Project.name, Site.name).join(Project, Project.id == Report.project_id).join(Site, Site.id == Report.site_id)
                         .where(Report.supervisor_id == sid).order_by(Report.report_date.desc(), Report.id.desc()).limit(200)).all()
    return {**sup_out(s, sup_stats(db, [sid])[sid]),
            "project_list": [dict(id=p.code, name=p.name, district=p.district, status=p.status, progress=time_progress(p), financial_progress=fin_progress(p.contract_value, pst[p.id]["spent"]), supervisors=[{"id": sv.id, "name": sv.name} for sv in p.supervisors]) for p in projects],
            "report_list": [dict(id=r.code, date=r.report_date, project_name=pn, site=sn, activity=r.activity, status=r.status) for r, pn, sn in reports]}

@router.put("/supervisors/{sid}")
def update_supervisor(sid: int, body: SupervisorIn, db: Session = Depends(get_db)):
    s = find_supervisor(db, sid)
    if email_taken(db, body.email, sid):
        raise HTTPException(409, "A supervisor with this email already exists.")
    s.name, s.email, s.phone = body.name, body.email.strip(), body.phone
    if body.password:  # optional: only changes the password when one is typed
        s.password_hash = hash_password(body.password)
    db.commit()
    return sup_out(s, sup_stats(db, [sid])[sid])

class ActiveIn(BaseModel):
    active: bool

@router.patch("/supervisors/{sid}/active")
def set_supervisor_active(sid: int, body: ActiveIn, db: Session = Depends(get_db)):
    s = find_supervisor(db, sid)
    s.active = body.active
    db.commit()
    return sup_out(s, sup_stats(db, [sid])[sid])

@router.delete("/supervisors/{sid}", status_code=204)
def delete_supervisor(sid: int, db: Session = Depends(get_db)):
    s = find_supervisor(db, sid)
    st = sup_stats(db, [sid])[sid]
    if st["projects"] or st["reports"]:
        raise HTTPException(409, f"This supervisor has {st['projects']} projects and {st['reports']} reports, so the account can't be deleted. Deactivate it instead.")
    db.delete(s); db.commit()

class ResetPasswordIn(BaseModel):
    password: str = Field(min_length=8, max_length=128)

@router.post("/supervisors/{sid}/reset-password")
def reset_supervisor_password(sid: int, body: ResetPasswordIn, db: Session = Depends(get_db)):
    s = find_supervisor(db, sid)
    problems = password_problems(body.password, s.email)
    if problems:
        raise HTTPException(422, "The password needs: " + "; ".join(problems) + ".")
    s.password_hash = hash_password(body.password)
    db.commit()
    return {"detail": f"Password reset for {s.name}."}

# ---------- reports
@router.get("/reports")
def list_reports(project: str | None = None, site: str | None = None, date_from: date | None = None, date_to: date | None = None, status: Literal["Pending", "Approved", "Returned"] | None = None, search: str = "", sort: Literal["asc", "desc"] = "desc", pa=Depends(page_args), db: Session = Depends(get_db)):
    page, size = pa
    order = (
        (Report.report_date.asc(), Report.id.asc())
        if sort == "asc"
        else (Report.report_date.desc(), Report.id.desc())
    )
    pid, sid = scope(db, project, site)
    cond = report_filters(pid, sid, date_from, date_to)
    if status: cond.append(Report.status == status)
    if search.strip():
        like = f"%{search.strip()}%"
        cond.append(or_(Report.code.ilike(like), Report.activity.ilike(like)))
    total = db.scalar(select(func.count()).select_from(Report).where(*cond)) or 0
    rows = db.execute(select(Report, Project.code, Project.name, Site.name, Supervisor.name).join(Project, Project.id == Report.project_id).join(Site, Site.id == Report.site_id)
                      .outerjoin(Supervisor, Supervisor.id == Report.supervisor_id).where(*cond).order_by(*order).offset((page - 1) * size).limit(size)).all()
    return {"items": [dict(id=r.code, date=r.report_date, project_id=pc, project_name=pn, site=sn, supervisor=sup, activity=r.activity, status=r.status, return_note=r.return_note) for r, pc, pn, sn, sup in rows], "total": total, "page": page, "size": size}

class WorkLine(BaseModel):
    boq_item_id: int
    quantity: float = Field(gt=0, le=10**9)

class CostLine(BaseModel):
    category: Literal["material", "equipment", "fuel", "subcontractor", "expenses", "other"]
    description: str = Field(min_length=2, max_length=200)
    amount: int = Field(gt=0, le=10**11)

class ActivityLine(BaseModel):
    description: str = Field(min_length=2, max_length=500)
    quantity: float = Field(default=0, ge=0, le=10**9)
    location: str | None = Field(default=None, max_length=200)

class EquipmentLine(BaseModel):
    kind: Literal["Machine", "Truck", "Tool"] = "Machine"
    name: str = Field(min_length=2, max_length=120)
    details: str | None = Field(default=None, max_length=200)
    hours: float = Field(default=0, ge=0, le=24)
    trips_sand: int = Field(default=0, ge=0, le=100000)
    trips_stones: int = Field(default=0, ge=0, le=100000)
    fuel_received: float = Field(default=0, ge=0, le=100000)
    fuel_used: float = Field(default=0, ge=0, le=100000)
    fuel_balance: float = Field(default=0, ge=0, le=100000)

class MaterialLine(BaseModel):
    kind: Literal["received", "used"]
    name: str = Field(min_length=2, max_length=100)
    quantity: float = Field(ge=0, le=10**9)
    unit: str = Field(min_length=1, max_length=20)

class WorkerLine(BaseModel):
    role: str = Field(min_length=2, max_length=100)
    headcount: int = Field(ge=0, le=10000)
    daily_wage: int = Field(ge=0, le=10**7)

class ReportIn(BaseModel):
    project: str
    site: str
    supervisor_id: int | None = None
    report_date: date
    activity: str = Field(min_length=2, max_length=120)
    status: Literal["Pending", "Approved", "Returned", "Flagged"] = "Pending"  # accepted for compatibility but ignored: the review workflow sets the status
    notes: str | None = Field(default=None, max_length=2000)
    work: list[WorkLine] = []
    costs: list[CostLine] = []
    start_time: str | None = None
    end_time: str | None = None
    challenge: str | None = Field(default=None, max_length=3000)
    activities: list[ActivityLine] = []
    equipment: list[EquipmentLine] = []
    materials: list[MaterialLine] = []
    workers: list[WorkerLine] = []
    @field_validator("start_time", "end_time")
    @classmethod
    def check_time(cls, v):
        if v and not re.fullmatch(r"([01]\d|2[0-3]):[0-5]\d", v):
            raise ValueError("use the format HH:MM, for example 07:00")
        return v or None
    @model_validator(mode="after")
    def check_order(self):
        if self.start_time and self.end_time and self.end_time <= self.start_time:
            raise ValueError("end_time must be after start_time")
        return self

def prepare_report(db: Session, body: ReportIn):
    p = find_project(db, body.project)
    site = db.scalar(select(Site).where(Site.project_id == p.id, Site.name == body.site))
    if not site:
        raise HTTPException(422, "site: this project has no such site.")
    if body.supervisor_id is not None and not db.get(Supervisor, body.supervisor_id):
        raise HTTPException(422, "That supervisor does not exist.")
    if body.report_date > date.today() + timedelta(days=1):
        raise HTTPException(422, "report_date: a report can't be dated in the future.")
    ids = [w.boq_item_id for w in body.work]
    if len(set(ids)) != len(ids):
        raise HTTPException(422, "work: each bill of quantities item can be used only once per report.")
    if set(ids) - set(db.scalars(select(BoqItem.id).where(BoqItem.project_id == p.id, BoqItem.id.in_(ids)))):
        raise HTTPException(422, "work: an item does not belong to this project.")
    return p, site

def save_lines(db: Session, rep: Report, p: Project, site: Site, body: ReportIn):
    db.execute(delete(ReportWork).where(ReportWork.report_id == rep.id))
    db.execute(delete(CostEntry).where(CostEntry.report_id == rep.id))
    for tbl in (ReportActivity, ReportEquipment, ReportMaterial, ReportWorker):
        db.execute(delete(tbl).where(tbl.report_id == rep.id))
    for a in body.activities:
        db.add(ReportActivity(
            report_id=rep.id,
            description=a.description.strip(),
            quantity=a.quantity,
            location=(a.location or "").strip() or None,
        ))
    for e in body.equipment:
        previous_balance = db.execute(
            select(ReportEquipment.fuel_balance)
            .join(Report, Report.id == ReportEquipment.report_id)
            .where(
                Report.project_id == p.id,
                func.lower(ReportEquipment.name) == e.name.strip().lower(),
                Report.id != rep.id,
                or_(
                    Report.report_date < rep.report_date,
                    (Report.report_date == rep.report_date) & (Report.id < rep.id),
                ),
            )
            .order_by(Report.report_date.desc(), Report.id.desc())
            .limit(1)
        ).scalar()

        opening_balance = float(previous_balance or 0)
        calculated_balance = opening_balance + e.fuel_received - e.fuel_used

        db.add(ReportEquipment(
            report_id=rep.id,
            kind=e.kind,
            name=e.name.strip(),
            details=(e.details or "").strip() or None,
            hours=e.hours,
            trips_sand=e.trips_sand,
            trips_stones=e.trips_stones,
            fuel_received=e.fuel_received,
            fuel_used=e.fuel_used,
            fuel_balance=calculated_balance,
        ))
    for m in body.materials: db.add(ReportMaterial(report_id=rep.id, kind=m.kind, name=m.name.strip(), quantity=m.quantity, unit=m.unit.strip()))
    for w in body.workers: db.add(ReportWorker(report_id=rep.id, role=w.role.strip(), headcount=w.headcount, daily_wage=w.daily_wage))
    for w in body.work:
        db.add(ReportWork(report_id=rep.id, boq_item_id=w.boq_item_id, quantity=w.quantity))

def fuel_warnings(db: Session, rep: Report, p: Project, body: ReportIn) -> list[str]:
    """Warn if calculated fuel balance becomes negative; balance is automatic."""
    out = []
    for e in body.equipment:
        prev = db.execute(
            select(ReportEquipment.fuel_balance)
            .join(Report, Report.id == ReportEquipment.report_id)
            .where(
                Report.project_id == p.id,
                func.lower(ReportEquipment.name) == e.name.strip().lower(),
                Report.id != rep.id,
                or_(
                    Report.report_date < rep.report_date,
                    (Report.report_date == rep.report_date) & (Report.id < rep.id),
                ),
            )
            .order_by(Report.report_date.desc(), Report.id.desc())
            .limit(1)
        ).scalar()

        calculated = float(prev or 0) + e.fuel_received - e.fuel_used
        if calculated < 0:
            out.append(
                f"{e.name}: calculated fuel balance is {calculated:g} L, "
                "which is below zero."
            )
    return out

def log_event(db: Session, r: Report, action: str, by: str | None, note: str | None = None):
    db.add(ReportEvent(report_id=r.id, action=action, by=by, note=note, at=now()))  # UTC, like every other timestamp

def find_report(db: Session, code: str) -> Report:
    r = db.scalar(select(Report).where(Report.code == code))
    if not r:
        raise HTTPException(404, "Report not found.")
    return r

def report_detail(db: Session, r: Report, base: str = "") -> dict:  # base: the API's own address, so photo links are complete
    p, site, sup = db.get(Project, r.project_id), db.get(Site, r.site_id), (db.get(Supervisor, r.supervisor_id) if r.supervisor_id else None)
    work = db.execute(select(ReportWork.boq_item_id, BoqItem.item_no, BoqItem.description, BoqItem.unit, BoqItem.rate, ReportWork.quantity).join(BoqItem, BoqItem.id == ReportWork.boq_item_id)
                      .where(ReportWork.report_id == r.id).order_by(BoqItem.item_no)).all()
    costs = db.scalars(select(CostEntry).where(CostEntry.report_id == r.id).order_by(CostEntry.id)).all()
    return dict(id=r.code, project=p.code, project_name=p.name, site=site.name, supervisor_id=r.supervisor_id, supervisor=sup.name if sup else None, report_date=r.report_date,
                activity=r.activity, status=r.status, notes=r.notes, return_note=r.return_note, reviewed_at=r.reviewed_at, reviewed_by=r.reviewed_by,
                work=[dict(boq_item_id=i, item_no=n, description=d, unit=u, rate=rt, quantity=float(q), amount=int(round(float(q) * rt))) for i, n, d, u, rt, q in work],
                costs=[dict(category=c.category, description=c.description, amount=c.amount) for c in costs],
                start_time=r.start_time, end_time=r.end_time, challenge=r.challenge,
                activities=[a.description for a in db.scalars(select(ReportActivity).where(ReportActivity.report_id == r.id).order_by(ReportActivity.id))],
                equipment=[dict(name=e.name, details=e.details, hours=float(e.hours), fuel_received=float(e.fuel_received), fuel_used=float(e.fuel_used), fuel_balance=float(e.fuel_balance), kind=e.kind, trips_sand=e.trips_sand, trips_stones=e.trips_stones, fuel_opening=(float(e.fuel_opening) if e.fuel_opening is not None else None)) for e in db.scalars(select(ReportEquipment).where(ReportEquipment.report_id == r.id).order_by(ReportEquipment.id))],
                materials=[dict(kind=m.kind, name=m.name, quantity=float(m.quantity), unit=m.unit) for m in db.scalars(select(ReportMaterial).where(ReportMaterial.report_id == r.id).order_by(ReportMaterial.id))],
                workers=[dict(role=w.role, headcount=w.headcount, daily_wage=w.daily_wage, amount=w.headcount * w.daily_wage) for w in db.scalars(select(ReportWorker).where(ReportWorker.report_id == r.id).order_by(ReportWorker.id))],
                activity_details=[dict(description=a.description, quantity=a.quantity, location=a.location) for a in db.scalars(select(ReportActivity).where(ReportActivity.report_id == r.id).order_by(ReportActivity.id))],
                photos=[dict(url=f"{base}/{ph.path.lstrip('/')}", caption=ph.caption) for ph in db.scalars(select(ReportPhoto).where(ReportPhoto.report_id == r.id).order_by(ReportPhoto.id))])

@router.post("/reports", status_code=201)
def create_report(body: ReportIn, db: Session = Depends(get_db), admin: AdminUser = Depends(admin_only)):
    p, site = prepare_report(db, body)
    r = Report(code="TMP-" + uuid.uuid4().hex[:10], project_id=p.id, site_id=site.id, supervisor_id=body.supervisor_id, report_date=body.report_date,
               activity=body.activity.strip(), status="Pending", notes=(body.notes or "").strip() or None, start_time=body.start_time, end_time=body.end_time, challenge=(body.challenge or "").strip() or None)
    db.add(r); db.flush()
    count = db.scalar(select(func.count()).select_from(Report)) or 0
    r.code = f"RPT-{count:04d}"
    save_lines(db, r, p, site, body)
    log_event(db, r, "submitted", admin.email)
    warnings = fuel_warnings(db, r, p, body)
    db.commit()
    return {**report_detail(db, r), "warnings": warnings}

@router.post("/reports/{code}/photos")
async def upload_admin_report_photo(
    code: str,
    photo: UploadFile = File(...),
    caption: str | None = Form(default=None),
    db: Session = Depends(get_db),
    admin: AdminUser = Depends(admin_only),
):
    r = find_report(db, code)

    allowed = {
        "image/jpeg": ".jpg",
        "image/png": ".png",
        "image/webp": ".webp",
    }
    content_type = (photo.content_type or "").lower()
    if content_type not in allowed:
        raise HTTPException(415, "Only JPG, PNG, and WEBP images are allowed.")

    data = await photo.read(15 * 1024 * 1024 + 1)
    if len(data) > 15 * 1024 * 1024:
        raise HTTPException(413, "Image must be 15 MB or smaller.")
    if not data:
        raise HTTPException(400, "The uploaded image is empty.")

    filename = f"{code}_{uuid.uuid4().hex}{allowed[content_type]}"
    photo_record = ReportPhoto(
        report_id=r.id,
        path=f"uploads/reports/{filename}",
        caption=(caption or "").strip()[:200] or None,
        content_type=content_type,
        data=data,
    )
    db.add(photo_record)
    db.commit()
    db.refresh(photo_record)
    return {"id": photo_record.id, "caption": photo_record.caption}


@router.get("/reports/{code}")
def get_report(code: str, request: Request, db: Session = Depends(get_db)):
    return report_detail(db, find_report(db, code), str(request.base_url).rstrip("/"))

@router.put("/reports/{code}")
def update_report(code: str, body: ReportIn, db: Session = Depends(get_db), admin: AdminUser = Depends(admin_only)):
    r = find_report(db, code)
    if body.project != db.get(Project, r.project_id).code:
        raise HTTPException(400, "A report's project can't be changed. Delete it and create a new one.")
    p, site = prepare_report(db, body)
    r.site_id, r.supervisor_id, r.report_date, r.activity = site.id, body.supervisor_id, body.report_date, body.activity.strip()
    if r.status == "Returned":  # a corrected report is resubmitted into the same record, never duplicated
        action, note = "resubmitted", None
    elif r.status == "Approved":
        action, note = "edited", "Edited after approval, so it needs to be approved again."
    else:
        action, note = "edited", None
    r.status, r.return_note, r.reviewed_at, r.reviewed_by = "Pending", None, None, None
    log_event(db, r, action, admin.email, note)
    r.notes = (body.notes or "").strip() or None
    r.start_time, r.end_time, r.challenge = body.start_time, body.end_time, (body.challenge or "").strip() or None
    save_lines(db, r, p, site, body)
    warnings = fuel_warnings(db, r, p, body)
    db.commit()
    return {**report_detail(db, r), "warnings": warnings}

@router.delete("/reports/{code}", status_code=204)
def delete_report(code: str, db: Session = Depends(get_db)):
    r = find_report(db, code)

    db.execute(delete(ReportWork).where(ReportWork.report_id == r.id))
    db.execute(delete(CostEntry).where(CostEntry.report_id == r.id))

    for tbl in (ReportActivity, ReportEquipment, ReportMaterial, ReportWorker, ReportEvent):
        db.execute(delete(tbl).where(tbl.report_id == r.id))

    db.execute(delete(ReportPhoto).where(ReportPhoto.report_id == r.id))

    db.delete(r)
    db.flush()

    # Temporarily assign unique codes to avoid conflicts during renumbering
    reports = list(db.scalars(select(Report).order_by(Report.id)))

    for report in reports:
        report.code = "TMP-" + uuid.uuid4().hex[:12]

    db.flush()

    # Renumber all remaining reports sequentially
    for index, report in enumerate(reports, start=1):
        report.code = f"RPT-{index:04d}"

    db.commit()

# ---------- work done (bill of quantities, quantity x rate)
@router.get("/work-done")
def work_done(project: str | None = None, site: str | None = None, date_from: date | None = None, date_to: date | None = None, pa=Depends(page_args), db: Session = Depends(get_db)):
    page, size = pa
    pid, sid = scope(db, project, site)
    qty = func.sum(ReportWork.quantity)
    base = (select(Project.code.label("project_id"), Project.name.label("project_name"), BoqItem.item_no, BoqItem.description, BoqItem.unit, qty.label("quantity"), BoqItem.rate, (qty * BoqItem.rate).label("amount")).select_from(ReportWork).join(BoqItem, BoqItem.id == ReportWork.boq_item_id).join(Project, Project.id == BoqItem.project_id).join(Report, Report.id == ReportWork.report_id)
            .where(*report_filters(pid, sid, date_from, date_to), Report.status == APPROVED).group_by(Project.code, Project.name, BoqItem.id, BoqItem.item_no, BoqItem.description, BoqItem.unit, BoqItem.rate))
    sub = base.subquery()
    total = db.scalar(select(func.count()).select_from(sub)) or 0
    amount = db.scalar(select(func.coalesce(func.sum(sub.c.amount), 0))) or 0
    rows = db.execute(base.order_by(Project.code, BoqItem.item_no).offset((page - 1) * size).limit(size)).all()
    return {"items": [dict(project_id=r.project_id, project_name=r.project_name, item_no=r.item_no, description=r.description, unit=r.unit, quantity=float(r.quantity), rate=r.rate, amount=int(round(r.amount))) for r in rows],
            "total": total, "total_amount": int(round(amount)), "page": page, "size": size}

# ---------- finance
def finance_of(p: Project, s: dict) -> dict:
    f_cost = round(s["spent"] * p.contract_value / s["earned"]) if s["earned"] > 0 else None
    return dict(id=p.code, name=p.name, contract_value=p.contract_value, spent=s["spent"], earned=s["earned"], profit=s["earned"] - s["spent"], progress=time_progress(p),
                forecast_cost=f_cost, forecast_profit=(p.contract_value - f_cost) if f_cost is not None else None)

@router.get("/finance/projects")
def finance_list(search: str = "", pa=Depends(page_args), db: Session = Depends(get_db)):
    page, size = pa
    cond = []
    if search.strip():
        like = f"%{search.strip()}%"
        cond.append(or_(Project.name.ilike(like), Project.code.ilike(like)))
    projects = db.scalars(select(Project).where(*cond)).all()
    st = stats(db, [p.id for p in projects])
    rows = sorted((finance_of(p, st[p.id]) for p in projects), key=lambda r: r["profit"])  # losses first
    tot = lambda k: sum(r[k] for r in rows)
    return {"items": rows[(page - 1) * size: page * size], "total": len(rows), "page": page, "size": size,
            "totals": {"contract_value": tot("contract_value"), "spent": tot("spent"), "earned": tot("earned"), "profit": tot("profit")}}

@router.get("/finance/projects/{code}")
def finance_one(code: str, db: Session = Depends(get_db)):
    p = find_project(db, code)
    out = finance_of(p, stats(db, [p.id])[p.id])
    parts = totals_by_project(cost_events(db, [p.id])).get(p.id, {})
    out["breakdown"] = [{"category": c, "amount": parts.get(c, 0)} for c in ALL_CATEGORIES]
    return out

# ---------- dashboard
@router.get("/dashboard")
def dashboard(db: Session = Depends(get_db)):
    projects = db.scalars(select(Project)).all()
    st = stats(db, [p.id for p in projects])
    progs = [time_progress(p) for p in projects]
    per_day = db.execute(select(Report.report_date, func.count()).group_by(Report.report_date).order_by(Report.report_date)).all()
    by_cat: dict[str, int] = {}
    for _, _, cat, amt in cost_events(db, [p.id for p in projects]):
        by_cat[cat] = by_cat.get(cat, 0) + amt
    return {"kpi": {"projects": len(projects), "active": sum(p.status == "Active" for p in projects), "completed": sum(p.status == "Completed" for p in projects),
                    "avg_progress": round(sum(progs) / len(progs)) if progs else 0, "avg_financial_progress": round(sum(fin_progress(p.contract_value, st[p.id]["spent"]) for p in projects) / len(projects)) if projects else 0, "reports": db.scalar(select(func.count()).select_from(Report)) or 0,
                    "pending": db.scalar(select(func.count()).select_from(Report).where(Report.status == "Pending")) or 0, "cost": sum(by_cat.values()),
                    "supervisors": db.scalar(select(func.count()).select_from(Supervisor)) or 0, "active_supervisors": db.scalar(select(func.count()).select_from(Supervisor).where(Supervisor.active)) or 0},
            "reports_per_day": [{"date": d, "count": n} for d, n in per_day], "cost_by_category": [{"category": c, "amount": by_cat.get(c, 0)} for c in ALL_CATEGORIES]}

# ---------- Other Costs: entered by hand by Admin (never created from reports)
class CostIn(BaseModel):
    category: str = Field(min_length=2, max_length=40)
    description: str = Field(min_length=2, max_length=200)
    cost_date: date
    quantity: float | None = Field(default=None, gt=0, le=10**9)
    unit: str | None = Field(default=None, max_length=20)
    rate: int | None = Field(default=None, gt=0, le=10**10)
    amount: int | None = Field(default=None, gt=0, le=10**11)
    notes: str | None = Field(default=None, max_length=1000)
    site: str | None = None
    @field_validator("category", "description")
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
    def total(self) -> int:  # quantity x rate when both are given, otherwise the amount typed
        return round(self.quantity * self.rate) if self.quantity is not None else int(self.amount)

def cost_row(c: CostEntry, site: str | None) -> dict:
    return dict(id=c.id, date=c.cost_date, category=c.category, description=c.description, quantity=float(c.quantity) if c.quantity is not None else None, unit=c.unit, rate=c.rate, amount=c.amount, notes=c.notes, site=site)

def cost_site(db: Session, p: Project, name: str | None) -> Site | None:
    if not name:
        return None
    s = db.scalar(select(Site).where(Site.project_id == p.id, Site.name == name))
    if not s:
        raise HTTPException(422, "site: this project has no such site.")
    return s

def check_cost_date(d: date):
    if d > date.today() + timedelta(days=1):
        raise HTTPException(422, "cost_date: a cost can't be dated in the future.")

@router.get("/projects/{code}/costs")
def list_costs(code: str, category: str | None = None, period: dict = Depends(period_args), pa=Depends(page_args), db: Session = Depends(get_db)):
    page, size = pa
    p = find_project(db, code)
    cond = [CostEntry.project_id == p.id, CostEntry.report_id.is_(None)]
    if category: cond.append(CostEntry.category == category)
    if period["from"]: cond.append(CostEntry.cost_date >= period["from"])
    if period["to"]: cond.append(CostEntry.cost_date <= period["to"])
    total = db.scalar(select(func.count()).select_from(CostEntry).where(*cond)) or 0
    amount = db.scalar(select(func.coalesce(func.sum(CostEntry.amount), 0)).where(*cond)) or 0
    rows = db.execute(select(CostEntry, Site.name).outerjoin(Site, Site.id == CostEntry.site_id).where(*cond).order_by(CostEntry.cost_date.desc(), CostEntry.id.desc()).offset((page - 1) * size).limit(size)).all()
    return {"items": [cost_row(c, sn) for c, sn in rows], "total": total, "total_amount": int(amount), "page": page, "size": size}

@router.post("/projects/{code}/costs", status_code=201)
def create_cost(code: str, body: CostIn, db: Session = Depends(get_db)):
    p = find_project(db, code)
    site = cost_site(db, p, body.site)
    check_cost_date(body.cost_date)
    c = CostEntry(project_id=p.id, site_id=site.id if site else None, category=body.category, description=body.description.strip(), amount=body.total(), cost_date=body.cost_date,
                  quantity=body.quantity, unit=(body.unit or "").strip() or None, rate=body.rate, notes=(body.notes or "").strip() or None)
    db.add(c); db.commit()
    return cost_row(c, site.name if site else None)

def find_cost(db: Session, cid: int) -> CostEntry:
    c = db.get(CostEntry, cid)
    if not c or c.report_id:  # entries tied to a report are not Other Costs
        raise HTTPException(404, "Cost not found.")
    return c

@router.put("/costs/{cid}")
def update_cost(cid: int, body: CostIn, db: Session = Depends(get_db)):
    c = find_cost(db, cid)
    site = cost_site(db, db.get(Project, c.project_id), body.site)
    check_cost_date(body.cost_date)
    c.site_id, c.category, c.description, c.amount, c.cost_date = (site.id if site else None), body.category, body.description.strip(), body.total(), body.cost_date
    c.quantity, c.unit, c.rate, c.notes = body.quantity, (body.unit or "").strip() or None, body.rate, (body.notes or "").strip() or None
    db.commit()
    return cost_row(c, site.name if site else None)

@router.delete("/costs/{cid}", status_code=204)
def delete_cost(cid: int, db: Session = Depends(get_db)):
    db.delete(find_cost(db, cid)); db.commit()

@router.get("/suggestions")  # names used in earlier reports, so the form can suggest instead of retyping
def suggestions(db: Session = Depends(get_db)):
    return {"equipment": list(db.scalars(select(ReportEquipment.name).distinct().order_by(ReportEquipment.name).limit(200))),
            "materials": list(db.scalars(select(ReportMaterial.name).distinct().order_by(ReportMaterial.name).limit(200))),
            "roles": [{"role": r, "daily_wage": int(w)} for r, w in db.execute(select(ReportWorker.role, func.max(ReportWorker.daily_wage)).group_by(ReportWorker.role).order_by(ReportWorker.role).limit(200)).all()]}

# ---------- analytics (same Project / Site / date filters as the pages)
@router.get("/analytics")
def analytics(project: str | None = None, site: str | None = None, date_from: date | None = None, date_to: date | None = None, db: Session = Depends(get_db)):
    pid, sid = scope(db, project, site)
    rc = report_filters(pid, sid, date_from, date_to)
    per_day: dict[date, int] = defaultdict(int); by_cat: dict[str, int] = defaultdict(int); by_project: dict[int, int] = defaultdict(int)
    for d, i, cat, amt in cost_events(db, [pid] if pid else None, date_from, date_to, sid):
        per_day[d] += amt; by_cat[cat] += amt; by_project[i] += amt
    status = {r[0]: r[1] for r in db.execute(select(Report.status, func.count()).where(*rc).group_by(Report.status)).all()}
    fuel_used = func.sum(ReportEquipment.fuel_used)
    fuel = [{"name": n, "fuel_used": float(f or 0), "hours": float(h or 0)} for n, f, h in db.execute(
        select(ReportEquipment.name, fuel_used, func.sum(ReportEquipment.hours)).join(Report, Report.id == ReportEquipment.report_id).where(*rc, Report.status == APPROVED)
        .group_by(ReportEquipment.name).order_by(fuel_used.desc()).limit(8)).all()]
    top = []
    if not pid:
        names = {p.id: (p.code, p.name) for p in db.scalars(select(Project).where(Project.id.in_(list(by_project) or [0])))}
        top = [{"id": names[i][0], "name": names[i][1], "amount": a} for i, a in sorted(by_project.items(), key=lambda x: -x[1])[:5] if a > 0 and i in names]
    return {"kpi": {"cost": sum(by_cat.values()), "reports": sum(status.values()), "fuel_used": sum(x["fuel_used"] for x in fuel)}, "cost_per_day": [{"date": d, "amount": a} for d, a in sorted(per_day.items())],
            "cost_by_category": [{"category": c, "amount": by_cat.get(c, 0)} for c in ALL_CATEGORIES], "reports_by_status": [{"status": k, "count": status.get(k, 0)} for k in ("Pending", "Approved", "Returned")],
            "fuel_by_machine": fuel, "top_projects": top}

# ---------- top bar: global search and notifications
@router.get("/search")
def search(q: str = Query(min_length=2, max_length=100), db: Session = Depends(get_db)):
    esc = q.strip().replace("\\", "\\\\").replace("%", "\\%").replace("_", "\\_")  # treat % and _ as plain characters
    like = f"%{esc}%"
    projects = db.scalars(select(Project).where(or_(Project.name.ilike(like, escape="\\"), Project.code.ilike(like, escape="\\"), Project.district.ilike(like, escape="\\"), Project.location.ilike(like, escape="\\"), Project.client.ilike(like, escape="\\"))).order_by(Project.code).limit(4)).all()
    sups = db.scalars(select(Supervisor).where(or_(Supervisor.name.ilike(like, escape="\\"), Supervisor.email.ilike(like, escape="\\"), Supervisor.phone.ilike(like, escape="\\"))).order_by(Supervisor.name).limit(4)).all()
    reps = db.execute(select(Report, Project.code, Project.name).join(Project, Project.id == Report.project_id).where(or_(Report.code.ilike(like, escape="\\"), Report.activity.ilike(like, escape="\\")))
                      .order_by(Report.report_date.desc(), Report.id.desc()).limit(4)).all()
    return {"projects": [dict(id=p.code, name=p.name, district=p.district) for p in projects],
            "supervisors": [dict(id=x.id, name=x.name, email=x.email) for x in sups],
            "reports": [dict(id=r.code, activity=r.activity, project_id=pc, project_name=pn, date=r.report_date) for r, pc, pn in reps]}

@router.get("/notifications")
def notifications(flagged: bool = True, pending: bool = False, db: Session = Depends(get_db)):
    # `flagged` is the first switch in Settings: it now means "reports I returned for correction"; `pending` means "reports waiting for my review"
    statuses = (["Returned"] if flagged else []) + (["Pending"] if pending else [])
    if not statuses:
        return []
    rows = db.execute(select(Report, Project.code, Project.name, Site.name).join(Project, Project.id == Report.project_id).join(Site, Site.id == Report.site_id)
                      .where(Report.status.in_(statuses)).order_by(Report.report_date.desc(), Report.id.desc()).limit(15)).all()
    return [dict(id=r.code, kind=r.status.lower(), title="Report returned for correction" if r.status == "Returned" else "Report awaiting review", text=f"{r.code} Â· {pn}, {sn}", date=r.report_date, project_id=pc) for r, pc, pn, sn in rows]

# ---------- settings (profile, organization, notification choices)
class SettingsIn(BaseModel):
    name: str = Field(min_length=2, max_length=120)
    org: str = Field(min_length=2, max_length=120)
    notify_flagged: bool
    notify_new_report: bool
    notify_weekly: bool
    @field_validator("name", "org")
    @classmethod
    def strip(cls, v: str):
        v = v.strip()
        if len(v) < 2:
            raise ValueError("is too short")
        return v

def settings_row(db: Session) -> AdminSettings:
    row = db.get(AdminSettings, 1)
    if not row:
        row = AdminSettings(id=1, name="Admin", email="", org="E-terambere", notify_flagged=True, notify_new_report=True, notify_weekly=True)
        db.add(row); db.commit()
    return row

def settings_out(r: AdminSettings, email: str) -> dict:
    return dict(name=r.name, email=email, org=r.org, notify_flagged=r.notify_flagged, notify_new_report=r.notify_new_report, notify_weekly=r.notify_weekly)

@router.get("/settings")
def get_settings(db: Session = Depends(get_db), admin: AdminUser = Depends(admin_only)):
    return settings_out(settings_row(db), admin.email)

@router.put("/settings")
def put_settings(body: SettingsIn, db: Session = Depends(get_db), admin: AdminUser = Depends(admin_only)):
    r = settings_row(db)
    r.name, r.org = body.name, body.org
    r.notify_flagged, r.notify_new_report, r.notify_weekly = body.notify_flagged, body.notify_new_report, body.notify_weekly
    db.commit()
    return settings_out(r, admin.email)
