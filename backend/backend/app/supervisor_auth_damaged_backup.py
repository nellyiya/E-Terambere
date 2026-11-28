@router.post("/reports", status_code=201)
def supervisor_create_report(
    request: Request,
    body: SupervisorReportIn,
    sup: Supervisor = Depends(get_current_supervisor),
    db: Session = Depends(get_db),
):
    """Create a new daily report.
    Prevent duplicate reports for the same supervisor, project, site and date.
    """
    assignments = db.scalars(
        select(ProjectSupervisor).where(ProjectSupervisor.supervisor_id == sup.id)
    ).all()

    if not assignments:
        raise HTTPException(
            403,
            "No project is assigned to you. Contact your administrator."
        )

    if len(assignments) == 1:
        p = db.get(Project, assignments[0].project_id)
    else:
        assigned = [
            x for x in (db.get(Project, a.project_id) for a in assignments) if x
        ]
        wanted = (body.project or "").strip().lower()

        p = next(
            (
                x for x in assigned
                if wanted and wanted in (x.code.lower(), x.name.lower())
            ),
            None,
        )

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
        raise HTTPException(
            404,
            f"This site does not belong to the project. Sites: "
            f"{', '.join(site_names) or 'none'}"
        )

    if body.report_date > date.today() + timedelta(days=1):
        raise HTTPException(
            422,
            "report_date: a report can't be dated in the future."
        )

    # Prevent duplicate reports for the same supervisor, project, site and date.
    existing_report = db.scalar(
        select(Report).where(
            Report.supervisor_id == sup.id,
            Report.project_id == p.id,
            Report.site_id == site.id,
            Report.report_date == body.report_date,
        )
    )

    if existing_report:
        raise HTTPException(
            status_code=409,
            detail=(
                f"You already have a report for {site.name} on "
                f"{body.report_date.isoformat()}. "
                "Please edit your existing report instead."
            ),
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

    log_event(db, r, "submitted", sup.email)
    save_supervisor_report_lines(db, r, body)

    db.commit()
    db.refresh(r)

    return _report_detail(db, r, _base(request))