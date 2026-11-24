import os
import re
from datetime import datetime, timedelta, timezone
import jwt
from argon2 import PasswordHasher
from argon2.exceptions import InvalidHashError, VerificationError
from email_validator import EmailNotValidError, validate_email
ISSUER = "eterambere-admin"
_ph = PasswordHasher()
_DUMMY = _ph.hash("not-a-real-password-used-only-to-keep-timing-equal")
LEET = str.maketrans("013457@$!", "oleastasi")
BAD_WORDS = ("password", "qwerty", "123456", "admin", "letmein", "welcome", "eterambere", "terambere")

def jwt_secret() -> str:
    s = os.getenv("JWT_SECRET", "")
    if len(s) < 32:
        raise RuntimeError('JWT_SECRET is missing or shorter than 32 characters. Generate one with: python -c "import secrets; print(secrets.token_urlsafe(48))" and put it in .env as JWT_SECRET=...')
    return s

def token_minutes() -> int:
    return max(5, int(os.getenv("ACCESS_TOKEN_MINUTES", "60")))

def clean_email(raw: str, check_dns: bool = False) -> str:
    """A complete, correctly formed address (name@domain.tld). With check_dns the domain must also be able to receive mail."""
    try:
        v = validate_email(raw.strip(), check_deliverability=check_dns)
    except EmailNotValidError as e:
        raise ValueError(str(e)) from None
    if len(v.normalized) > 254:
        raise ValueError("The email address is too long.")
    return v.normalized.lower()

def password_problems(pw: str, email: str = "") -> list[str]:
    p = []
    if len(pw) < 12: p.append("at least 12 characters")
    if len(pw) > 128: p.append("at most 128 characters")
    if not re.search(r"[a-z]", pw): p.append("a lowercase letter")
    if not re.search(r"[A-Z]", pw): p.append("an uppercase letter")
    if not re.search(r"\d", pw): p.append("a number")
    if not re.search(r"[^A-Za-z0-9]", pw): p.append("a symbol such as ! @ # ?")
    if re.search(r"(.)\1{2,}", pw, re.IGNORECASE): p.append("no character repeated 3 times in a row")
    if re.fullmatch(r"(.{3,}?)\1+", pw): p.append("no pattern that just repeats")
    low = pw.lower()
    plain = low.translate(LEET)  # catches tricks like P@ssw0rd
    if any(w in low or w in plain for w in BAD_WORDS): p.append("no common words such as 'password' or 'admin'")
    local = email.split("@")[0].lower()
    if len(local) >= 4 and local in low: p.append("must not contain your email name")
    return p

def hash_password(pw: str) -> str:
    return _ph.hash(pw)

def verify_password(stored: str | None, pw: str) -> bool:
    """Always does the same amount of work, even when the account doesn't exist."""
    try:
        return _ph.verify(stored or _DUMMY, pw) and stored is not None
    except (VerificationError, InvalidHashError):
        return False

def now() -> datetime:
    return datetime.now(timezone.utc).replace(tzinfo=None)

def create_token(user_id: int, email: str, token_version: int) -> tuple[str, int]:
    minutes = token_minutes()
    t = datetime.now(timezone.utc)
    return jwt.encode({"sub": str(user_id), "email": email, "tv": token_version, "iss": ISSUER, "iat": t, "exp": t + timedelta(minutes=minutes)}, jwt_secret(), algorithm="HS256"), minutes * 60

def decode_token(token: str) -> dict:
    return jwt.decode(token, jwt_secret(), algorithms=["HS256"], issuer=ISSUER, options={"require": ["exp", "sub", "iss", "tv"]})
