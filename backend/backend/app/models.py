from datetime import date, datetime
from sqlalchemy import BigInteger, Boolean, Date, DateTime, ForeignKey, LargeBinary, Numeric, String, Text, UniqueConstraint, func
from sqlalchemy.orm import Mapped, mapped_column, relationship
from .db import Base

class Supervisor(Base):
    __tablename__ = "supervisors"
    id: Mapped[int] = mapped_column(primary_key=True)
    code: Mapped[str] = mapped_column(String(20), unique=True, index=True, default="TMP")
    name: Mapped[str] = mapped_column(String(120))
    email: Mapped[str] = mapped_column(String(160), unique=True)
    phone: Mapped[str] = mapped_column(String(30))
    active: Mapped[bool] = mapped_column(Boolean, default=True)
    password_hash: Mapped[str | None] = mapped_column(String(300), nullable=True)  # for the future login; never returned by the API

class ProjectSupervisor(Base):
    __tablename__ = "project_supervisors"
    __table_args__ = (UniqueConstraint("project_id", "supervisor_id"),)
    id: Mapped[int] = mapped_column(primary_key=True)
    project_id: Mapped[int] = mapped_column(ForeignKey("projects.id", ondelete="CASCADE"), index=True)
    supervisor_id: Mapped[int] = mapped_column(ForeignKey("supervisors.id", ondelete="CASCADE"), index=True)

class Project(Base):
    __tablename__ = "projects"
    id: Mapped[int] = mapped_column(primary_key=True)
    code: Mapped[str] = mapped_column(String(20), unique=True, index=True)  # PRJ-001
    name: Mapped[str] = mapped_column(String(120))
    district: Mapped[str] = mapped_column(String(60))
    status: Mapped[str] = mapped_column(String(20), default="Planning")
    contract_value: Mapped[int] = mapped_column(BigInteger)  # expected income, RWF
    supervisor_id: Mapped[int | None] = mapped_column(ForeignKey("supervisors.id"), nullable=True)  # kept for backward compat
    project_type: Mapped[str | None] = mapped_column(String(80), nullable=True)
    client: Mapped[str | None] = mapped_column(String(160), nullable=True)
    consultant: Mapped[str | None] = mapped_column(String(160), nullable=True)
    location: Mapped[str | None] = mapped_column(String(200), nullable=True)
    start_date: Mapped[date | None] = mapped_column(Date, nullable=True)
    end_date: Mapped[date | None] = mapped_column(Date, nullable=True)  # expected completion; duration is calculated, never stored
    created_at: Mapped[datetime] = mapped_column(DateTime, server_default=func.now())
    supervisor: Mapped[Supervisor | None] = relationship(foreign_keys=[supervisor_id])
    supervisors: Mapped[list["Supervisor"]] = relationship(secondary="project_supervisors", order_by="Supervisor.name")
    sites: Mapped[list["Site"]] = relationship(cascade="all, delete-orphan", order_by="Site.id")
    boq_items: Mapped[list["BoqItem"]] = relationship(cascade="all, delete-orphan", order_by="BoqItem.item_no")
    costs: Mapped[list["CostEntry"]] = relationship(cascade="all, delete-orphan")
    subcontractors: Mapped[list["Subcontractor"]] = relationship(cascade="all, delete-orphan")
    rates: Mapped[list["ProjectRate"]] = relationship(cascade="all, delete-orphan")

class Site(Base):
    __tablename__ = "sites"
    __table_args__ = (UniqueConstraint("project_id", "name"),)
    id: Mapped[int] = mapped_column(primary_key=True)
    project_id: Mapped[int] = mapped_column(ForeignKey("projects.id", ondelete="CASCADE"), index=True)
    name: Mapped[str] = mapped_column(String(60))  # "Site 1"

class BoqItem(Base):  # the project's bill of quantities, entered by Admin
    __tablename__ = "boq_items"
    __table_args__ = (UniqueConstraint("project_id", "item_no"),)
    id: Mapped[int] = mapped_column(primary_key=True)
    project_id: Mapped[int] = mapped_column(ForeignKey("projects.id", ondelete="CASCADE"), index=True)
    item_no: Mapped[int]
    description: Mapped[str] = mapped_column(String(200))
    unit: Mapped[str] = mapped_column(String(20))
    rate: Mapped[int] = mapped_column(BigInteger)  # RWF per unit
    quantity: Mapped[float | None] = mapped_column(Numeric(14, 2), nullable=True)  # contract quantity (optional)

class Report(Base):  # submitted by supervisors (mobile app, later)
    __tablename__ = "reports"
    id: Mapped[int] = mapped_column(primary_key=True)
    code: Mapped[str] = mapped_column(String(20), unique=True, index=True)
    project_id: Mapped[int] = mapped_column(ForeignKey("projects.id"), index=True)
    site_id: Mapped[int] = mapped_column(ForeignKey("sites.id"))
    supervisor_id: Mapped[int | None] = mapped_column(ForeignKey("supervisors.id"), nullable=True)
    report_date: Mapped[date] = mapped_column(Date, index=True)
    activity: Mapped[str] = mapped_column(String(120))
    status: Mapped[str] = mapped_column(String(20), default="Pending")
    notes: Mapped[str | None] = mapped_column(Text, nullable=True)
    start_time: Mapped[str | None] = mapped_column(String(5), nullable=True)  # HH:MM
    end_time: Mapped[str | None] = mapped_column(String(5), nullable=True)
    challenge: Mapped[str | None] = mapped_column(Text, nullable=True)
    return_note: Mapped[str | None] = mapped_column(Text, nullable=True)  # review: why Admin returned it for correction
    reviewed_at: Mapped[datetime | None] = mapped_column(DateTime, nullable=True)
    reviewed_by: Mapped[str | None] = mapped_column(String(254), nullable=True)

class ReportWork(Base):  # quantity of a BoQ item completed, as recorded in a report
    __tablename__ = "report_work"
    __table_args__ = (UniqueConstraint("report_id", "boq_item_id"),)
    id: Mapped[int] = mapped_column(primary_key=True)
    report_id: Mapped[int] = mapped_column(ForeignKey("reports.id", ondelete="CASCADE"), index=True)
    boq_item_id: Mapped[int] = mapped_column(ForeignKey("boq_items.id", ondelete="CASCADE"), index=True)
    quantity: Mapped[float] = mapped_column(Numeric(14, 2))

class CostEntry(Base):  # money spent: expenses, material, equipment, labor, subcontractor, other
    __tablename__ = "cost_entries"
    id: Mapped[int] = mapped_column(primary_key=True)
    project_id: Mapped[int] = mapped_column(ForeignKey("projects.id", ondelete="CASCADE"), index=True)
    site_id: Mapped[int | None] = mapped_column(ForeignKey("sites.id"), nullable=True)
    report_id: Mapped[int | None] = mapped_column(ForeignKey("reports.id"), nullable=True)
    category: Mapped[str] = mapped_column(String(20), index=True)
    description: Mapped[str] = mapped_column(String(200))
    amount: Mapped[int] = mapped_column(BigInteger)
    cost_date: Mapped[date] = mapped_column(Date, index=True)
    quantity: Mapped[float | None] = mapped_column(Numeric(14, 2), nullable=True)
    unit: Mapped[str | None] = mapped_column(String(20), nullable=True)
    rate: Mapped[int | None] = mapped_column(BigInteger, nullable=True)
    notes: Mapped[str | None] = mapped_column(Text, nullable=True)

class ReportActivity(Base):  # "Work done" lines, free text with location, exactly as written on the paper form
    __tablename__ = "report_activities"
    id: Mapped[int] = mapped_column(primary_key=True)
    report_id: Mapped[int] = mapped_column(ForeignKey("reports.id", ondelete="CASCADE"), index=True)
    description: Mapped[str] = mapped_column(String(500))
    quantity: Mapped[str | None] = mapped_column(String(100), nullable=True)  # e.g. "12 m3"
    location: Mapped[str | None] = mapped_column(String(200), nullable=True)  # e.g. "CH 14+120"

class ReportEquipment(Base):  # "Equipment used": machine, what it did, hours and fuel in litres
    __tablename__ = "report_equipment"
    id: Mapped[int] = mapped_column(primary_key=True)
    report_id: Mapped[int] = mapped_column(ForeignKey("reports.id", ondelete="CASCADE"), index=True)
    name: Mapped[str] = mapped_column(String(120))  # e.g. "Excavator 320 (RAH993U)"
    details: Mapped[str | None] = mapped_column(String(200), nullable=True)  # e.g. "Loading trucks" or "2 trips of sand"
    hours: Mapped[float] = mapped_column(Numeric(6, 2), default=0)
    fuel_received: Mapped[float] = mapped_column(Numeric(10, 2), default=0)
    fuel_used: Mapped[float] = mapped_column(Numeric(10, 2), default=0)
    fuel_balance: Mapped[float] = mapped_column(Numeric(10, 2), default=0)
    kind: Mapped[str | None] = mapped_column(String(10), nullable=True)  # "machine", "truck" or "tool"
    trips_sand: Mapped[int | None] = mapped_column(nullable=True)
    trips_stones: Mapped[int | None] = mapped_column(nullable=True)
    fuel_opening: Mapped[float | None] = mapped_column(Numeric(10, 2), nullable=True)

class ReportMaterial(Base):  # materials received / used
    __tablename__ = "report_materials"
    id: Mapped[int] = mapped_column(primary_key=True)
    report_id: Mapped[int] = mapped_column(ForeignKey("reports.id", ondelete="CASCADE"), index=True)
    kind: Mapped[str] = mapped_column(String(10))  # "received" or "used"
    name: Mapped[str] = mapped_column(String(100))
    quantity: Mapped[float] = mapped_column(Numeric(14, 2))
    unit: Mapped[str] = mapped_column(String(20))

class ReportWorker(Base):  # casual workers: role, number of people, wage per day. Labor cost = headcount x daily_wage
    __tablename__ = "report_workers"
    id: Mapped[int] = mapped_column(primary_key=True)
    report_id: Mapped[int] = mapped_column(ForeignKey("reports.id", ondelete="CASCADE"), index=True)
    role: Mapped[str] = mapped_column(String(100))
    headcount: Mapped[int]
    daily_wage: Mapped[int] = mapped_column(BigInteger)

class AdminSettings(Base):  # one row (id = 1): the Admin's profile, the organization and notification choices
    __tablename__ = "admin_settings"
    id: Mapped[int] = mapped_column(primary_key=True)
    name: Mapped[str] = mapped_column(String(120), default="Admin")
    email: Mapped[str] = mapped_column(String(160), default="")
    org: Mapped[str] = mapped_column(String(120), default="E-terambere")
    notify_flagged: Mapped[bool] = mapped_column(Boolean, default=True)
    notify_new_report: Mapped[bool] = mapped_column(Boolean, default=False)
    notify_weekly: Mapped[bool] = mapped_column(Boolean, default=True)

class AdminUser(Base):  # who may sign in to the dashboard. Created only by `python -m app.create_admin`; credentials are never in the code
    __tablename__ = "admin_users"
    id: Mapped[int] = mapped_column(primary_key=True)
    email: Mapped[str] = mapped_column(String(254), unique=True, index=True)
    password_hash: Mapped[str] = mapped_column(String(300))  # Argon2id, never the password itself
    token_version: Mapped[int] = mapped_column(default=0)  # raising it signs out every existing session
    is_active: Mapped[bool] = mapped_column(Boolean, default=True)
    created_at: Mapped[datetime] = mapped_column(DateTime, server_default=func.now())
    last_login_at: Mapped[datetime | None] = mapped_column(DateTime, nullable=True)

class LoginAttempt(Base):  # failed sign-ins per email, kept even for emails that don't exist, so attackers learn nothing
    __tablename__ = "login_attempts"
    email: Mapped[str] = mapped_column(String(254), primary_key=True)
    failures: Mapped[int] = mapped_column(default=0)
    locked_until: Mapped[datetime | None] = mapped_column(DateTime, nullable=True)

class ReportEvent(Base):  # the review history of a report: submitted, approved, returned, resubmitted, edited
    __tablename__ = "report_events"
    id: Mapped[int] = mapped_column(primary_key=True)
    report_id: Mapped[int] = mapped_column(ForeignKey("reports.id", ondelete="CASCADE"), index=True)
    action: Mapped[str] = mapped_column(String(20))
    note: Mapped[str | None] = mapped_column(Text, nullable=True)
    by: Mapped[str | None] = mapped_column(String(254), nullable=True)
    at: Mapped[datetime] = mapped_column(DateTime, server_default=func.now())

class Subcontractor(Base):  # added and managed by Admin only; never created from reports
    __tablename__ = "subcontractors"
    id: Mapped[int] = mapped_column(primary_key=True)
    project_id: Mapped[int] = mapped_column(ForeignKey("projects.id", ondelete="CASCADE"), index=True)
    name: Mapped[str] = mapped_column(String(160))
    scope: Mapped[str] = mapped_column(String(300))
    agreed_amount: Mapped[int] = mapped_column(BigInteger)
    start_date: Mapped[date | None] = mapped_column(Date, nullable=True)
    end_date: Mapped[date | None] = mapped_column(Date, nullable=True)
    status: Mapped[str] = mapped_column(String(20), default="Active")
    notes: Mapped[str | None] = mapped_column(Text, nullable=True)
    costs: Mapped[list["SubcontractorCost"]] = relationship(cascade="all, delete-orphan", order_by="SubcontractorCost.cost_date")

class SubcontractorCost(Base):  # the dated cost records that count as spending. The agreed amount itself is never counted as spent
    __tablename__ = "subcontractor_costs"
    id: Mapped[int] = mapped_column(primary_key=True)
    subcontractor_id: Mapped[int] = mapped_column(ForeignKey("subcontractors.id", ondelete="CASCADE"), index=True)
    cost_date: Mapped[date] = mapped_column(Date, index=True)
    description: Mapped[str] = mapped_column(String(200))
    quantity: Mapped[float | None] = mapped_column(Numeric(14, 2), nullable=True)
    unit: Mapped[str | None] = mapped_column(String(20), nullable=True)
    rate: Mapped[int | None] = mapped_column(BigInteger, nullable=True)
    amount: Mapped[int] = mapped_column(BigInteger)
    notes: Mapped[str | None] = mapped_column(Text, nullable=True)

class ProjectRate(Base):  # a rate Admin records for a machine (per hour) or a material (per unit). Reports carry no prices, so none is ever invented
    __tablename__ = "project_rates"
    __table_args__ = (UniqueConstraint("project_id", "kind", "key"),)
    id: Mapped[int] = mapped_column(primary_key=True)
    project_id: Mapped[int] = mapped_column(ForeignKey("projects.id", ondelete="CASCADE"), index=True)
    kind: Mapped[str] = mapped_column(String(12))  # "equipment" or "material"
    key: Mapped[str] = mapped_column(String(160))
    label: Mapped[str] = mapped_column(String(160))
    unit: Mapped[str | None] = mapped_column(String(20), nullable=True)
    rate: Mapped[int] = mapped_column(BigInteger)

class ReportPhoto(Base):  # site progress photos uploaded from the mobile app
    __tablename__ = "report_photos"
    id: Mapped[int] = mapped_column(primary_key=True)
    report_id: Mapped[int] = mapped_column(ForeignKey("reports.id", ondelete="CASCADE"), index=True)
    path: Mapped[str] = mapped_column(String(300))  # relative file path, e.g. uploads/reports/RPT-0001_ab12.jpg
    caption: Mapped[str | None] = mapped_column(String(200), nullable=True)
    created_at: Mapped[datetime] = mapped_column(DateTime, server_default=func.now())
    # The image itself is kept in the database too, because the web host's disk is wiped on every
    # deploy/restart. Deferred, so listing reports never loads the image bytes.
    content_type: Mapped[str | None] = mapped_column(String(50), nullable=True)
    data: Mapped[bytes | None] = mapped_column(LargeBinary, nullable=True, deferred=True)