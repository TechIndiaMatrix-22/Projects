from __future__ import annotations
import os
import json
import re
import urllib.request
import urllib.error
from pathlib import Path
from fastapi import FastAPI, Form, HTTPException, Request
from fastapi.responses import HTMLResponse, RedirectResponse
from fastapi.staticfiles import StaticFiles
from starlette.middleware.sessions import SessionMiddleware
from starlette.templating import Jinja2Templates
from . import cloud_common as auth

BASE = Path(__file__).resolve().parent.parent
WEB = BASE / "web"
app = FastAPI(title="SKYSCRAPER Customer Portal", version="1.0.0")
secret = os.getenv("CUSTOMER_SESSION_SECRET")
if not secret or len(secret) < 32:
    raise RuntimeError("CUSTOMER_SESSION_SECRET must be set to a random value of at least 32 characters.")
app.add_middleware(SessionMiddleware, secret_key=secret, session_cookie="skyscraper_customer_session", same_site="lax", https_only=True, max_age=43200)
app.mount("/static", StaticFiles(directory=WEB), name="static")
templates = Jinja2Templates(directory=WEB)

@app.on_event("startup")
def startup():
    auth.init_db()
    auth.bootstrap_admin()

def signed_in(request: Request):
    user_id = request.session.get("user_id")

    if not user_id:
        request.session.clear()
        return None

    with auth.connect() as con:
        user = con.execute(
            """
            SELECT id, username, role
            FROM users
            WHERE id = %s
            """,
            (user_id,)
        ).fetchone()

    if not user:
        request.session.clear()
        request.state.deleted_customer = True
        return None

    return user

@app.get("/", response_class=HTMLResponse)
def home(request: Request):
    user = signed_in(request)
    if user:
        return RedirectResponse("/dashboard", status_code=303)
    if getattr(request.state, "deleted_customer", False):
        return RedirectResponse("/?register=1", status_code=303)
    return templates.TemplateResponse(request=request, name="index.html", context={"msg91_widget_config": {"widgetId": os.getenv("MSG91_WIDGET_ID", ""), "tokenAuth": os.getenv("MSG91_WIDGET_TOKEN_AUTH", "")}})

@app.post("/api/register")
def register(username: str = Form(...), password: str = Form(...), country_code: str = Form(...), phone: str = Form(...)):
    username = username.strip()
    if len(username) < 3 or len(username) > 64 or len(password) < 10:
        raise HTTPException(400, "Username must be 3–64 characters and password at least 10 characters.")
    try:
        phone_e164 = auth.normalize_phone_e164(country_code, phone)
    except ValueError as exc:
        raise HTTPException(400, str(exc))
    salt, digest = auth.make_password(password)
    try:
        with auth.connect() as con:
            con.execute("INSERT INTO users(username,salt,password_hash,phone_e164,role) VALUES(%s,%s,%s,%s,'customer')",
                        (username, salt, digest, phone_e164))
    except Exception as exc:
        if getattr(exc, "sqlstate", None) == "23505":
            raise HTTPException(409, "Username or mobile number already exists.")
        raise
    return {"ok": True, "message": "Customer account created. Please sign in."}

@app.post("/api/login")
def login(request: Request, username: str = Form(...), password: str = Form(...)):
    with auth.connect() as con:
        row = con.execute("SELECT id,username,salt,password_hash,role FROM users WHERE username=%s", (username.strip(),)).fetchone()
    if not row or not auth.verify_and_upgrade(row, password):
        raise HTTPException(401, "Invalid username or password.")
    # Even an administrator logging into this portal receives customer-only privileges.
    request.session.clear()
    request.session.update({"user_id": row["id"], "user": row["username"], "portal_role": "customer"})
    return {"ok": True, "redirect": "/dashboard"}


def _find_verified_identifier(value):
    if isinstance(value, dict):
        message = value.get("message")
        if isinstance(message, (str, int)) and str(message).strip().isdigit():
            return str(message).strip()
        for key in ("mobile", "phone", "phone_number", "identifier", "user_id"):
            candidate = value.get(key)
            if isinstance(candidate, (str, int)) and str(candidate).strip():
                return str(candidate).strip()
        for child in value.values():
            found = _find_verified_identifier(child)
            if found:
                return found
    elif isinstance(value, list):
        for child in value:
            found = _find_verified_identifier(child)
            if found:
                return found
    return None

@app.post("/api/msg91/verify")
async def msg91_verify(request: Request):
    authkey = os.getenv("MSG91_AUTHKEY", "").strip()
    verify_url = os.getenv("MSG91_VERIFY_URL", "https://control.msg91.com/api/v5/widget/verifyAccessToken").strip()
    if not authkey:
        raise HTTPException(503, "SMS verification is not configured on the server.")
    try:
        payload = await request.json()
    except Exception:
        raise HTTPException(400, "Invalid request.")
    access_token = str(payload.get("access_token", "")).strip()
    if not access_token or len(access_token) > 4096:
        raise HTTPException(400, "MSG91 access token is missing or invalid.")
    body = json.dumps({"authkey": authkey, "access-token": access_token}).encode("utf-8")
    req = urllib.request.Request(verify_url, data=body, headers={"Content-Type": "application/json", "Accept": "application/json"}, method="POST")
    try:
        with urllib.request.urlopen(req, timeout=12) as response:
            result = json.loads(response.read().decode("utf-8"))
    except (urllib.error.HTTPError, urllib.error.URLError, TimeoutError, json.JSONDecodeError):
        raise HTTPException(401, "MSG91 token verification failed.")
    if not isinstance(result, dict) or str(result.get("type", "")).lower() not in ("success", "successfully"):
        raise HTTPException(401, "MSG91 did not verify this access token.")
    identifier = _find_verified_identifier(result)
    digits = re.sub(r"\D", "", identifier or "")
    if not digits:
        raise HTTPException(401, "MSG91 did not return a verified mobile number.")
    with auth.connect() as con:
        row = con.execute("SELECT id,username FROM users WHERE phone_e164=%s", (digits,)).fetchone()
    if not row:
        raise HTTPException(403, "This mobile number is not registered in SKYSCRAPER.")
    request.session.clear()
    request.session.update({"user_id": row["id"], "user": row["username"], "portal_role": "customer"})
    return {"ok": True, "redirect": "/dashboard"}

@app.post("/api/logout")
def logout(request: Request):
    request.session.clear()
    return {"ok": True, "redirect": "/"}

@app.get("/dashboard", response_class=HTMLResponse)
def dashboard(request: Request):
    user = signed_in(request)

    if not user:
        if getattr(request.state, "deleted_customer", False):
            return RedirectResponse("/?register=1", status_code=303)
        return RedirectResponse("/", status_code=303)

    return templates.TemplateResponse(
        request=request,
        name="dashboard.html",
        context={"username": user["username"]}
    )
@app.get("/api/status")
def status(request: Request):
    user = signed_in(request)

    if not user:
        raise HTTPException(401, "Please sign in.")

    return {
        "camera": "OFFLINE",
        "device_online": False,
        "message": "Cloud portal is available; Raspberry Pi connection is not configured yet."
    }
@app.get("/health")
def health():
    with auth.connect() as con:
        con.execute("SELECT 1")
    return {"ok": True, "service": "customer-portal", "database": "connected"}
