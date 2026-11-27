"""
Phase 1 – Supervisor authentication.

Endpoints (all under /api/supervisor):
  POST /login           – supervisor logs in with email + password → JWT
  GET  /me              – returns the authenticated supervisor's profile
  POST /change-password – supervisor changes their own password

Admin-side endpoint (under /api/admin, protected by admin_only):
  POST /api/admin/supervisors/{sid}/reset-password

JWT design:
  - Separate issuer ("eterambere-supervisor") so supervisor tokens are never
    accepted by admin_only and admin tokens are never accepted here.
  - No token_version: if a supervisor is deactivated, every subsequent
    request is rejected because we check `active` on every call.

Hash compatibility:
  - New passwords use Argon2id via security.hash_password.
  - Existing supervisors have legacy pbkdf2$<salt>$<hash> hashes from the
    old admin.py. These are verified on login and silently upgraded to
    Argon2id so no password reset is required.
"""

import hashlib
import os
import re
import shutil
import uuid
from datetime import date, datetime, timedelta, timezone
# far-past / far-future defaults when dates are missing, so Flutter's non-nullable DateTime fields stay happy
_DATE_MIN = date(1900, 1, 1)
_DATE_MAX = date(2100, 12, 31)

import jwt
from fastapi import APIRouter, Depends, File, Form, Header, HTTPException, Request, UploadFile
from fastapi.responses import FileResponse, Response
from pydantic import AliasChoices, BaseModel, Field, field_validator, model_validator
from sqlalchemy import delete, func, or_, select
from sqlalchemy.orm import Session, joinedload

from .admin import find_report, log_event
from .db import get_db
from .models import (
    Project,
    ProjectSupervisor,
    Report,
    ReportActivity,
    ReportEquipment,
    ReportEvent,
    ReportMaterial,
    ReportPhoto,
    ReportWorker,
    Site,
    Supervisor,
)
from .security import (
    hash_password,
    jwt_secret,
    password_problems,
    token_minutes,
    verify_password,
)

SUPERVISOR_ISSUER = "eterambere-supervisor"

router = APIRouter(prefix="/api/supervisor", tags=["supervisor-auth"])


# ── legacy hash support ───────────────────────────────────────────────────────

def _verify_pbkdf2(stored: str, pw: str) -> bool:
    """Verify legacy pbkdf2$<salt_hex>$<hash_hex> hashes from the old admin.py."""
    try:
        _, salt_hex, hash_hex = stored.split("$")
        salt = bytes.fromhex(salt_hex)
        expected = hashlib.pbkdf2_hmac("sha256", pw.encode(), salt, 200_000).hex()
        return expected == hash_hex
    except Exception:
        return False


def _verify_any(stored: str | None, pw: str) -> bool:
    """Accept both Argon2id (new) and pbkdf2 (legacy) hashes."""
    if not stored:
        return False
    if stored.startswith("$argon2"):
        return verify_password(stored, pw)
    if stored.startswith("pbkdf2$"):
        return _verify_pbkdf2(stored, pw)
    return False


# ── token helpers ─────────────────────────────────────────────────────────────

def _create_supervisor_token(supervisor_id: int, email: str) -> tuple[str, int]:
    minutes = token_minutes()
    t = datetime.now(timezone.utc)
    token = jwt.encode(
        {
            "sub": str(supervisor_id),
            "email": email,
            "iss": SUPERVISOR_ISSUER,
            "iat": t,
            "exp": t + timedelta(minutes=minutes),
        },
        jwt_secret(),
        algorithm="HS256",
    )
    return token, minutes * 60


def _decode_supervisor_token(token: str) -> dict:
    return jwt.decode(
        token,
        jwt_secret(),
        algorithms=["HS256"],
        issuer=SUPERVISOR_ISSUER,
        options={"require": ["exp", "sub", "iss"]},
    )


def get_current_supervisor(
    authorization: str | None = Header(default=None),
    db: Session = Depends(get_db),
) -> Supervisor:
    """Dependency: validates the Bearer token and returns the active Supervisor row."""
    if not authorization or not authorization.lower().startswith("bearer "):
        raise HTTPException(401, "Please sign in.", headers={"WWW-Authenticate": "Bearer"})
    try:
        claims = _decode_supervisor_token(authorization[7:].strip())
        supervisor_id = int(claims["sub"])
    except (jwt.PyJWTError, ValueError):
        raise HTTPException(
            401,
            "Your session has ended. Please sign in again.",
            headers={"WWW-Authenticate": "Bearer"},
        )

    sup = db.get(Supervisor, supervisor_id)
    if not sup:
        raise HTTPException(401, "Account not found.", headers={"WWW-Authenticate": "Bearer"})
    if not sup.active:
        raise HTTPException(403, "Your account has been deactivated. Contact your administrator.")
    if not sup.password_hash:
        raise HTTPException(403, "Your account has no password set. Contact your administrator.")
    return sup


def _token_out(sup: Supervisor) -> dict:
    token, expires_in = _create_supervisor_token(sup.id, sup.email)
    return {
        "access_token": token,
        "token_type": "bearer",
        "expires_in": expires_in,
        "supervisor": {
            "id": sup.id,
            "code": sup.code,
            "name": sup.name,
            "email": sup.email,
            "phone": sup.phone,
        },
    }


# ── schemas ───────────────────────────────────────────────────────────────────

class LoginIn(BaseModel):
    email: str = Field(max_length=160)
    password: str = Field(min_length=1, max_length=128)


class ChangePasswordIn(BaseModel):
    current_password: str = Field(min_length=1, max_length=128)
    new_password: str = Field(min_length=1, max_length=128)


# ── helpers ───────────────────────────────────────────────────────────────────

def _rep_status_to_flutter(s: str | None) -> str:
    """Map DB status values to the strings the Flutter _reportStatus expects."""
    if not s:
        return "draft"
    m = {"Pending": "submitted", "Approved": "reviewed", "Returned": "requires_correction"}
    return m.get(s.strip(), "draft")


def _time_to_minutes(t: str | None) -> int | None:
    """'HH:MM' -> minutes since midnight."""
    if not t:
        return None
    parts = t.split(":")
    return int(parts[0]) * 60 + int(parts[1])


def _minutes_to_time(m: int | None) -> str | None:
    """minutes since midnight -> 'HH:MM'."""
    if m is None:
        return None
    h = m // 60
    mi = m % 60
    return f"{h:02d}:{mi:02d}"


class ActivityLine(BaseModel):
    description: str = Field(min_length=1, max_length=500)
    quantity: str | None = Field(default=None, max_length=100)
    location: str | None = Field(default=None, max_length=200)


class EquipmentLine(BaseModel):
    kind: str | None = Field(default=None, max_length=10)  # machine / truck / tool
    name: str = Field(min_length=1, max_length=120)
    note: str | None = Field(default=None, max_length=200)
    hours: float | None = Field(default=0, ge=0, le=24)  # the app sends null for trucks and tools
    trips_sand: int | None = Field(default=0, ge=0)
    trips_stones: int | None = Field(default=0, ge=0)
    opening: float | None = Field(default=None, ge=0, le=100000)
    received: float | None = Field(default=None, ge=0, le=100000)
    used: float | None = Field(default=None, ge=0, le=100000)


class MaterialLineIn(BaseModel):
    name: str = Field(min_length=1, max_length=100)
    quantity: float | None = Field(default=0, ge=0, le=10**9)
    unit: str = Field(default="", max_length=20)


class LabourLineIn(BaseModel):
    role: str = Field(min_length=1, max_length=100)
    # the app sends headcount / daily_wage; count / rate are accepted too
    count: int = Field(validation_alias=AliasChoices("count", "headcount"), ge=0, le=10000)
    rate: float | None = Field(default=None, validation_alias=AliasChoices("rate", "daily_wage"), ge=0, le=10**7)


class PhotoRef(BaseModel):  # a photo already uploaded: lets the app keep, caption or remove photos on edit
    url: str = Field(max_length=500)
    caption: str | None = Field(default=None, max_length=200)


class SupervisorReportIn(BaseModel):
    project: str | None = Field(default=None, max_length=160)  # code or name; only used when the supervisor has several projects
    site: str
    report_date: date
    activity: str = Field(min_length=1, max_length=120)
    notes: str | None = Field(default=None, max_length=4000)
    start_time: str | None = None  # HH:MM
    end_time: str | None = None  # HH:MM
    challenge: str | None = Field(default=None, max_length=3000)
    status: str = Field(default="Draft", pattern=r"^(Draft|Pending)$")  # Draft or Pending only
    activities: list[ActivityLine] = []
    equipment: list[EquipmentLine] = []
    materials_received: list[MaterialLineIn] = []
    materials_used: list[MaterialLineIn] = []
    workers: list[LabourLineIn] = Field(default=[], validation_alias=AliasChoices("workers", "labour"))
    photos: list[PhotoRef] | None = None  # None = leave photos alone; a list = keep exactly these

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


# ── report detail serializer ──────────────────────────────────────────────────

# Set PUBLIC_BASE_URL (e.g. https://e-teramber.onrender.com) on the host to pin photo links.
PUBLIC_BASE_URL = os.getenv("PUBLIC_BASE_URL", "").strip().rstrip("/")


def _base(request: Request) -> str:
    """Public base URL for photo links. Behind a proxy the app sees http://, which a
    https page refuses to load (mixed content), so force https on any non-local host."""
    if PUBLIC_BASE_URL:
        return PUBLIC_BASE_URL + "/"
    base = str(request.base_url)
    host = request.url.hostname or ""
    local = host in ("localhost", "127.0.0.1") or host.startswith(("192.168.", "10."))
    if base.startswith("http://") and not local:
        base = "https://" + base[len("http://"):]
    return base


def _iso_utc(dt: datetime | None) -> str | None:
    """Timestamps are stored as naive UTC. Send them with an explicit offset so the app
    does not read them as local time (which shifts them by the phone's UTC offset)."""
    if dt is None:
        return None
    if dt.tzinfo is None:
        dt = dt.replace(tzinfo=timezone.utc)
    return dt.astimezone(timezone.utc).isoformat()


def _find_duplicate(db: Session, supervisor_id: int, project_id: int, site_id: int,
                    day: date, exclude_id: int | None = None):
    q = select(Report).where(
        Report.supervisor_id == supervisor_id,
        Report.project_id == project_id,
        Report.site_id == site_id,
        Report.report_date == day,
    )
    if exclude_id is not None:
        q = q.where(Report.id != exclude_id)
    return db.scalars(q.limit(1)).first()


def _photo_url(base_url: str, path: str) -> str:
    path = path.replace("\\", "/").lstrip("/")
    return f"{base_url.rstrip('/')}/{path}" if base_url else f"/{path}"


def _num(v):
    return None if v is None else float(v)


def _report_detail(db: Session, r: Report, base_url: str = "") -> dict:
    p = db.get(Project, r.project_id)
    site = db.get(Site, r.site_id)

    created_at = None
    events = db.scalars(
        select(ReportEvent)
        .where(ReportEvent.report_id == r.id)
        .order_by(ReportEvent.id.asc())
    ).all()
    if events:
        created_at = _iso_utc(events[0].at)

    activities = [
        {"description": a.description, "quantity": a.quantity or "", "location": a.location or ""}
        for a in db.scalars(
            select(ReportActivity).where(ReportActivity.report_id == r.id).order_by(ReportActivity.id)
        ).all()
    ]
    equipment = [
        {
            "kind": e.kind or "machine",
            "name": e.name,
            "note": e.details or "",
            "hours": _num(e.hours),
            "trips_sand": e.trips_sand,
            "trips_stones": e.trips_stones,
            "opening": _num(e.fuel_opening),
            "received": _num(e.fuel_received),
            "used": _num(e.fuel_used),
        }
        for e in db.scalars(
            select(ReportEquipment).where(ReportEquipment.report_id == r.id).order_by(ReportEquipment.id)
        ).all()
    ]
    materials = db.scalars(
        select(ReportMaterial).where(ReportMaterial.report_id == r.id).order_by(ReportMaterial.id)
    ).all()
    labour = [
        {"role": w.role, "count": w.headcount, "rate": w.daily_wage}
        for w in db.scalars(
            select(ReportWorker).where(ReportWorker.report_id == r.id).order_by(ReportWorker.id)
        ).all()
    ]
    photos = [
        {"url": _photo_url(base_url, ph.path), "caption": ph.caption or ""}
        for ph in db.scalars(
            select(ReportPhoto).where(ReportPhoto.report_id == r.id).order_by(ReportPhoto.id)
        ).all()
    ]

    return {
        "id": r.code,
        "project_id": p.code if p else "",
        "project_name": p.name if p else "",
        "date": r.report_date.isoformat(),
        "created_at": created_at,
        "site": site.name if site else "",
        "comments": r.notes,
        "start_min": _time_to_minutes(r.start_time),
        "end_min": _time_to_minutes(r.end_time),
        "status": _rep_status_to_flutter(r.status),
        "admin_feedback": r.return_note,
        "tasks": activities,
        "equipment": equipment,
        "materials_received": [
            {"name": m.name, "quantity": _num(m.quantity), "unit": m.unit} for m in materials if m.kind == "received"
        ],
        "materials_used": [
            {"name": m.name, "quantity": _num(m.quantity), "unit": m.unit} for m in materials if m.kind == "used"
        ],
        "labour": labour,
        "challenges": [{"description": c} for c in (r.challenge or "").split("\n") if c.strip()],
        "history": [{"at": _iso_utc(e.at), "action": e.action, "note": e.note} for e in events],
        "photos": photos,
    }


# ── endpoints ─────────────────────────────────────────────────────────────────

@router.post("/login")
def supervisor_login(body: LoginIn, db: Session = Depends(get_db)):
    sup = db.scalar(
        select(Supervisor).where(
            Supervisor.email == body.email.strip().lower()
        )
    )
    # Always run verify even when account doesn't exist (timing safety)
    ok = _verify_any(sup.password_hash if sup else None, body.password)
    if not ok or not sup:
        raise HTTPException(401, "Incorrect email or password.")
    if not sup.active:
        raise HTTPException(403, "Your account has been deactivated. Contact your administrator.")
    if not sup.password_hash:
        raise HTTPException(403, "Your account has no password set. Contact your administrator.")
    # Silently upgrade legacy pbkdf2 hash to Argon2id on successful login
    if sup.password_hash.startswith("pbkdf2$"):
        sup.password_hash = hash_password(body.password)
        db.commit()
    return _token_out(sup)


@router.get("/me")
def supervisor_me(sup: Supervisor = Depends(get_current_supervisor)):
    return {
        "id": sup.id,
        "code": sup.code,
        "name": sup.name,
        "email": sup.email,
        "phone": sup.phone,
    }


@router.post("/change-password")
def supervisor_change_password(
    body: ChangePasswordIn,
    sup: Supervisor = Depends(get_current_supervisor),
    db: Session = Depends(get_db),
):
    if not _verify_any(sup.password_hash, body.current_password):
        raise HTTPException(400, "The current password is not correct.")
    if body.new_password == body.current_password:
        raise HTTPException(422, "The new password must be different from the current one.")
    problems = password_problems(body.new_password, sup.email)
    if problems:
        raise HTTPException(422, "The new password needs: " + "; ".join(problems) + ".")
    sup.password_hash = hash_password(body.new_password)
    db.commit()
    return {"detail": "Password updated."}


# ── supervisor project / report / home-stats endpoints ────────────────────────

def _proj_status(s: str | None) -> str:
    """Map DB status strings to the lowercase values the Flutter ProjectStatus enum expects."""
    if not s:
        return "not_started"
    m = {
        "planning": "not_started",
        "active": "active",
        "on hold": "on_hold",
        "on_hold": "on_hold",
        "completed": "completed",
        "cancelled": "cancelled",
    }
    return m.get(s.strip().lower(), "not_started")


@router.get("/projects")
def supervisor_projects(
    sup: Supervisor = Depends(get_current_supervisor),
    db: Session = Depends(get_db),
):
    """Projects assigned to the logged-in supervisor."""
    projects = db.scalars(
        select(Project)
        .join(ProjectSupervisor, ProjectSupervisor.project_id == Project.id)
        .where(ProjectSupervisor.supervisor_id == sup.id)
        .order_by(Project.code)
    ).all()
    return [
        {
            "id": p.code,
            "code": p.code,
            "name": p.name,
            "description": p.location or p.district or "",
            "location": p.location or p.district or "",
            "start_date": (p.start_date or _DATE_MIN).isoformat(),
            "expected_end": (p.end_date or _DATE_MAX).isoformat(),
            "status": _proj_status(p.status),
            "progress": 0.0,
            "sites": [s.name for s in p.sites],
        }
        for p in projects
    ]


@router.get("/reports")
def supervisor_reports(
    request: Request,
    sup: Supervisor = Depends(get_current_supervisor),
    db: Session = Depends(get_db),
):
    """Reports submitted by the logged-in supervisor."""
    rows = db.execute(
        select(Report, Project.code, Project.name, Site.name)
        .join(Project, Project.id == Report.project_id)
        .join(Site, Site.id == Report.site_id)
        .where(Report.supervisor_id == sup.id)
        .order_by(Report.report_date.desc(), Report.id.desc())
    ).all()
    return [_report_detail(db, r, _base(request)) for r, _, _, _ in rows]


@router.get("/reports/stats/home")
def supervisor_home_stats(
    sup: Supervisor = Depends(get_current_supervisor),
    db: Session = Depends(get_db),
):
    """Dashboard/KPI stats for the supervisor's home screen."""
    project_count = db.scalar(
        select(func.count())
        .select_from(ProjectSupervisor)
        .where(ProjectSupervisor.supervisor_id == sup.id)
    ) or 0

    total_reports = db.scalar(
        select(func.count()).select_from(Report).where(Report.supervisor_id == sup.id)
    ) or 0
    pending_reports = db.scalar(
        select(func.count()).select_from(Report)
        .where(Report.supervisor_id == sup.id, Report.status == "Pending")
    ) or 0
    approved_reports = db.scalar(
        select(func.count()).select_from(Report)
        .where(Report.supervisor_id == sup.id, Report.status == "Approved")
    ) or 0
    returned_reports = db.scalar(
        select(func.count()).select_from(Report)
        .where(Report.supervisor_id == sup.id, Report.status == "Returned")
    ) or 0

    # reports per day (last 7 days) for the home chart
    today = date.today()
    seven_days_ago = today - timedelta(days=6)
    rows = db.execute(
        select(Report.report_date, func.count())
        .where(Report.supervisor_id == sup.id, Report.report_date >= seven_days_ago)
        .group_by(Report.report_date)
        .order_by(Report.report_date)
    ).all()
    reports_per_day = [{"date": d.isoformat(), "count": n} for d, n in rows]

    return {
        "total_projects": project_count,
        "active_projects": project_count,
        "draft_count": 0,
        "awaiting_review_count": pending_reports,
        "corrections_count": returned_reports,
        "reports_per_day": reports_per_day,
    }


def save_supervisor_report_lines(db: Session, rep: Report, body: SupervisorReportIn):
    """Save the structured rows (activities, equipment, materials, workers) of a supervisor report.

    Work done always belongs to the supervisor, so it is replaced. Equipment, materials and
    workers are replaced only when the app actually sent rows: the mobile form keeps those
    as text, and an edit must not wipe rows the administrator entered in the dashboard.
    """
    db.execute(delete(ReportActivity).where(ReportActivity.report_id == rep.id))
    for a in body.activities:
        db.add(ReportActivity(
            report_id=rep.id,
            description=a.description.strip(),
            quantity=(a.quantity or "").strip() or None,
            location=(a.location or "").strip() or None,
        ))

    if body.equipment:
        db.execute(delete(ReportEquipment).where(ReportEquipment.report_id == rep.id))
        for e in body.equipment:
            # small tools only record fuel used, so they have no balance
            fuel_balance = 0.0 if e.kind == "tool" else float(e.opening or 0) + float(e.received or 0) - float(e.used or 0)
            db.add(ReportEquipment(
                report_id=rep.id,
                name=e.name.strip(),
                details=(e.note or "").strip() or None,
                hours=e.hours or 0,
                fuel_received=float(e.received or 0),
                fuel_used=float(e.used or 0),
                fuel_balance=fuel_balance,
                kind=e.kind,
                trips_sand=e.trips_sand,
                trips_stones=e.trips_stones,
                fuel_opening=float(e.opening) if e.opening is not None else None,
            ))

    if body.materials_received or body.materials_used:
        db.execute(delete(ReportMaterial).where(ReportMaterial.report_id == rep.id))
        for kind, lines in (("received", body.materials_received), ("used", body.materials_used)):
            for m in lines:
                db.add(ReportMaterial(
                    report_id=rep.id,
                    kind=kind,
                    name=m.name.strip(),
                    quantity=m.quantity or 0,
                    unit=(m.unit or "").strip(),
                ))

    if body.workers:
        db.execute(delete(ReportWorker).where(ReportWorker.report_id == rep.id))
        for w in body.workers:
            db.add(ReportWorker(
                report_id=rep.id,
                role=w.role.strip(),
                headcount=w.count,
                daily_wage=int(round(w.rate or 0)),
            ))


def sync_photos(db: Session, rep: Report, refs: list[PhotoRef]) -> list[str]:
    """Keep exactly the photos the app lists (matched by file name), update their captions
    and delete the rest. Returns the file paths to remove once the change is committed."""
    keep = {os.path.basename(x.url.split("?")[0]): (x.caption or "").strip()[:200] for x in refs}
    removed: list[str] = []
    for ph in db.scalars(select(ReportPhoto).where(ReportPhoto.report_id == rep.id)).all():
        name = os.path.basename(ph.path)
        if name in keep:
            ph.caption = keep[name]
        else:
            removed.append(ph.path)
            db.delete(ph)
    return removed


# ── create report ─────────────────────────────────────────────────────────────

@router.post("/reports", status_code=201)
def supervisor_create_report(
    request: Request,
    body: SupervisorReportIn,
    sup: Supervisor = Depends(get_current_supervisor),
    db: Session = Depends(get_db),
):
    """Create a new daily report. Status = 'Pending'.
    Project is worked out from the supervisor's assignment (never trusted from the app).
    """
    assignments = db.scalars(
        select(ProjectSupervisor).where(ProjectSupervisor.supervisor_id == sup.id)
    ).all()
    if not assignments:
        raise HTTPException(403, "No project is assigned to you. Contact your administrator.")
    if len(assignments) == 1:
        p = db.get(Project, assignments[0].project_id)
    else:
        # Several projects: the app says which one (its code or name), checked against the assignments.
        assigned = [x for x in (db.get(Project, a.project_id) for a in assignments) if x]
        wanted = (body.project or "").strip().lower()
        p = next((x for x in assigned if wanted and wanted in (x.code.lower(), x.name.lower())), None)
        if not p:
            raise HTTPException(
                400,
                "You are assigned to several projects: "
                + ", ".join(x.code for x in assigned)
                + ". Choose the project in the report form.",
            )
    if not p:
        raise HTTPException(404, "Your assigned project was not found.")

    site = db.scalar(
        select(Site).where(
            Site.project_id == p.id,
            func.lower(Site.name) == body.site.strip().lower(),
        )
    )
    if not site:
        site_names = [s.name for s in p.sites]
        raise HTTPException(404, f"This site does not belong to the project. Sites: {', '.join(site_names) or 'none'}")

    if body.report_date > date.today() + timedelta(days=1):
        raise HTTPException(422, "report_date: a report can't be dated in the future.")

    dup = _find_duplicate(db, sup.id, p.id, site.id, body.report_date)
    if dup:
        raise HTTPException(
            409,
            f"A report for {p.code}, {site.name} on {body.report_date.isoformat()} already exists ({dup.code}). "
            "Open it and edit it instead of creating a new one.",
        )

    r = Report(
        code="TMP-" + uuid.uuid4().hex[:10],
        project_id=p.id,
        site_id=site.id,
        supervisor_id=sup.id,
        report_date=body.report_date,
        activity=body.activity.strip(),
        status=body.status,
        notes=(body.notes or "").strip() or None,
        start_time=body.start_time,
        end_time=body.end_time,
        challenge=(body.challenge or "").strip() or None,
    )
    db.add(r)
    db.flush()
    count = db.scalar(select(func.count()).select_from(Report)) or 0
    r.code = f"RPT-{count:04d}"
    if body.status == "Pending":  # saving a draft is not a submission
        log_event(db, r, "submitted", sup.email)
    save_supervisor_report_lines(db, r, body)
    db.commit()
    db.refresh(r)
    return _report_detail(db, r, _base(request))


# ── get one report ────────────────────────────────────────────────────────────

@router.get("/reports/{code}")
def supervisor_get_report(
    code: str,
    request: Request,
    sup: Supervisor = Depends(get_current_supervisor),
    db: Session = Depends(get_db),
):
    """Full detail of one report, only if it belongs to the logged-in supervisor."""
    r = find_report(db, code)
    if r.supervisor_id != sup.id:
        raise HTTPException(403, "You can only view your own reports.")
    return _report_detail(db, r, _base(request))


# ── update + resubmit a report ────────────────────────────────────────────────

@router.put("/reports/{code}")
def supervisor_update_report(
    code: str,
    request: Request,
    body: SupervisorReportIn,
    sup: Supervisor = Depends(get_current_supervisor),
    db: Session = Depends(get_db),
):
    """
    Edit a report. Allowed for a 'Draft' (saved again, or submitted when status is 'Pending')
    and for a 'Returned' report (corrected: it stays 'Returned' when saved, and goes back to
    'Pending' with a 'resubmitted' event when submitted). The SAME record is updated.
    """
    r = find_report(db, code)
    if r.supervisor_id != sup.id:
        raise HTTPException(403, "You can only edit your own reports.")
    if r.status not in ("Draft", "Returned"):
        raise HTTPException(409, "Only a draft or returned report can be edited.")
    was_returned = r.status == "Returned"

    # The project is the one the report already belongs to (never trusted from the app).
    p = db.get(Project, r.project_id)
    if not p:
        raise HTTPException(404, "The report's project was not found.")

    site = db.scalar(
        select(Site).where(
            Site.project_id == p.id,
            func.lower(Site.name) == body.site.strip().lower(),
        )
    )
    if not site:
        site_names = [s.name for s in p.sites]
        raise HTTPException(404, f"This site does not belong to the project. Sites: {', '.join(site_names) or 'none'}")

    if body.report_date > date.today() + timedelta(days=1):
        raise HTTPException(422, "report_date: a report can't be dated in the future.")

    dup = _find_duplicate(db, sup.id, r.project_id, site.id, body.report_date, exclude_id=r.id)
    if dup:
        raise HTTPException(
            409,
            f"Another report for {p.code}, {site.name} on {body.report_date.isoformat()} already exists ({dup.code}).",
        )

    r.site_id = site.id
    r.report_date = body.report_date
    r.activity = body.activity.strip()
    r.notes = (body.notes or "").strip() or None
    r.start_time = body.start_time
    r.end_time = body.end_time
    r.challenge = (body.challenge or "").strip() or None

    if was_returned:
        if body.status == "Pending":
            r.status = "Pending"
            r.return_note = None
            r.reviewed_at = None
            r.reviewed_by = None
            log_event(db, r, "resubmitted", sup.email)
        # just saving keeps the report Returned, with the administrator's note
    else:
        r.status = body.status
        if body.status == "Pending":
            log_event(db, r, "submitted", sup.email)

    save_supervisor_report_lines(db, r, body)
    removed = sync_photos(db, r, body.photos) if body.photos is not None else []
    db.commit()
    for path in removed:
        try:
            os.remove(path)
        except OSError:
            pass
    db.refresh(r)
    return _report_detail(db, r, _base(request))


# ── submit (confirm) a report ─────────────────────────────────────────────────

@router.post("/reports/{code}/submit")
def supervisor_submit_report(
    code: str,
    request: Request,
    sup: Supervisor = Depends(get_current_supervisor),
    db: Session = Depends(get_db),
):
    """Confirm a report is submitted. Changes status from Draft to Pending."""
    r = find_report(db, code)
    if r.supervisor_id != sup.id:
        raise HTTPException(403, "You can only submit your own reports.")
    if r.status != "Draft":
        raise HTTPException(409, "Only a draft report can be submitted.")
    r.status = "Pending"
    log_event(db, r, "submitted", sup.email)
    db.commit()
    db.refresh(r)
    return _report_detail(db, r, _base(request))


# ── upload photo for a report ─────────────────────────────────────────────────

UPLOAD_DIR = "uploads/reports"
os.makedirs(UPLOAD_DIR, exist_ok=True)
ALLOWED_PHOTO_EXT = {".jpg", ".jpeg", ".png", ".webp", ".heic", ".heif"}
MAX_PHOTO_BYTES = 15 * 1024 * 1024
_PHOTO_MIME = {
    ".jpg": "image/jpeg", ".jpeg": "image/jpeg", ".png": "image/png",
    ".webp": "image/webp", ".heic": "image/heic", ".heif": "image/heif",
}


@router.post("/reports/{code}/photos")
def supervisor_upload_photo(
    code: str,
    request: Request,
    photo: UploadFile = File(...),
    caption: str = Form(default=""),
    sup: Supervisor = Depends(get_current_supervisor),
    db: Session = Depends(get_db),
):
    """Upload a progress photo for a report. Returns { "url": "...", "caption": "..." }.
    The image is stored in the database (permanent) and also on disk (fast)."""
    r = find_report(db, code)
    if r.supervisor_id != sup.id:
        raise HTTPException(403, "You can only upload photos to your own reports.")
    ext = os.path.splitext(photo.filename or "")[1].lower() or ".jpg"
    if ext not in ALLOWED_PHOTO_EXT:
        raise HTTPException(422, "Only image files (JPG, PNG, WEBP, HEIC) can be uploaded.")

    data = photo.file.read(MAX_PHOTO_BYTES + 1)
    if not data:
        raise HTTPException(422, "The photo file is empty.")
    if len(data) > MAX_PHOTO_BYTES:
        raise HTTPException(413, "The photo is too large (maximum 15 MB).")

    file_name = f"{r.code}_{os.urandom(8).hex()}{ext}"
    file_path = f"{UPLOAD_DIR}/{file_name}"
    try:
        with open(file_path, "wb") as buffer:
            buffer.write(data)
    except OSError:
        pass  # the database copy is the one that matters

    cap = (caption or "").strip()[:200]
    db.add(ReportPhoto(
        report_id=r.id,
        path=file_path,
        caption=cap,
        content_type=_PHOTO_MIME.get(ext, "image/jpeg"),
        data=data,
    ))
    db.commit()
    return {"url": _photo_url(_base(request), file_path), "caption": cap}


# Public (the image URL carries no login), registered before the /uploads static mount so it wins.
photo_router = APIRouter()


@photo_router.get("/uploads/reports/{name}", include_in_schema=False)
def serve_report_photo(name: str, db: Session = Depends(get_db)):
    name = os.path.basename(name)
    path = f"{UPLOAD_DIR}/{name}"
    headers = {"Cache-Control": "public, max-age=86400"}
    if os.path.isfile(path):
        return FileResponse(path, headers=headers)
    ph = db.scalar(select(ReportPhoto).where(ReportPhoto.path == path))
    if ph is not None and ph.data:
        return Response(content=bytes(ph.data), media_type=ph.content_type or "image/jpeg", headers=headers)
    raise HTTPException(404, "Photo not found.")
