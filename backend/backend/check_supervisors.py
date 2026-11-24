import psycopg
conn = psycopg.connect('postgresql://postgres:Terambere123!@localhost:5432/E-terambere_db')
cur = conn.cursor()

# Backup: dump supervisor rows
cur.execute("""
    SELECT id, code, name, email, active,
           CASE
             WHEN password_hash IS NULL THEN 'no-password'
             WHEN password_hash LIKE 'pbkdf2$%' THEN 'pbkdf2-weak'
             WHEN password_hash LIKE '$argon2%' THEN 'argon2-ok'
             ELSE 'unknown'
           END as hash_type
    FROM supervisors ORDER BY id
""")
rows = cur.fetchall()
print(f"Supervisors: {len(rows)}")
for r in rows:
    print(r)

conn.close()
