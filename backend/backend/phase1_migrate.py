"""
Phase 1 pre-migration script.
1. Backs up the supervisors table to supervisors_backup.json
2. Backfills NULL code values (SUP-001, SUP-002, ...)
Run once before starting the backend with the new supervisor_auth router.
"""
import json
import psycopg

DB = 'postgresql://postgres:Terambere123!@localhost:5432/E-terambere_db'

conn = psycopg.connect(DB)
cur = conn.cursor()

# 1. Backup
cur.execute("SELECT id, code, name, email, phone, active, password_hash FROM supervisors ORDER BY id")
cols = [d[0] for d in cur.description]
rows = [dict(zip(cols, r)) for r in cur.fetchall()]
with open("supervisors_backup.json", "w") as f:
    json.dump(rows, f, indent=2, default=str)
print(f"Backed up {len(rows)} supervisor(s) to supervisors_backup.json")

# 2. Backfill NULL codes
cur.execute("SELECT id FROM supervisors WHERE code IS NULL ORDER BY id")
null_ids = [r[0] for r in cur.fetchall()]
if null_ids:
    # Get current max count to assign codes without gaps
    cur.execute("SELECT COUNT(*) FROM supervisors")
    total = cur.fetchone()[0]
    # Assign codes based on row order (oldest id = SUP-001)
    cur.execute("SELECT id FROM supervisors ORDER BY id")
    all_ids = [r[0] for r in cur.fetchall()]
    for i, sid in enumerate(all_ids, start=1):
        code = f"SUP-{i:03d}"
        cur.execute("UPDATE supervisors SET code = %s WHERE id = %s AND code IS NULL", (code, sid))
    conn.commit()
    print(f"Backfilled codes for {len(null_ids)} supervisor(s)")
else:
    print("All supervisors already have codes")

# 3. Verify
cur.execute("SELECT id, code, name, email, active FROM supervisors ORDER BY id")
for r in cur.fetchall():
    print(r)

conn.close()
