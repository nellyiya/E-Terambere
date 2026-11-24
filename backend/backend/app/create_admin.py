"""Create the Admin sign-in (or reset its password).  Run:  python -m app.create_admin
The email and password are typed here and stored only as an Argon2 hash. They are never written in code, .env or any file."""
import argparse
import getpass
import sys
from sqlalchemy import select
from .db import Base, SessionLocal, engine
from . import models  # noqa: F401
from .models import AdminUser
from .security import clean_email, hash_password, password_problems

def main() -> None:
    ap = argparse.ArgumentParser(description="Create or reset the Admin sign-in.")
    ap.add_argument("--skip-dns-check", action="store_true", help="only check the email's format, not that its domain can receive mail (use when offline)")
    args = ap.parse_args()
    try:
        email = clean_email(input("Admin email: "), check_dns=not args.skip_dns_check)
    except ValueError as e:
        sys.exit(f"That email can't be used: {e}\nUse a complete, real address like name@company.com (add --skip-dns-check if you are offline).")
    pw, again = getpass.getpass("Password (typing is hidden): "), getpass.getpass("Type the password again: ")
    if pw != again:
        sys.exit("The two passwords are not the same. Nothing was saved.")
    problems = password_problems(pw, email)
    if problems:
        sys.exit("That password is not strong enough. It needs: " + "; ".join(problems) + ". Nothing was saved.")
    Base.metadata.create_all(bind=engine)
    with SessionLocal() as db:
        user = db.scalar(select(AdminUser).where(AdminUser.email == email))
        if user:
            if input(f"{email} already exists. Reset its password? [y/N] ").strip().lower() != "y":
                sys.exit("Nothing was changed.")
            user.password_hash, user.is_active = hash_password(pw), True
            user.token_version += 1  # everyone signed in with the old password is signed out
            print("Password reset. All existing sessions were signed out.")
        else:
            db.add(AdminUser(email=email, password_hash=hash_password(pw)))
            print(f"Admin created: {email}")
        db.commit()

if __name__ == "__main__":
    main()
