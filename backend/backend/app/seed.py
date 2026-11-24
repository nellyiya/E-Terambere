"""Fills the database with sample data so the dashboard has something to show.  Run:  python -m app.seed   (add --reset to wipe and refill)"""
import random, sys
from datetime import date, timedelta
from sqlalchemy import select
from .db import Base, SessionLocal, engine
from .costing import mkey, norm
from .models import BoqItem, CostEntry, Project, ProjectRate, Subcontractor, SubcontractorCost, Report, ReportActivity, ReportEquipment, ReportMaterial, ReportWork, ReportWorker, Site, Supervisor

R = random.Random(7)
PEOPLE = ["Eric Mugisha", "Aline Uwase", "Jean Bosco", "Claudine Ineza", "Samuel Habimana", "Grace Mukamana"]
NAMES = [("Nyabarongo Dam", "Muhanga"), ("Kigali Bypass Road", "Gasabo"), ("Musanze Water Plant", "Musanze"), ("Rubavu Bridge", "Rubavu"), ("Huye Market Hall", "Huye"), ("Rwamagana School Block", "Rwamagana"),
         ("Nyagatare Irrigation", "Nyagatare"), ("Muhanga Health Centre", "Muhanga"), ("Kayonza Feeder Road", "Kayonza"), ("Rusizi Water Tank", "Rusizi"), ("Karongi Lakeside Lodge", "Karongi"), ("Bugesera Airport Link", "Bugesera")]
ITEMS = [("Excavation", "m3", 12000), ("Concrete poured", "m3", 85000), ("Steel fixing", "kg", 1800), ("Brickwork", "m2", 14000), ("Roofing", "m2", 22000), ("Plastering", "m2", 6500), ("Formwork", "m2", 9000)]
COSTS = {"Transport": ["Site transport"], "Fuel": ["Diesel invoice"], "Permits": ["Permits and fees"], "Safety": ["Safety gear"], "Site office": ["Office rent"]}  # Other Costs, entered by Admin
WEIGHT = {"Transport": 30, "Fuel": 30, "Permits": 10, "Safety": 15, "Site office": 15}
WAGES = [("Helpers", 3000), ("Masons", 7000), ("Security", 3000), ("Pointeur", 4000), ("Capita", 7000)]
EQUIP = ["Pick up RAF520F", "Excavator 320 (RAH993U)", "Excavator RAC701R", "Camion RAB497D"]

def main(reset: bool):
    if reset:
        Base.metadata.drop_all(bind=engine)
    Base.metadata.create_all(bind=engine)
    with SessionLocal() as db:
        if db.scalar(select(Project.id).limit(1)):
            print("Database already has projects. Use --reset to wipe and refill."); return
        sups = [Supervisor(name=n, email=n.lower().replace(" ", ".") + "@eterambere.demo", phone=f"+25078800{100 + i}") for i, n in enumerate(PEOPLE)]
        db.add_all(sups); db.flush()
        today = date(2026, 11, 14)
        for i, (name, district) in enumerate(NAMES):
            status = ["Active", "Active", "Planning", "Active", "On Hold", "Completed"][i % 6]
            target = 1.0 if status == "Completed" else 0.0 if status == "Planning" else R.uniform(0.15, 0.9)
            items = R.sample(ITEMS, R.randint(4, 6))
            planned = {n: R.randint(40, 400) for n, _, _ in items}
            boq = [BoqItem(item_no=k + 1, description=n, unit=u, quantity=planned[n], rate=int(rate * R.uniform(0.9, 1.15))) for k, (n, u, rate) in enumerate(items)]
            contract = sum(planned[b.description] * b.rate for b in boq)
            p = Project(code=f"TMP-{i}", name=name, district=district, status=status, contract_value=contract, supervisor_id=sups[i % len(sups)].id,
                    project_type=R.choice(["Road construction", "Bridge", "Water supply", "Building"]), client="EDCL", consultant=R.choice(["Studio Rwanda", None]), location=f"{district} District", start_date=date(2026, 1, 5), end_date=date(2027, 3, 31))
            p.sites = [Site(name=f"Site {k}") for k in range(1, R.randint(1, 4) + 1)]
            p.boq_items = boq
            db.add(p); db.flush(); p.code = f"PRJ-{p.id:03d}"
            if target == 0: continue
            for nm in R.sample(EQUIP, 2):  # a hire rate for some machines only, so the sample also shows machines with no rate yet
                db.add(ProjectRate(project_id=p.id, kind="equipment", key=norm(nm), label=nm, unit="hour", rate=R.choice([35000, 45000, 60000])))
            db.add(ProjectRate(project_id=p.id, kind="material", key=mkey("Ciment", "bags"), label="Ciment", unit="bags", rate=12000))
            sub = Subcontractor(project_id=p.id, name=R.choice(["Kigali Electrical Ltd", "Umuhuza Plumbing", "Imena Steelworks"]), scope="Specialist installation works", agreed_amount=int(contract * 0.08), status="Active", start_date=date(2026, 3, 1), end_date=date(2026, 12, 31))
            sub.costs = [SubcontractorCost(cost_date=today - timedelta(days=R.randint(1, 60)), description=f"Interim valuation {n}", amount=int(contract * R.uniform(0.01, 0.025))) for n in (1, 2)]
            db.add(sub)
            n_rep = R.randint(9, 16)
            earned_total = 0
            for k in range(n_rep):
                rep = Report(code=f"TMP-{i}-{k}", project_id=p.id, site_id=R.choice(p.sites).id, supervisor_id=p.supervisor_id, report_date=today - timedelta(days=R.randint(0, 40)),
                             activity=R.choice(boq).description, status=R.choices(["Approved", "Pending", "Returned"], [60, 30, 10])[0])
                db.add(rep); db.flush(); rep.code = f"RPT-{rep.id:04d}"
                if rep.status == "Returned": rep.return_note = "Please check the quantities and resubmit."
                for b in R.sample(boq, R.randint(1, min(3, len(boq)))):
                    q = round(planned[b.description] * target / n_rep * R.uniform(0.6, 1.4), 2)
                    db.add(ReportWork(report_id=rep.id, boq_item_id=b.id, quantity=q)); earned_total += q * b.rate
                for role, wage in R.sample(WAGES, 3):
                    db.add(ReportWorker(report_id=rep.id, role=role, headcount=R.randint(0, 20), daily_wage=wage))
                for nm in R.sample(EQUIP, 2):
                    db.add(ReportEquipment(report_id=rep.id, name=nm, details="Loading trucks", hours=R.randint(0, 8), fuel_received=0, fuel_used=R.randint(0, 20), fuel_balance=R.randint(10, 60)))
                db.add(ReportActivity(report_id=rep.id, description=f"{rep.activity} at CH{R.randint(1, 20)}+{R.randint(100, 900)}"))
                db.add(ReportMaterial(report_id=rep.id, kind="used", name="Ciment", quantity=R.randint(0, 40), unit="bags"))
                rep.start_time, rep.end_time = "07:00", "17:00"
                spend = earned_total / (k + 1) * R.uniform(0.5, 1.0) / 2
                for _ in range(R.randint(2, 3)):
                    cat = R.choices(list(WEIGHT), list(WEIGHT.values()))[0]
                    db.add(CostEntry(project_id=p.id, site_id=rep.site_id, report_id=None, category=cat, description=R.choice(COSTS[cat]), amount=int(spend * R.uniform(0.4, 1.2)) + 1000, cost_date=rep.report_date))
        db.commit()
        print("Seeded: 6 supervisors, 12 projects with sites, bill of quantities, reports and costs.")

if __name__ == "__main__":
    main("--reset" in sys.argv)
