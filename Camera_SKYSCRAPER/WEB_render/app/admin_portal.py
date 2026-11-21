from __future__ import annotations
import os
from pathlib import Path
from fastapi import FastAPI, Form, HTTPException, Request
from fastapi.responses import HTMLResponse, RedirectResponse
from fastapi.staticfiles import StaticFiles
from starlette.middleware.sessions import SessionMiddleware
from starlette.templating import Jinja2Templates
from . import cloud_common as auth

BASE = Path(__file__).resolve().parent.parent
WEB = BASE / "web"
app = FastAPI(title="SKYSCRAPER Admin Portal", version="1.0.0")
secret = os.getenv("ADMIN_SESSION_SECRET")
if not secret or len(secret) < 32:
    raise RuntimeError("ADMIN_SESSION_SECRET must be set to a random value of at least 32 characters.")
app.add_middleware(SessionMiddleware, secret_key=secret, session_cookie="skyscraper_admin_session", same_site="lax", https_only=True, max_age=43200)
app.mount("/static", StaticFiles(directory=WEB), name="static")
templates = Jinja2Templates(directory=WEB)

@app.on_event("startup")
def startup():
    auth.init_db()
    auth.bootstrap_admin()

def admin_user(request: Request):
    uid = request.session.get("user_id")
    if not uid:
        raise HTTPException(401, "Administrator sign-in required.")
    with auth.connect() as con:
        row = con.execute("SELECT id,username,role FROM users WHERE id=%s", (uid,)).fetchone()
    if not row or row["role"] != "admin":
        request.session.clear()
        raise HTTPException(403, "Administrator permission required.")
    return row

@app.get("/", response_class=HTMLResponse)
def home(request: Request):
    if request.session.get("user_id"):
        try:
            admin_user(request)
            return RedirectResponse("/manage", status_code=303)
        except HTTPException:
            pass
    return templates.TemplateResponse(request=request, name="admin.html", context={})

@app.post("/api/login")
def login(request: Request, username: str = Form(...), password: str = Form(...)):
    with auth.connect() as con:
        row = con.execute("SELECT id,username,salt,password_hash,role FROM users WHERE username=%s", (username.strip(),)).fetchone()
    if not row or row["role"] != "admin" or not auth.verify_and_upgrade(row, password):
        raise HTTPException(401, "Invalid administrator credentials.")
    request.session.clear()
    request.session.update({"user_id": row["id"], "user": row["username"]})
    return {"ok": True, "redirect": "/manage"}

@app.post("/api/logout")
def logout(request: Request):
    request.session.clear()
    return {"ok": True, "redirect": "/"}

@app.get("/manage", response_class=HTMLResponse)
def manage(request: Request):
    user = admin_user(request)
    return templates.TemplateResponse(request=request, name="admin.html", context={"admin_username": user["username"], "authenticated": True})

@app.get("/api/admin/users")
def list_users(request: Request):
    admin_user(request)
    with auth.connect() as con:
        rows = con.execute("SELECT id,username,phone_e164,role,created_at FROM users ORDER BY created_at").fetchall()
    return [{"id": r["id"], "username": r["username"], "phone_e164": r["phone_e164"], "role": r["role"], "created_at": r["created_at"].isoformat()} for r in rows]

@app.post("/api/admin/users")
def create_customer(request: Request, username: str = Form(...), password: str = Form(...), country_code: str = Form("91"), phone: str = Form("")):
    admin_user(request)
    username = username.strip()
    if len(username) < 3 or len(password) < 10:
        raise HTTPException(400, "Username must be at least 3 characters and password at least 10 characters.")
    phone_e164 = auth.normalize_phone_e164(country_code, phone) if phone.strip() else None
    salt, digest = auth.make_password(password)
    try:
        with auth.connect() as con:
            con.execute("INSERT INTO users(username,salt,password_hash,phone_e164,role) VALUES(%s,%s,%s,%s,'customer')", (username, salt, digest, phone_e164))
    except Exception as exc:
        if getattr(exc, "sqlstate", None) == "23505":
            raise HTTPException(409, "Username or mobile number already exists.")
        raise
    return {"ok": True, "message": "Customer account created."}

@app.delete("/api/admin/users/{username}")
def delete_customer(username: str, request: Request):
    admin_user(request)
    with auth.connect() as con:
        result = con.execute("DELETE FROM users WHERE username=%s AND role='customer'", (username.strip(),))
    if result.rowcount == 0:
        raise HTTPException(404, "Customer not found. Administrator accounts cannot be deleted here.")
    return {"ok": True, "message": f"Customer '{username}' deleted."}

@app.get("/health")
def health():
    with auth.connect() as con:
        con.execute("SELECT 1")
    return {"ok": True, "service": "admin-portal", "database": "connected"}
