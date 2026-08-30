#!/usr/bin/env python3
"""QueenDar origin API — cloudit2 Postgres, GPS radar, SOS, encrypted journal."""
from http.server import BaseHTTPRequestHandler, ThreadingHTTPServer
import base64
import hashlib
import hmac
import json
import math
import os
import re
import sqlite3
import threading
import time
import unicodedata
import uuid
import urllib.error
import urllib.parse
import urllib.request
from datetime import datetime, timedelta, timezone
from pathlib import Path
from urllib.parse import parse_qs, urlparse

CODER = os.environ.get("AI_CODER_URL", "http://127.0.0.1:18001/v1").rstrip("/")
VL = os.environ.get("AI_VL_URL", "http://127.0.0.1:18000/v1").rstrip("/")
CODER_MODEL = os.environ.get("AI_CODER_MODEL", "nemotron-3.5-lightning:latest")
VL_MODEL = os.environ.get("AI_VL_MODEL", "Qwen3-VL-30B-A3B-Instruct-FP8")
TIMEOUT = int(os.environ.get("AI_TIMEOUT_SEC", "90"))
PUBLIC_URL = (os.environ.get("QUEENDAR_PUBLIC_URL") or "https://queendar.com").rstrip("/")


def load_env():
    for path in (
        Path("/opt/queendar-portal/.env"),
        Path("/opt/queendar/.env"),
        Path("/root/empire-db/catalog.env"),
    ):
        if not path.is_file():
            continue
        for line in path.read_text().splitlines():
            if "=" in line and not line.lstrip().startswith("#"):
                key, value = line.split("=", 1)
                os.environ.setdefault(key.strip(), value.strip().strip('"').strip("'"))


def persist_secret(key, value):
    path = Path("/opt/queendar/.env")
    try:
        path.parent.mkdir(parents=True, exist_ok=True)
        text = path.read_text() if path.is_file() else ""
        lines = [ln for ln in text.splitlines() if not ln.startswith(f"{key}=")]
        lines.append(f"{key}={value}")
        path.write_text("\n".join(lines).rstrip() + "\n")
        path.chmod(0o600)
    except OSError:
        pass


load_env()
OWNER_USER = (os.environ.get("OWNER_USER") or "dannygc").strip()
OWNER_PASS = (os.environ.get("OWNER_PASS") or "").strip().strip('"').strip("'")
OWNER_EMAIL = (os.environ.get("OWNER_EMAIL") or "dannyknightgc78@gmail.com").strip().lower()
ALIASES = {
    OWNER_USER.lower(),
    OWNER_EMAIL,
    f"{OWNER_USER.lower()}@queendar.com",
    "dannyknightgc78@gmail.com",
}
if not os.environ.get("QUEENDAR_TOKEN_SECRET"):
    secret = os.urandom(32).hex()
    os.environ["QUEENDAR_TOKEN_SECRET"] = secret
    persist_secret("QUEENDAR_TOKEN_SECRET", secret)
if not os.environ.get("QUEENDAR_JOURNAL_KEY"):
    jkey = os.urandom(32).hex()
    os.environ["QUEENDAR_JOURNAL_KEY"] = jkey
    persist_secret("QUEENDAR_JOURNAL_KEY", jkey)
TOKEN_SECRET = os.environ["QUEENDAR_TOKEN_SECRET"]
JOURNAL_KEY = os.environ["QUEENDAR_JOURNAL_KEY"]
STRIPE_SECRET = (os.environ.get("STRIPE_SECRET_KEY") or os.environ.get("STRIPE_SECRET") or "").strip()
TWILIO_SID = (os.environ.get("TWILIO_ACCOUNT_SID") or os.environ.get("QUEENDAR_TWILIO_SID") or "").strip()
TWILIO_TOKEN = (os.environ.get("TWILIO_AUTH_TOKEN") or os.environ.get("QUEENDAR_TWILIO_TOKEN") or "").strip()
TWILIO_FROM = (os.environ.get("TWILIO_FROM") or os.environ.get("QUEENDAR_TWILIO_FROM") or "").strip()
DATABASE_URL = (os.environ.get("QUEENDAR_DATABASE_URL") or os.environ.get("DATABASE_URL") or "").strip()
USE_PG = DATABASE_URL.startswith("postgres")
DB_PATH = Path("/opt/queendar/data/queendar.sqlite")

SCHEMA = [
    """CREATE TABLE IF NOT EXISTS users (
          id TEXT PRIMARY KEY, username TEXT UNIQUE NOT NULL, email TEXT UNIQUE,
          password_hash TEXT NOT NULL, premium TEXT DEFAULT 'free',
          bio TEXT DEFAULT '', avatar_url TEXT DEFAULT '',
          reset_token TEXT, reset_expires TEXT, created_at TEXT NOT NULL)""",
    """CREATE TABLE IF NOT EXISTS crown_logs (
          id TEXT PRIMARY KEY, user_id TEXT NOT NULL, title TEXT NOT NULL,
          body TEXT NOT NULL, mood TEXT DEFAULT '', location TEXT DEFAULT '',
          created_at TEXT NOT NULL)""",
    """CREATE TABLE IF NOT EXISTS scans (
          id TEXT PRIMARY KEY, user_id TEXT NOT NULL, venue_name TEXT NOT NULL,
          safety_rating INTEGER, green_flags TEXT DEFAULT '[]',
          yellow_flags TEXT DEFAULT '[]', summary TEXT DEFAULT '',
          stars INTEGER DEFAULT 0, created_at TEXT NOT NULL)""",
    """CREATE TABLE IF NOT EXISTS contacts (
          id TEXT PRIMARY KEY, user_id TEXT NOT NULL, name TEXT NOT NULL,
          phone TEXT DEFAULT '', note TEXT DEFAULT '', created_at TEXT NOT NULL)""",
    """CREATE TABLE IF NOT EXISTS checkins (
          id TEXT PRIMARY KEY, user_id TEXT NOT NULL, kind TEXT NOT NULL,
          lat REAL, lng REAL, message TEXT DEFAULT '', created_at TEXT NOT NULL)""",
    """CREATE TABLE IF NOT EXISTS incidents (
          id TEXT PRIMARY KEY, user_id TEXT NOT NULL, kind TEXT NOT NULL,
          note TEXT DEFAULT '', lat REAL NOT NULL, lng REAL NOT NULL,
          confirms INTEGER DEFAULT 1, created_at TEXT NOT NULL)""",
    """CREATE TABLE IF NOT EXISTS incident_votes (
          incident_id TEXT NOT NULL, user_id TEXT NOT NULL,
          PRIMARY KEY (incident_id, user_id))""",
    """CREATE TABLE IF NOT EXISTS watches (
          id TEXT PRIMARY KEY, user_id TEXT NOT NULL, until_ms BIGINT NOT NULL,
          lat REAL, lng REAL, phone TEXT DEFAULT '', status TEXT DEFAULT 'armed',
          created_at TEXT NOT NULL, fired_at TEXT)""",
]


class DB:
    def __init__(self):
        if USE_PG:
            import psycopg2
            from psycopg2.extras import RealDictCursor

            self.conn = psycopg2.connect(DATABASE_URL, connect_timeout=8)
            self.pg = True
            self._cur_factory = RealDictCursor
        else:
            DB_PATH.parent.mkdir(parents=True, exist_ok=True)
            self.conn = sqlite3.connect(DB_PATH)
            self.conn.row_factory = sqlite3.Row
            self.pg = False
            self._cur_factory = None
        for stmt in SCHEMA:
            self.execute(stmt)
        self._migrate()
        self.commit()

    def _migrate(self):
        extras = {
            "users": [
                ("bio", "TEXT DEFAULT ''"),
                ("avatar_url", "TEXT DEFAULT ''"),
                ("reset_token", "TEXT"),
                ("reset_expires", "TEXT"),
                ("ice_name", "TEXT DEFAULT ''"),
                ("ice_phone", "TEXT DEFAULT ''"),
                ("ice_relation", "TEXT DEFAULT ''"),
                ("ice_conditions", "TEXT DEFAULT ''"),
                ("ice_allergies", "TEXT DEFAULT ''"),
                ("ice_meds", "TEXT DEFAULT ''"),
                ("ice_blood", "TEXT DEFAULT ''"),
                ("ice_notes", "TEXT DEFAULT ''"),
            ]
        }
        for table, cols in extras.items():
            for name, decl in cols:
                try:
                    if self.pg:
                        self.execute(f"ALTER TABLE {table} ADD COLUMN IF NOT EXISTS {name} {decl}")
                    else:
                        self.execute(f"ALTER TABLE {table} ADD COLUMN {name} {decl}")
                    self.commit()
                except Exception:
                    if self.pg:
                        self.conn.rollback()

    def execute(self, query, args=()):
        if self.pg:
            cur = self.conn.cursor(cursor_factory=self._cur_factory)
            cur.execute(query.replace("?", "%s"), args)
            return cur
        return self.conn.execute(query, args)

    def fetchone(self, query, args=()):
        row = self.execute(query, args).fetchone()
        return dict(row) if row else None

    def fetchall(self, query, args=()):
        return [dict(r) for r in self.execute(query, args).fetchall()]

    def commit(self):
        self.conn.commit()

    def close(self):
        self.conn.close()


def db():
    return DB()


def hash_password(password, salt=None):
    salt = salt or os.urandom(16).hex()
    digest = hashlib.pbkdf2_hmac("sha256", password.encode(), salt.encode(), 120000).hex()
    return f"{salt}:{digest}"


def verify_password(password, stored):
    try:
        salt, digest = str(stored).split(":", 1)
    except ValueError:
        return False
    check = hashlib.pbkdf2_hmac("sha256", password.encode(), salt.encode(), 120000).hex()
    return hmac.compare_digest(check, digest)


def _stream_key(key, iv, i):
    return hmac.new(key, iv + i.to_bytes(8, "big"), hashlib.sha256).digest()


def encrypt_text(plain, user_id):
    raw = (plain or "").encode()
    key = hashlib.pbkdf2_hmac("sha256", JOURNAL_KEY.encode(), str(user_id).encode(), 80000, 32)
    iv = os.urandom(16)
    out = bytearray()
    for i in range(0, len(raw), 32):
        block = _stream_key(key, iv, i // 32)
        chunk = raw[i : i + 32]
        out.extend(bytes(a ^ b for a, b in zip(chunk, block[: len(chunk)])))
    tag = hmac.new(key, iv + bytes(out), hashlib.sha256).digest()[:16]
    return "qd1:" + base64.b64encode(iv + tag + bytes(out)).decode()


def decrypt_text(blob, user_id):
    text = blob or ""
    if not text.startswith("qd1:"):
        return text
    try:
        raw = base64.b64decode(text[4:])
        iv, tag, data = raw[:16], raw[16:32], raw[32:]
        key = hashlib.pbkdf2_hmac("sha256", JOURNAL_KEY.encode(), str(user_id).encode(), 80000, 32)
        expect = hmac.new(key, iv + data, hashlib.sha256).digest()[:16]
        if not hmac.compare_digest(expect, tag):
            return "[decrypt failed]"
        out = bytearray()
        for i in range(0, len(data), 32):
            block = _stream_key(key, iv, i // 32)
            chunk = data[i : i + 32]
            out.extend(bytes(a ^ b for a, b in zip(chunk, block[: len(chunk)])))
        return out.decode()
    except Exception:
        return "[decrypt failed]"


def make_token(user_id):
    exp = int(time.time()) + 60 * 24 * 3600
    payload = f"{user_id}.{exp}"
    sig = hmac.new(TOKEN_SECRET.encode(), payload.encode(), hashlib.sha256).hexdigest()
    return f"qd2.{payload}.{sig}"


def parse_token(token):
    try:
        kind, user_id, exp, sig = (token or "").split(".", 3)
        if kind != "qd2":
            return None
        payload = f"{user_id}.{exp}"
        expect = hmac.new(TOKEN_SECRET.encode(), payload.encode(), hashlib.sha256).hexdigest()
        if not hmac.compare_digest(expect, sig):
            return None
        if int(exp) < time.time():
            return None
        return user_id
    except (ValueError, TypeError):
        return None


def ice_card(row):
    row = row or {}
    uid = row.get("id") or ""
    def field(key, n):
        return decrypt_text(row.get(key) or "", uid)[:n]
    return {
        "name": field("ice_name", 80),
        "phone": field("ice_phone", 40),
        "relation": field("ice_relation", 40),
        "conditions": field("ice_conditions", 200),
        "allergies": field("ice_allergies", 200),
        "meds": field("ice_meds", 200),
        "bloodType": field("ice_blood", 16),
        "notes": field("ice_notes", 280),
    }


def ice_text(row):
    ice = ice_card(row)
    parts = []
    if ice["name"] or ice["phone"]:
        rel = f" ({ice['relation']})" if ice["relation"] else ""
        parts.append(f"ICE: {ice['name']} {ice['phone']}{rel}".strip())
    if ice["conditions"]:
        parts.append("Conditions: " + ice["conditions"])
    if ice["allergies"]:
        parts.append("Allergies: " + ice["allergies"])
    if ice["meds"]:
        parts.append("Meds: " + ice["meds"])
    if ice["bloodType"]:
        parts.append("Blood: " + ice["bloodType"])
    if ice["notes"]:
        parts.append(ice["notes"])
    return " | ".join(p for p in parts if p)


def sms_backend():
    return bool(TWILIO_SID and TWILIO_TOKEN and TWILIO_FROM)


def send_twilio(phone, body):
    to = re.sub(r"[^\d+]", "", phone or "")
    if not to or not sms_backend():
        return False
    if not to.startswith("+"):
        to = "+" + to
    data = urllib.parse.urlencode({"To": to, "From": TWILIO_FROM, "Body": body[:1400]}).encode()
    req = urllib.request.Request(
        f"https://api.twilio.com/2010-04-01/Accounts/{TWILIO_SID}/Messages.json",
        data=data,
        method="POST",
    )
    token = base64.b64encode(f"{TWILIO_SID}:{TWILIO_TOKEN}".encode()).decode()
    req.add_header("Authorization", f"Basic {token}")
    with urllib.request.urlopen(req, timeout=12) as res:
        return res.status in (200, 201)


def fire_watch(row):
    user = find_user_id(row["user_id"])
    lat_f = row.get("lat")
    lng_f = row.get("lng")
    maps = f"https://maps.google.com/?q={lat_f},{lng_f}" if lat_f is not None and lng_f is not None else ""
    em = emergency_for(lat_f, lng_f)
    medical = ice_text(user) if user else ""
    message = " ".join(
        p for p in [
            "QUEENDAR SOS — check-in timer ended. Please check on me.",
            maps,
            f"Local emergency {em.get('primary')} ({em.get('country') or ''})".strip(),
            medical,
        ] if p
    )
    now = datetime.now(timezone.utc).isoformat()
    sent = False
    phone = str(row.get("phone") or "").strip()
    if phone:
        try:
            sent = send_twilio(phone, message)
        except Exception as exc:
            print(f"queendar twilio failed: {exc}", flush=True)
    status = "fired_backend" if sent else "pending_client"
    conn = db()
    conn.execute(
        "UPDATE watches SET status = ?, fired_at = ? WHERE id = ? AND status = 'armed'",
        (status, now, row["id"]),
    )
    conn.execute(
        "INSERT INTO checkins (id, user_id, kind, lat, lng, message, created_at) VALUES (?,?,?,?,?,?,?)",
        (str(uuid.uuid4()), row["user_id"], "sos", lat_f, lng_f, message[:800], now),
    )
    conn.commit()
    conn.close()
    return status


def sweep_watches():
    now_ms = int(time.time() * 1000)
    conn = db()
    rows = conn.fetchall("SELECT * FROM watches WHERE status = 'armed' AND until_ms <= ?", (now_ms,))
    conn.close()
    for row in rows:
        try:
            fire_watch(row)
        except Exception as exc:
            print(f"queendar watch fire failed: {exc}", flush=True)


def watch_loop():
    while True:
        time.sleep(8)
        try:
            sweep_watches()
        except Exception as exc:
            print(f"queendar watch sweep: {exc}", flush=True)


def user_payload(row, token=None):
    if not row:
        return {
            "id": "owner",
            "username": OWNER_USER,
            "email": OWNER_EMAIL,
            "premium": "lifetime",
            "isPlus": True,
            "bio": "",
            "avatar_url": "",
            "ice": ice_card({}),
        }
    premium = row.get("premium") or "free"
    out = {
        "id": row["id"],
        "username": row["username"],
        "email": row.get("email") or "",
        "premium": premium,
        "isPlus": premium in ("lifetime", "plus", "pro"),
        "bio": row.get("bio") or "",
        "avatar_url": row.get("avatar_url") or "",
        "ice": ice_card(row),
    }
    if token:
        out["token"] = token
    return out


def fold_login(value):
    text = str(value or "").replace("\u200b", "").replace("\u200c", "").replace("\u200d", "").replace("\ufeff", "").strip()
    text = unicodedata.normalize("NFKD", text)
    text = "".join(ch for ch in text if not unicodedata.combining(ch)).replace("ñ", "n").replace("Ñ", "n")
    return text.lower()


def fold_password(value):
    text = str(value or "").replace("\u200b", "").replace("\u200c", "").replace("\u200d", "").replace("\ufeff", "").strip()
    text = unicodedata.normalize("NFKD", text)
    return "".join(ch for ch in text if not unicodedata.combining(ch)).replace("ñ", "n").replace("Ñ", "n")


def find_user(login):
    conn = db()
    row = conn.fetchone(
        "SELECT * FROM users WHERE lower(username) = ? OR lower(coalesce(email,'')) = ?",
        (login, login),
    )
    conn.close()
    return row


def find_user_id(uid):
    conn = db()
    row = conn.fetchone("SELECT * FROM users WHERE id = ?", (uid,))
    conn.close()
    return row


def ensure_owner():
    if not OWNER_PASS:
        return
    conn = db()
    row = conn.fetchone(
        "SELECT id FROM users WHERE lower(username) = ? OR lower(coalesce(email,'')) = ?",
        (OWNER_USER.lower(), OWNER_EMAIL),
    )
    now = datetime.now(timezone.utc).isoformat()
    if row:
        conn.execute(
            "UPDATE users SET email = ?, premium = 'lifetime', username = ? WHERE id = ?",
            (OWNER_EMAIL, OWNER_USER, row["id"]),
        )
    else:
        conn.execute(
            "INSERT INTO users (id, username, email, password_hash, premium, bio, avatar_url, created_at) VALUES (?,?,?,?,?,?,?,?)",
            (str(uuid.uuid4()), OWNER_USER, OWNER_EMAIL, hash_password(OWNER_PASS), "lifetime", "", "", now),
        )
    conn.commit()
    conn.close()


try:
    ensure_owner()
except Exception as exc:
    print(f"queendar ensure_owner failed: {exc}", flush=True)

RADAR = [
    {"city": "Las Palmas", "country": "Gran Canaria", "name": "Triana / Mesa y López", "lat": 28.1075, "lng": -15.4152, "base": 88, "tags": ["Cocktail Bar", "Cafe", "Late Night Dining"], "blurb": "City-centre queer-friendly bars and the strip toward Santa Catalina.", "tips": ["Keep to lit streets walking back toward Santa Catalina.", "Share an ETA if you're crossing the park late."]},
    {"city": "Las Palmas", "country": "Gran Canaria", "name": "Las Canteras", "lat": 28.1410, "lng": -15.4365, "base": 90, "tags": ["Cafe", "Cocktail Bar"], "blurb": "Beachfront promenade. Days are open; nights stay busy at the south end.", "tips": ["South end stays busy; the north promenade thins out late.", "Walk with people if you're heading back after bars close."]},
    {"city": "Las Palmas", "country": "Gran Canaria", "name": "Maspalomas / Yumbo", "lat": 27.7564, "lng": -15.5863, "base": 84, "tags": ["Dance Club", "Cocktail Bar"], "blurb": "South-island queer hub. Busy and mixed — watch drinks and late taxis.", "tips": ["Watch your drink in mixed rooms.", "Late taxis: use a rank or a booked app, not a random offer at 4am.", "Agree the fare before you get in if it's a licensed cab."]},
    {"city": "Las Palmas", "country": "Gran Canaria", "name": "Playa del Inglés", "lat": 27.7598, "lng": -15.5780, "base": 82, "tags": ["Cafe", "Beach"], "blurb": "Resort strip next to Yumbo. Daytime is easy; late taxis still matter.", "tips": ["Busy tourist strip. Watch drinks on terraces.", "Walk the lit Avenida, not the empty dunes at night."]},
    {"city": "Berlin", "country": "Germany", "name": "Schöneberg", "lat": 52.4886, "lng": 13.3550, "base": 96, "tags": ["Dance Club", "Cafe"], "blurb": "Historic heart of Berlin’s queer scene.", "tips": ["U-Bahn beats a long walk after Bergshain hours.", "Keep a charged phone for the night bus."]},
    {"city": "Berlin", "country": "Germany", "name": "Kreuzberg", "lat": 52.4970, "lng": 13.4180, "base": 91, "tags": ["Dance Club", "Cocktail Bar"], "blurb": "Edgy, inclusive, alternative nightlife.", "tips": ["Busy and mixed. Watch drinks in packed rooms."]},
    {"city": "Berlin", "country": "Germany", "name": "Friedrichshain", "lat": 52.5158, "lng": 13.4540, "base": 88, "tags": ["Dance Club"], "blurb": "Warehouse parties and queer techno.", "tips": ["Queues are long after 1am — plan the ride home before you go in."]},
    {"city": "Barcelona", "country": "Spain", "name": "Eixample", "lat": 41.3917, "lng": 2.1649, "base": 92, "tags": ["Dance Club", "Cocktail Bar"], "blurb": "Gaixample — Barcelona’s LGBTQ+ district.", "tips": ["Stick to official taxis or Cabify late.", "Watch drinks on packed terraces."]},
    {"city": "Barcelona", "country": "Spain", "name": "El Raval", "lat": 41.3797, "lng": 2.1686, "base": 78, "tags": ["Cafe", "Cocktail Bar"], "blurb": "Diverse and bohemian. Stay alert on quiet streets at night.", "tips": ["Quiet side streets empty after 2am — stay on the lit ones.", "Phones out of back pockets in crowds."]},
    {"city": "Barcelona", "country": "Spain", "name": "Poblenou", "lat": 41.4036, "lng": 2.2037, "base": 85, "tags": ["Cafe", "Dance Club"], "blurb": "Creative district with beach proximity.", "tips": ["Beach path is dark late — walk the parallel streets if you're solo."]},
    {"city": "London", "country": "United Kingdom", "name": "Soho", "lat": 51.5136, "lng": -0.1365, "base": 93, "tags": ["Dance Club", "Cocktail Bar"], "blurb": "London’s iconic queer epicentre.", "tips": ["Busy and touristy. Watch drinks.", "Night tube / pre-booked car beats a random minicab."]},
    {"city": "London", "country": "United Kingdom", "name": "Vauxhall", "lat": 51.4861, "lng": -0.1229, "base": 90, "tags": ["Dance Club"], "blurb": "Late-night clubs and after-hours.", "tips": ["After 3am, use the official rank or an app. Don't take a touted ride."]},
    {"city": "London", "country": "United Kingdom", "name": "Dalston", "lat": 51.5485, "lng": -0.0752, "base": 82, "tags": ["Cafe", "Dance Club"], "blurb": "East London queer-artsy hub.", "tips": ["Overground thins out late — check the last train before you settle in."]},
    {"city": "Puerto Vallarta", "country": "Mexico", "name": "Zona Romántica", "lat": 20.6075, "lng": -105.2342, "base": 90, "tags": ["Dance Club", "Cocktail Bar", "Beach"], "blurb": "PV’s queer heart. Daytime beaches, night on Olas Altas.", "tips": ["Watch drinks on the strip.", "Use Sitio taxis or an app late — not a random offer off the malecón."]},
    {"city": "Puerto Vallarta", "country": "Mexico", "name": "Olas Altas / Los Muertos", "lat": 20.6038, "lng": -105.2368, "base": 88, "tags": ["Beach", "Cafe"], "blurb": "Beach and pier. Easy by day; keep to lit streets walking back.", "tips": ["Los Muertos pier is busy; side streets empty after 1am.", "911 is the local emergency number."]},
]

HAVENS = [
    {"name": "Yumbo Centre", "kind": "lobby", "lat": 27.7564, "lng": -15.5863, "note": "Indoor complex — lights and people late."},
    {"name": "Hospitales San Roque Maspalomas", "kind": "hospital", "lat": 27.7619, "lng": -15.5756, "note": "Hospital on Av. de Tirajana."},
    {"name": "Playa del Inglés hotel strip", "kind": "lobby", "lat": 27.7598, "lng": -15.5780, "note": "Lit avenida and hotel lobbies."},
    {"name": "Hospital Insular", "kind": "hospital", "lat": 28.1065, "lng": -15.4185, "note": "Las Palmas hospital."},
    {"name": "Santa Catalina / Parque", "kind": "transit", "lat": 28.1406, "lng": -15.4314, "note": "Busy bus and hotel area."},
    {"name": "Nollendorfplatz U-Bahn", "kind": "transit", "lat": 52.4992, "lng": 13.3540, "note": "Schöneberg — stay in the station lights."},
    {"name": "Vivantes Auguste-Viktoria-Klinikum", "kind": "hospital", "lat": 52.4665, "lng": 13.3428, "note": "Hospital south of Schöneberg."},
    {"name": "Hospital Clínic", "kind": "hospital", "lat": 41.3888, "lng": 2.1520, "note": "Barcelona hospital near Eixample."},
    {"name": "Universitat metro", "kind": "transit", "lat": 41.3854, "lng": 2.1640, "note": "Gaixample — staffed station hours vary."},
    {"name": "Oxford Circus / Soho", "kind": "transit", "lat": 51.5154, "lng": -0.1410, "note": "Lit and busy; night tube hours vary."},
    {"name": "UCLH A&E", "kind": "hospital", "lat": 51.5253, "lng": -0.1360, "note": "University College Hospital emergency."},
    {"name": "Los Muertos pier / hotel strip", "kind": "lobby", "lat": 20.6038, "lng": -105.2368, "note": "Busy malecón and hotel lobbies."},
    {"name": "Hospital CMQ Panamericano", "kind": "hospital", "lat": 20.6244, "lng": -105.2278, "note": "PV hospital — confirm hours on arrival."},
]

_HAVEN_MEMO = {}


def haversine(lat1, lon1, lat2, lon2):
    r = 6371.0
    p1, p2 = math.radians(lat1), math.radians(lat2)
    dp = math.radians(lat2 - lat1)
    dl = math.radians(lon2 - lon1)
    a = math.sin(dp / 2) ** 2 + math.cos(p1) * math.cos(p2) * math.sin(dl / 2) ** 2
    return 2 * r * math.asin(math.sqrt(min(1.0, a)))


def _haven_row(name, kind, lat, lng, note, source, origin):
    dist = round(haversine(origin[0], origin[1], lat, lng), 2) if origin[0] is not None else None
    walk = f"https://www.google.com/maps/dir/?api=1&destination={lat},{lng}&travelmode=walking"
    return {
        "name": name[:80],
        "kind": kind,
        "lat": round(lat, 5),
        "lng": round(lng, 5),
        "note": (note or "")[:120],
        "source": source,
        "distanceKm": dist,
        "walk": walk,
    }


def seed_havens(lat, lng):
    if lat is None or lng is None:
        return []
    rows = []
    for item in HAVENS:
        dist = haversine(lat, lng, item["lat"], item["lng"])
        if dist <= 25:
            rows.append(_haven_row(item["name"], item["kind"], item["lat"], item["lng"], item.get("note"), "seed", (lat, lng)))
    rows.sort(key=lambda h: h["distanceKm"] if h["distanceKm"] is not None else 9e9)
    return rows[:8]


def overpass_havens(lat, lng):
    q = (
        f"[out:json][timeout:10];("
        f'node["amenity"="hospital"](around:1800,{lat},{lng});'
        f'node["amenity"="pharmacy"](around:900,{lat},{lng});'
        f'node["amenity"="police"](around:1800,{lat},{lng});'
        f'node["railway"="station"](around:1800,{lat},{lng});'
        f");out body 20;"
    )
    req = urllib.request.Request(
        "https://overpass-api.de/api/interpreter",
        data=f"data={urllib.parse.quote(q)}".encode(),
        headers={"Content-Type": "application/x-www-form-urlencoded", "User-Agent": "QueenDar/1.0"},
        method="POST",
    )
    with urllib.request.urlopen(req, timeout=12) as res:
        data = json.loads(res.read().decode())
    kind_map = {"hospital": "hospital", "pharmacy": "pharmacy", "police": "police", "station": "transit"}
    out = []
    for el in data.get("elements") or []:
        tags = el.get("tags") or {}
        amenity = tags.get("amenity") or tags.get("railway")
        kind = kind_map.get(amenity)
        name = tags.get("name") or tags.get("name:en")
        elat, elng = el.get("lat"), el.get("lon")
        if not kind or not name or elat is None or elng is None:
            continue
        out.append(_haven_row(name, kind, float(elat), float(elng), "Mapped nearby — confirm it's open.", "osm", (lat, lng)))
    out.sort(key=lambda h: h["distanceKm"] if h["distanceKm"] is not None else 9e9)
    return out[:12]


def haven_payload(lat, lng, live=False):
    key = (round(lat, 3), round(lng, 3)) if lat is not None and lng is not None else None
    if key and key in _HAVEN_MEMO and time.time() - _HAVEN_MEMO[key]["at"] < 1800:
        return _HAVEN_MEMO[key]["data"]
    seeds = seed_havens(lat, lng)
    osm = []
    if live and lat is not None and lng is not None:
        try:
            osm = overpass_havens(lat, lng)
        except Exception:
            osm = []
    seen = set()
    merged = []
    for row in seeds + osm:
        token = (row["kind"], round(row["lat"], 3), round(row["lng"], 3))
        if token in seen:
            continue
        seen.add(token)
        merged.append(row)
    merged.sort(key=lambda h: h["distanceKm"] if h["distanceKm"] is not None else 9e9)
    data = {"ok": True, "havens": merged[:10], "osm": bool(osm), "note": "Lit public places nearby. Not a guarantee they are open — glance before you walk."}
    if key:
        _HAVEN_MEMO[key] = {"at": time.time(), "data": data}
    return data


# Offline-capable GPS → local emergency numbers. Smaller regions first.
COUNTRY_BOXES = [
    (27.4, 29.5, -18.3, -13.3, "ES", "Spain (Canary Islands)"),
    (32.4, 33.2, -17.4, -16.2, "PT", "Portugal (Madeira)"),
    (36.7, 39.8, -31.4, -24.8, "PT", "Portugal (Azores)"),
    (35.8, 36.2, -5.4, -5.3, "GI", "Gibraltar"),
    (51.3, 55.5, -10.6, -5.9, "IE", "Ireland"),
    (49.8, 60.9, -8.7, 1.8, "GB", "United Kingdom"),
    (36.8, 42.3, -9.6, -6.1, "PT", "Portugal"),
    (27.6, 43.9, -18.3, 4.5, "ES", "Spain"),
    (41.3, 51.2, -5.2, 9.7, "FR", "France"),
    (47.2, 55.2, 5.8, 15.1, "DE", "Germany"),
    (36.6, 47.2, 6.5, 18.6, "IT", "Italy"),
    (50.7, 53.6, 3.3, 7.3, "NL", "Netherlands"),
    (49.4, 51.6, 2.5, 6.5, "BE", "Belgium"),
    (45.8, 47.9, 5.9, 10.6, "CH", "Switzerland"),
    (46.3, 49.1, 9.4, 17.3, "AT", "Austria"),
    (36.0, 41.8, 19.3, 29.8, "GR", "Greece"),
    (48.0, 54.9, 14.0, 24.2, "PL", "Poland"),
    (55.3, 69.1, 10.5, 24.3, "SE", "Sweden"),
    (57.9, 71.2, 4.5, 31.3, "NO", "Norway"),
    (54.5, 57.8, 8.0, 15.3, "DK", "Denmark"),
    (59.7, 70.2, 20.5, 31.6, "FI", "Finland"),
    (24.4, 49.4, -124.9, -66.9, "US", "United States"),
    (41.6, 83.2, -141.1, -52.6, "CA", "Canada"),
    (14.5, 32.8, -118.5, -86.7, "MX", "Mexico"),
    (-44.0, -10.0, 113.0, 154.0, "AU", "Australia"),
    (-47.4, -34.0, 166.0, 179.0, "NZ", "New Zealand"),
    (-34.0, 5.3, -74.1, -34.7, "BR", "Brazil"),
    (-55.1, -21.7, -73.6, -53.6, "AR", "Argentina"),
    (5.5, 32.8, 34.2, 35.9, "IL", "Israel"),
    (5.6, 20.5, 97.3, 105.7, "TH", "Thailand"),
    (24.0, 46.0, 123.0, 146.0, "JP", "Japan"),
    (33.0, 38.7, 124.5, 131.9, "KR", "South Korea"),
    (1.1, 1.5, 103.6, 104.1, "SG", "Singapore"),
    (22.1, 22.6, 113.8, 114.5, "HK", "Hong Kong"),
    (21.8, 25.4, 120.0, 122.1, "TW", "Taiwan"),
    (4.2, 21.3, 116.8, 126.7, "PH", "Philippines"),
    (22.6, 26.5, 51.5, 56.6, "AE", "United Arab Emirates"),
    (22.0, 31.8, 24.7, 36.9, "EG", "Egypt"),
    (27.6, 35.9, -13.3, -1.0, "MA", "Morocco"),
    (6.7, 37.1, 68.1, 97.4, "IN", "India"),
    (-35.0, -22.1, 16.3, 33.0, "ZA", "South Africa"),
    (35.8, 42.2, 26.0, 44.9, "TR", "Turkey"),
    (21.7, 25.7, -84.95, -74.1, "US", "United States (Florida)"),
    (18.0, 18.6, -67.4, -65.2, "US", "Puerto Rico"),
]

EMERGENCY_BY_ISO = {
    "ES": {"primary": "112", "services": [("Emergency", "112"), ("National Police", "091"), ("Ambulance", "061"), ("Fire", "080")]},
    "GB": {"primary": "999", "services": [("Emergency", "999"), ("Emergency (EU)", "112"), ("NHS non-emergency", "111")]},
    "IE": {"primary": "112", "services": [("Emergency", "112"), ("Emergency", "999")]},
    "PT": {"primary": "112", "services": [("Emergency", "112")]},
    "FR": {"primary": "112", "services": [("Emergency", "112"), ("Ambulance (SAMU)", "15"), ("Police", "17"), ("Fire", "18")]},
    "DE": {"primary": "112", "services": [("Emergency / Ambulance / Fire", "112"), ("Police", "110")]},
    "IT": {"primary": "112", "services": [("Emergency", "112"), ("Ambulance", "118"), ("Fire", "115"), ("Police", "113")]},
    "NL": {"primary": "112", "services": [("Emergency", "112")]},
    "BE": {"primary": "112", "services": [("Emergency", "112"), ("Police", "101")]},
    "CH": {"primary": "112", "services": [("Emergency", "112"), ("Police", "117"), ("Fire", "118"), ("Ambulance", "144")]},
    "AT": {"primary": "112", "services": [("Emergency", "112"), ("Police", "133"), ("Ambulance", "144"), ("Fire", "122")]},
    "GR": {"primary": "112", "services": [("Emergency", "112"), ("Police", "100"), ("Ambulance", "166"), ("Fire", "199")]},
    "PL": {"primary": "112", "services": [("Emergency", "112"), ("Police", "997"), ("Ambulance", "999"), ("Fire", "998")]},
    "SE": {"primary": "112", "services": [("Emergency", "112")]},
    "NO": {"primary": "112", "services": [("Emergency", "112"), ("Police", "112"), ("Ambulance", "113"), ("Fire", "110")]},
    "DK": {"primary": "112", "services": [("Emergency", "112")]},
    "FI": {"primary": "112", "services": [("Emergency", "112")]},
    "US": {"primary": "911", "services": [("Emergency", "911")]},
    "CA": {"primary": "911", "services": [("Emergency", "911")]},
    "MX": {"primary": "911", "services": [("Emergency", "911")]},
    "AU": {"primary": "000", "services": [("Emergency", "000"), ("Emergency (mobile)", "112")]},
    "NZ": {"primary": "111", "services": [("Emergency", "111")]},
    "BR": {"primary": "190", "services": [("Police", "190"), ("Ambulance", "192"), ("Fire", "193")]},
    "AR": {"primary": "911", "services": [("Emergency", "911")]},
    "IL": {"primary": "100", "services": [("Police", "100"), ("Ambulance", "101"), ("Fire", "102")]},
    "TH": {"primary": "191", "services": [("Police", "191"), ("Ambulance / Fire", "199"), ("Tourist police", "1155")]},
    "JP": {"primary": "110", "services": [("Police", "110"), ("Ambulance / Fire", "119")]},
    "KR": {"primary": "112", "services": [("Police", "112"), ("Ambulance / Fire", "119")]},
    "SG": {"primary": "999", "services": [("Police", "999"), ("Ambulance / Fire", "995")]},
    "HK": {"primary": "999", "services": [("Emergency", "999")]},
    "TW": {"primary": "110", "services": [("Police", "110"), ("Ambulance / Fire", "119")]},
    "PH": {"primary": "911", "services": [("Emergency", "911")]},
    "AE": {"primary": "999", "services": [("Police", "999"), ("Ambulance", "998"), ("Fire", "997")]},
    "EG": {"primary": "122", "services": [("Police", "122"), ("Ambulance", "123"), ("Fire", "180")]},
    "MA": {"primary": "19", "services": [("Police", "19"), ("Ambulance / Fire", "15"), ("Gendarmerie", "177")]},
    "IN": {"primary": "112", "services": [("Emergency", "112")]},
    "ZA": {"primary": "10111", "services": [("Police", "10111"), ("Ambulance", "10177")]},
    "TR": {"primary": "112", "services": [("Emergency", "112")]},
    "GI": {"primary": "112", "services": [("Emergency", "112"), ("Emergency", "199")]},
}

EU_DEFAULT = {"primary": "112", "services": [("Emergency (EU default)", "112")]}
CALL_VERB = {
    "ES": "Llamar",
    "FR": "Appeler",
    "DE": "Anrufen",
    "IT": "Chiama",
    "PT": "Ligar",
    "NL": "Bel",
    "BE": "Appelez",
    "MX": "Llamar",
    "AR": "Llamar",
    "BR": "Ligar",
    "GI": "Call",
}


def country_from_gps(lat, lng):
    if lat is None or lng is None:
        return None
    for lat_min, lat_max, lng_min, lng_max, iso, label in COUNTRY_BOXES:
        if lat_min <= lat <= lat_max and lng_min <= lng <= lng_max:
            return iso, label
    return None


def emergency_for(lat, lng):
    found = country_from_gps(lat, lng)
    if not found:
        pack = dict(EU_DEFAULT)
        return {
            "ok": True,
            "iso": None,
            "country": "Unknown — enable GPS for local numbers",
            "primary": pack["primary"],
            "call": "Call",
            "services": [{"kind": k, "number": n} for k, n in pack["services"]],
            "gps": lat is not None and lng is not None,
            "offline": True,
        }
    iso, label = found
    pack = EMERGENCY_BY_ISO.get(iso) or EU_DEFAULT
    return {
        "ok": True,
        "iso": iso,
        "country": label,
        "primary": pack["primary"],
        "call": CALL_VERB.get(iso, "Call"),
        "services": [{"kind": k, "number": n} for k, n in pack["services"]],
        "gps": True,
        "offline": True,
    }


def live_score(base, name, hour, scan_avg):
    score = int(base)
    night = hour >= 1 and hour <= 5
    if night and "Yumbo" in name:
        score -= 5
    elif night and any(x in name for x in ("Vauxhall", "Friedrichshain", "Raval")):
        score -= 3
    elif 11 <= hour <= 18 and "Canteras" in name:
        score += 2
    if scan_avg is not None:
        score = round(score * 0.7 + scan_avg * 0.3)
    return max(20, min(99, score))


INCIDENT_KINDS = {
    "protest": "Protest / crowd",
    "transit": "Transit disruption",
    "violence": "Violence / assault",
    "hazard": "Hazard / road block",
    "police": "Police activity",
    "other": "Other alert",
}


def public_incident(row, lat=None, lng=None):
    dist = None
    try:
        ilat, ilng = float(row["lat"]), float(row["lng"])
    except (TypeError, ValueError, KeyError):
        ilat = ilng = None
    if lat is not None and lng is not None and ilat is not None:
        dist = round(haversine(lat, lng, ilat, ilng), 2)
    confirms = int(row.get("confirms") or 1)
    return {
        "id": row["id"],
        "kind": row["kind"],
        "label": INCIDENT_KINDS.get(row["kind"], row["kind"]),
        "note": (row.get("note") or "")[:180],
        "lat": round(ilat, 3) if ilat is not None else None,
        "lng": round(ilng, 3) if ilng is not None else None,
        "confirms": confirms,
        "status": "confirmed" if confirms >= 2 else "unverified",
        "created_at": row.get("created_at"),
        "distanceKm": dist,
    }


def nearby_incidents(lat, lng, km=50, hours=12, rows=None):
    if rows is None:
        cutoff = (datetime.now(timezone.utc) - timedelta(hours=hours)).isoformat()
        conn = db()
        rows = conn.fetchall("SELECT * FROM incidents WHERE created_at >= ? ORDER BY created_at DESC LIMIT 200", (cutoff,))
        conn.close()
    out = []
    for row in rows:
        item = public_incident(row, lat, lng)
        if lat is not None and item.get("distanceKm") is not None and item["distanceKm"] > km:
            continue
        out.append(item)
    out.sort(
        key=lambda x: (
            0 if x.get("status") == "confirmed" else 1,
            x["distanceKm"] is None,
            x["distanceKm"] if x["distanceKm"] is not None else 9e9,
        )
    )
    return out[:40]


def radar_payload(lat, lng):
    hour = datetime.now(timezone.utc).hour
    cutoff = (datetime.now(timezone.utc) - timedelta(hours=12)).isoformat()
    conn = db()
    scans = conn.fetchall("SELECT venue_name, safety_rating FROM scans ORDER BY created_at DESC LIMIT 80")
    raw_inc = conn.fetchall("SELECT * FROM incidents WHERE created_at >= ? ORDER BY created_at DESC LIMIT 200", (cutoff,))
    conn.close()
    incidents = nearby_incidents(lat, lng, rows=raw_inc)
    hoods = []
    for item in RADAR:
        dist = None
        if lat is not None and lng is not None:
            dist = round(haversine(lat, lng, item["lat"], item["lng"]), 2)
        nearby = [
            int(s["safety_rating"])
            for s in scans
            if s.get("safety_rating") and item["name"].split("/")[0].strip().lower() in str(s.get("venue_name") or "").lower()
        ]
        avg = sum(nearby) / len(nearby) if nearby else None
        score = live_score(item["base"], item["name"], hour, avg)
        hoods.append({**item, "distanceKm": dist, "safetyScore": score, "live": True, "scanCount": len(nearby)})
    if lat is not None:
        hoods.sort(key=lambda h: (h["distanceKm"] is None, 9e9 if h["distanceKm"] is None else h["distanceKm"]))
    cities = []
    for hood in hoods:
        found = next((c for c in cities if c["name"] == hood["city"]), None)
        if not found:
            found = {
                "name": hood["city"],
                "country": hood["country"],
                "lat": hood["lat"],
                "lng": hood["lng"],
                "neighborhoods": [],
                "distanceKm": hood["distanceKm"],
            }
            cities.append(found)
        found["neighborhoods"].append(hood)
        if hood["distanceKm"] is not None:
            found["distanceKm"] = min(found["distanceKm"] if found["distanceKm"] is not None else 9e9, hood["distanceKm"])
    for city in cities:
        scores = [n["safetyScore"] for n in city["neighborhoods"]]
        city["safetyScore"] = round(sum(scores) / len(scores)) if scores else 70
        city["trend"] = "up" if city["safetyScore"] >= 85 else "stable"
    nearest = cities[0] if cities and cities[0].get("distanceKm") is not None else None
    nearest_hood = hoods[0] if lat is not None and hoods else None
    tips = list((nearest_hood or {}).get("tips") or [])
    return {
        "ok": True,
        "hourUtc": hour,
        "gps": lat is not None,
        "nearest": nearest,
        "nearestHood": (
            {
                "name": nearest_hood["name"],
                "city": nearest_hood["city"],
                "country": nearest_hood["country"],
                "distanceKm": nearest_hood.get("distanceKm"),
                "safetyScore": nearest_hood.get("safetyScore"),
                "blurb": nearest_hood.get("blurb"),
                "tips": tips,
            }
            if nearest_hood
            else None
        ),
        "localTips": tips,
        "cities": cities,
        "here": {"lat": lat, "lng": lng} if lat is not None else None,
        "emergency": emergency_for(lat, lng),
        "incidents": incidents,
        "havens": seed_havens(lat, lng),
    }


SCAN_SYSTEM = """You are QueenDar venue safety intelligence for LGBTQ+ travelers.
Return ONLY compact JSON, no markdown, no extra text:
{"venueName":"string","safetyRating":0-100 integer,"greenFlags":["..."],"yellowFlags":["..."],"summary":"2-4 sentences"}
Rules:
- greenFlags: inclusive or safer aspects (max 4). yellowFlags: cautions (max 3).
- If you are not sure, say so in summary. Do not invent fake certifications.
- Prefer Gran Canaria / Spanish nightlife context when the venue is there.
- safetyRating 0-100. Unknown venue: 45-70 with honest yellow flags, never a fake 88.
- Stay calm. Do not panic the traveler.
"""

AWARE_SYSTEM = """You are QueenDar Awareness, a calm safety coach for LGBTQ+ travelers.
Tone: steady, practical, never panic, never sensational. No ALL CAPS. No 'RUN', 'DANGER', or fake urgency.
You raise awareness. You do not scare people.

You may get: GPS-resolved place (nearest seeded neighbourhood), local customs/tips, emergency number, hour, tags (alone, night, meetup), and nearby traveler reports (unverified unless confirmed).
Coach THIS area. Do not invent a different city. If Place is set, name it once. Use the local tips; do not ignore them.

Rules:
- Traveler posts are hints, not news. If it sounds like a major incident (violence, large protest, police action, disaster), tell them to check local news or official sources (police, 112/999/911, public broadcaster) before changing plans. Do not invent headlines, casualty counts, or exact locations.
- Night + alone: practical habits only (share ETA, lit streets, charged phone, SOS check-in). Do not imply they are doomed.
- Meeting someone new: public first meet, tell a friend, own transport, drinks in sight. Neutral, not a lecture.
- If they are near Maspalomas / Yumbo: calm local nuance only — watch drinks in mixed rooms, late taxis from a rank or booked app not a random offer. Do not scare.
- 2-5 short sentences. You may add up to 3 short habits as a list. No markdown headings.
- Never claim QueenDar confirmed a news event.

Return ONLY JSON, no thinking, no analysis:
{"reply":"Late is fine. Share an ETA and stay on lit streets.","verifyNews":false}
verifyNews true only if they should check news or official sources. Do not copy this example.
"""


def extract_text(data):
    msg = ((data.get("choices") or [{}])[0] or {}).get("message") or {}
    content = str(msg.get("content") or "").strip()
    if content:
        return content
    return str(msg.get("reasoning") or msg.get("reasoning_content") or "").strip()


def parse_scan_json(text, fallback_name):
    match = re.search(r"\{[\s\S]*\}", text or "")
    raw = match.group(0) if match else ""
    data = {}
    if raw:
        try:
            data = json.loads(raw)
        except json.JSONDecodeError:
            data = {}
    name = str(data.get("venueName") or fallback_name or "Unknown venue").strip()
    try:
        rating = int(data.get("safetyRating"))
    except (TypeError, ValueError):
        rating = 55
    rating = max(0, min(100, rating))
    greens = [str(x).strip() for x in (data.get("greenFlags") or []) if str(x).strip()][:4]
    yellows = [str(x).strip() for x in (data.get("yellowFlags") or []) if str(x).strip()][:3]
    summary = str(data.get("summary") or text or "No safety read yet.").strip()[:1200]
    if not greens and not yellows:
        yellows = ["AI could not confirm this venue — treat the rating as a starting point."]
    return {"venueName": name, "safetyRating": rating, "greenFlags": greens, "yellowFlags": yellows, "summary": summary, "ok": True}


def chat(url, model, messages, max_tokens=2048, timeout=TIMEOUT):
    body = json.dumps({"model": model, "messages": messages, "max_tokens": max_tokens, "temperature": 0.3, "think": False}).encode()
    headers = {"Content-Type": "application/json"}
    key = (os.environ.get("AI_CODER_KEY") or os.environ.get("ANVIL_TOKEN") or "").strip()
    if key:
        headers["Authorization"] = f"Bearer {key}"
    req = urllib.request.Request(f"{url}/chat/completions", data=body, headers=headers, method="POST")
    with urllib.request.urlopen(req, timeout=timeout) as res:
        return json.loads(res.read().decode())


def models_ok(url):
    req = urllib.request.Request(f"{url}/models", headers={"Accept": "application/json"})
    with urllib.request.urlopen(req, timeout=8) as res:
        data = json.loads(res.read().decode())
    return [m.get("id") for m in (data.get("data") or []) if m.get("id")]


def aware_fallback(situation, major):
    tags = set(situation or [])
    if major:
        return (
            "A traveler flagged something nearby. Treat it as a hint, not a headline. "
            "Check local news or an official source before you change plans."
        )
    if "meetup" in tags:
        return (
            "Meeting someone new: keep it public for the first hello, tell a friend who you're with, "
            "and keep your own way home. If the vibe is off, you can leave — that's the plan, not rudeness."
        )
    if "alone" in tags or "night" in tags:
        return (
            "Late and on your own is fine — just raise the bar a little. Share an ETA, stay on lit streets, "
            "keep your phone charged, and tap I'm safe when you get in."
        )
    return (
        "Stay aware, not alarmed. If something feels off, move toward people and light. "
        "QueenDar will not invent news — check verified sources for anything major."
    )


def local_context(lat, lng, city=None):
    hood = None
    dist = None
    if lat is not None and lng is not None:
        ranked = [(haversine(lat, lng, item["lat"], item["lng"]), item) for item in RADAR]
        ranked.sort(key=lambda x: x[0])
        if ranked and ranked[0][0] <= 80:
            dist, hood = ranked[0]
    if hood is None and city:
        q = city.lower()
        hood = next((h for h in RADAR if q in h["name"].lower() or q in h["city"].lower()), None)
    em = emergency_for(lat, lng)
    return {
        "place": (hood or {}).get("name") or city or "",
        "city": (hood or {}).get("city") or "",
        "country": (hood or {}).get("country") or (em.get("country") or ""),
        "tips": list((hood or {}).get("tips") or []),
        "blurb": (hood or {}).get("blurb") or "",
        "km": round(dist, 2) if dist is not None else None,
        "emergency": em,
    }


def parse_aware(text, situation, major):
    parsed = {}
    for blob in reversed(re.findall(r"\{[\s\S]*?\}", text or "")):
        try:
            cand = json.loads(blob)
        except json.JSONDecodeError:
            continue
        if isinstance(cand, dict) and cand.get("reply"):
            parsed = cand
            break
    reply = str(parsed.get("reply") or "").strip()
    low = reply.lower()
    if (
        not reply
        or low in ("plain text", "string", "...")
        or "thinking process" in low
        or "analyze user input" in low
        or low.startswith("here's a thinking")
    ):
        reply = aware_fallback(situation, major)
    verify = bool(parsed.get("verifyNews")) or major
    return reply[:1200], verify


def ground_reply(reply, ctx):
    place = str((ctx or {}).get("place") or "").strip()
    tips = [str(t).strip() for t in ((ctx or {}).get("tips") or []) if str(t).strip()]
    em = (ctx or {}).get("emergency") or {}
    low = (reply or "").lower()
    token = place.split("/")[0].strip().lower() if place else ""
    generic = (
        not reply
        or "stay aware, not alarmed" in low
        or "will not invent news" in low
        or low in ("plain text", "string")
    )
    missing = bool(token) and token not in low
    if not generic and not missing:
        return (reply or "")[:1200]
    lead = []
    if place:
        lead.append(place.rstrip("."))
    if tips:
        lead.append(tips[0].rstrip("."))
    primary = em.get("primary")
    if primary:
        lead.append(f"{em.get('call') or 'Call'} {primary}")
    prefix = ". ".join(lead)
    if prefix:
        prefix += "."
    if generic:
        extra = (tips[1].rstrip(".") + ".") if len(tips) > 1 else ""
        return f"{prefix} {extra}".strip()[:1200]
    if prefix:
        return f"{prefix} {reply}".strip()[:1200]
    return (reply or "")[:1200]


def aware_reply(message, situation, city, hour, incidents, lat=None, lng=None):
    ctx = local_context(lat, lng, city)
    major = any(
        (i.get("status") == "confirmed" or int(i.get("confirms") or 0) >= 2)
        and str(i.get("kind") or "") in ("violence", "protest", "police")
        for i in (incidents or [])
    ) or any(int(i.get("confirms") or 0) >= 3 for i in (incidents or []))
    tips = "; ".join(ctx["tips"]) or ctx["blurb"] or "none on file"
    em = ctx["emergency"] or {}
    asked = (message or "").strip() or "What's around me here? Give calm local tips for this exact area."
    user = (
        f"Place: {ctx['place'] or 'unknown'} in {ctx['city'] or ''} {ctx['country'] or ''}. "
        f"Distance to seeded zone: {ctx['km']} km. "
        f"Local customs/tips: {tips}. "
        f"Emergency: {em.get('call') or 'Call'} {em.get('primary')} ({em.get('country')}). "
        f"Hour: {hour}. Tags: {', '.join(situation or []) or 'none'}. "
        f"Nearby traveler reports: {json.dumps(incidents[:6], default=str) if incidents else 'none'}. "
        f"Traveler said: {asked}. "
        f"Pull from this local area. Do not invent a different city. JSON only."
    )
    try:
        data = chat(
            CODER,
            CODER_MODEL,
            [{"role": "system", "content": AWARE_SYSTEM}, {"role": "user", "content": user}],
            max_tokens=400,
            timeout=min(45, TIMEOUT),
        )
        reply, verify = parse_aware(extract_text(data), situation, major)
        reply = ground_reply(reply, ctx)
        return {
            "ok": True,
            "reply": reply,
            "verifyNews": verify,
            "major": major,
            "backend": "gpu-coder",
            "place": ctx["place"],
            "tips": ctx["tips"],
            "emergency": {"primary": em.get("primary"), "call": em.get("call"), "country": em.get("country")},
        }
    except Exception:
        extra = ground_reply(aware_fallback(situation, major), ctx)
        return {
            "ok": True,
            "reply": extra,
            "verifyNews": major,
            "major": major,
            "backend": "fallback",
            "place": ctx["place"],
            "tips": ctx["tips"],
            "emergency": {"primary": em.get("primary"), "call": em.get("call"), "country": em.get("country")},
        }


def scan_venue(venue_name, image_data_url):
    name = (venue_name or "").strip()
    user_text = f"Venue: {name or '(from flyer)'}. Produce the JSON safety card."
    if image_data_url:
        messages = [
            {"role": "system", "content": SCAN_SYSTEM},
            {"role": "user", "content": [
                {"type": "text", "text": user_text + " Read the flyer/photo first."},
                {"type": "image_url", "image_url": {"url": image_data_url}},
            ]},
        ]
        try:
            data = chat(VL, VL_MODEL, messages, max_tokens=1200, timeout=TIMEOUT)
            out = parse_scan_json(extract_text(data), name)
            out["backend"] = "gpu-vl"
            return out
        except Exception as exc:
            user_text += f" (flyer attached but VL failed: {exc})"
    data = chat(CODER, CODER_MODEL, [{"role": "system", "content": SCAN_SYSTEM}, {"role": "user", "content": user_text}], max_tokens=2048, timeout=TIMEOUT)
    out = parse_scan_json(extract_text(data), name)
    out["backend"] = "gpu-coder"
    return out


def stripe_form(payload):
    data = urllib.parse.urlencode(payload).encode()
    req = urllib.request.Request(
        "https://api.stripe.com/v1/checkout/sessions",
        data=data,
        headers={"Authorization": f"Bearer {STRIPE_SECRET}", "Content-Type": "application/x-www-form-urlencoded"},
        method="POST",
    )
    with urllib.request.urlopen(req, timeout=30) as res:
        return json.loads(res.read().decode())


def stripe_get(session_id):
    req = urllib.request.Request(
        f"https://api.stripe.com/v1/checkout/sessions/{urllib.parse.quote(session_id)}",
        headers={"Authorization": f"Bearer {STRIPE_SECRET}"},
    )
    with urllib.request.urlopen(req, timeout=20) as res:
        return json.loads(res.read().decode())


def query_params(path):
    return {k: (v[0] if v else "") for k, v in parse_qs(urlparse(path).query).items()}


def public_log(row, user_id):
    return {
        "id": row["id"],
        "user_id": row["user_id"],
        "title": decrypt_text(row.get("title") or "", user_id),
        "body": decrypt_text(row.get("body") or "", user_id),
        "mood": row.get("mood") or "",
        "location": row.get("location") or "",
        "created_at": row.get("created_at"),
        "encrypted": True,
    }


class Handler(BaseHTTPRequestHandler):
    def _cors(self):
        self.send_header("Access-Control-Allow-Origin", "*")
        self.send_header("Access-Control-Allow-Headers", "Content-Type, Authorization")
        self.send_header("Access-Control-Allow-Methods", "GET, POST, PUT, DELETE, OPTIONS")

    def _json(self, code, payload):
        raw = json.dumps(payload, default=str).encode()
        self.send_response(code)
        self.send_header("Content-Type", "application/json")
        self._cors()
        self.send_header("Content-Length", str(len(raw)))
        self.end_headers()
        self.wfile.write(raw)

    def do_OPTIONS(self):
        self.send_response(204)
        self._cors()
        self.end_headers()

    def read_json_body(self):
        n = int(self.headers.get("Content-Length") or 0)
        if n > 12 * 1024 * 1024:
            raise ValueError("payload too large")
        try:
            return json.loads(self.rfile.read(n) or b"{}")
        except json.JSONDecodeError:
            return {}

    def current_user(self):
        header = self.headers.get("Authorization") or ""
        token = header[7:].strip() if header.lower().startswith("bearer ") else ""
        if not token:
            token = query_params(self.path).get("token") or ""
        uid = parse_token(token)
        if uid:
            return find_user_id(uid)
        if token:
            return find_user_id(token)
        return None

    def require_user(self):
        user = self.current_user()
        if not user:
            self._json(401, {"error": "Sign in required."})
            return None
        return user

    def do_GET(self):
        path = self.path.split("?")[0]
        qs = query_params(self.path)
        if path in ("/api/ai/health", "/api/health"):
            coder, vl, err, users = [], [], None, 0
            db_name = "postgresql://195.133.93.69:5432/queendar" if USE_PG else str(DB_PATH)
            try:
                conn = db()
                users = int(conn.fetchone("SELECT count(*) AS n FROM users")["n"])
                conn.close()
            except Exception as exc:
                err = str(exc)
            try:
                coder = models_ok(CODER)
            except Exception as exc:
                err = str(exc)
            try:
                vl = models_ok(VL)
            except Exception:
                pass
            self._json(200, {"ok": True, "app": "queendar-api", "gpu": "rtx-pro", "gpuHost": "172.236.195.90", "model": CODER_MODEL, "db": db_name, "users": users, "plus": bool(STRIPE_SECRET), "smsBackend": sms_backend(), "coder": {"url": CODER, "models": coder}, "vl": {"url": VL, "models": vl}, "error": err})
            return
        if path == "/api/radar":
            lat = qs.get("lat")
            lng = qs.get("lng")
            try:
                lat_f = float(lat) if lat else None
                lng_f = float(lng) if lng else None
            except ValueError:
                lat_f = lng_f = None
            self._json(200, radar_payload(lat_f, lng_f))
            return
        if path == "/api/havens":
            lat = qs.get("lat")
            lng = qs.get("lng")
            try:
                lat_f = float(lat) if lat else None
                lng_f = float(lng) if lng else None
            except ValueError:
                lat_f = lng_f = None
            self._json(200, haven_payload(lat_f, lng_f))
            return
        if path == "/api/watch":
            user = self.require_user()
            if not user:
                return
            sweep_watches()
            conn = db()
            row = conn.fetchone("SELECT * FROM watches WHERE user_id = ? ORDER BY created_at DESC LIMIT 1", (user["id"],))
            conn.close()
            self._json(200, {"ok": True, "smsBackend": sms_backend(), "watch": row, "pending": (row or {}).get("status") == "pending_client"})
            return
        if path == "/api/emergency":
            lat = qs.get("lat")
            lng = qs.get("lng")
            try:
                lat_f = float(lat) if lat else None
                lng_f = float(lng) if lng else None
            except ValueError:
                lat_f = lng_f = None
            self._json(200, emergency_for(lat_f, lng_f))
            return
        if path == "/api/me":
            user = self.require_user()
            if not user:
                return
            self._json(200, {"user": user_payload(user), "token": make_token(user["id"])})
            return
        if path == "/api/profile":
            user = self.require_user()
            if not user:
                return
            self._json(200, {"user": user_payload(user)})
            return
        if path == "/api/logs":
            user = self.require_user()
            if not user:
                return
            conn = db()
            rows = conn.fetchall("SELECT * FROM crown_logs WHERE user_id = ? ORDER BY created_at DESC", (user["id"],))
            conn.close()
            self._json(200, {"logs": [public_log(r, user["id"]) for r in rows], "encrypted": True})
            return
        if path == "/api/scans":
            user = self.require_user()
            if not user:
                return
            conn = db()
            rows = conn.fetchall("SELECT * FROM scans WHERE user_id = ? ORDER BY created_at DESC LIMIT 50", (user["id"],))
            conn.close()
            out = []
            for r in rows:
                item = dict(r)
                try:
                    item["greenFlags"] = json.loads(item.pop("green_flags", "[]") or "[]")
                    item["yellowFlags"] = json.loads(item.pop("yellow_flags", "[]") or "[]")
                except json.JSONDecodeError:
                    item["greenFlags"], item["yellowFlags"] = [], []
                item["venueName"] = item.get("venue_name")
                item["safetyRating"] = item.get("safety_rating")
                out.append(item)
            self._json(200, {"scans": out})
            return
        if path == "/api/contacts":
            user = self.require_user()
            if not user:
                return
            conn = db()
            rows = conn.fetchall("SELECT * FROM contacts WHERE user_id = ? ORDER BY created_at DESC", (user["id"],))
            conn.close()
            self._json(200, {"contacts": rows})
            return
        if path == "/api/checkins":
            user = self.require_user()
            if not user:
                return
            conn = db()
            rows = conn.fetchall("SELECT * FROM checkins WHERE user_id = ? ORDER BY created_at DESC LIMIT 30", (user["id"],))
            conn.close()
            self._json(200, {"checkins": rows})
            return
        if path == "/api/incidents":
            lat = qs.get("lat")
            lng = qs.get("lng")
            try:
                lat_f = float(lat) if lat else None
                lng_f = float(lng) if lng else None
            except ValueError:
                lat_f = lng_f = None
            try:
                km = min(200.0, max(1.0, float(qs.get("km") or 50)))
            except ValueError:
                km = 50.0
            self._json(200, {"incidents": nearby_incidents(lat_f, lng_f, km=km)})
            return
        self._json(404, {"error": "not found"})

    def do_PUT(self):
        path = self.path.split("?")[0]
        if path == "/api/profile":
            user = self.require_user()
            if not user:
                return
            body = self.read_json_body()
            username = str(body.get("username") or user["username"]).strip()[:40]
            bio = str(body.get("bio") or "")[:280]
            avatar = str(body.get("avatar_url") or "")[:250000]
            ice = body.get("ice") if isinstance(body.get("ice"), dict) else {}
            ice_name = encrypt_text(str(ice.get("name") or "")[:80], user["id"]) if str(ice.get("name") or "").strip() else ""
            ice_phone = encrypt_text(str(ice.get("phone") or "")[:40], user["id"]) if str(ice.get("phone") or "").strip() else ""
            ice_relation = encrypt_text(str(ice.get("relation") or "")[:40], user["id"]) if str(ice.get("relation") or "").strip() else ""
            ice_conditions = encrypt_text(str(ice.get("conditions") or "")[:200], user["id"]) if str(ice.get("conditions") or "").strip() else ""
            ice_allergies = encrypt_text(str(ice.get("allergies") or "")[:200], user["id"]) if str(ice.get("allergies") or "").strip() else ""
            ice_meds = encrypt_text(str(ice.get("meds") or "")[:200], user["id"]) if str(ice.get("meds") or "").strip() else ""
            ice_blood = encrypt_text(str(ice.get("bloodType") or ice.get("blood_type") or "")[:16], user["id"]) if str(ice.get("bloodType") or ice.get("blood_type") or "").strip() else ""
            ice_notes = encrypt_text(str(ice.get("notes") or "")[:280], user["id"]) if str(ice.get("notes") or "").strip() else ""
            if len(username) < 2:
                self._json(400, {"error": "Username is required."})
                return
            conn = db()
            taken = conn.fetchone("SELECT id FROM users WHERE lower(username) = ? AND id != ?", (username.lower(), user["id"]))
            if taken:
                conn.close()
                self._json(409, {"error": "That username is taken."})
                return
            conn.execute(
                "UPDATE users SET username = ?, bio = ?, avatar_url = ?, ice_name = ?, ice_phone = ?, ice_relation = ?, ice_conditions = ?, ice_allergies = ?, ice_meds = ?, ice_blood = ?, ice_notes = ? WHERE id = ?",
                (username, bio, avatar, ice_name, ice_phone, ice_relation, ice_conditions, ice_allergies, ice_meds, ice_blood, ice_notes, user["id"]),
            )
            conn.commit()
            row = conn.fetchone("SELECT * FROM users WHERE id = ?", (user["id"],))
            conn.close()
            self._json(200, {"user": user_payload(row)})
            return
        self._json(404, {"error": "not found"})

    def do_POST(self):
        path = self.path.split("?")[0]
        if path == "/api/auth/login":
            body = self.read_json_body()
            login = fold_login(body.get("username") or body.get("email") or "")
            password = fold_password(body.get("password") or "")
            row = find_user(login) if login else None
            user = None
            if row and verify_password(password, row["password_hash"]):
                user = row
            elif OWNER_PASS and login in ALIASES and password == OWNER_PASS:
                user = find_user(OWNER_USER.lower()) or find_user(OWNER_EMAIL)
            if user:
                token = make_token(user["id"])
                self._json(200, {"token": token, "user": user_payload(user, token)})
            else:
                self._json(401, {"error": "Invalid username or password."})
            return
        if path == "/api/auth/signup":
            body = self.read_json_body()
            username = str(body.get("username") or "").strip()
            email = str(body.get("email") or "").strip().lower()
            password = str(body.get("password") or "").strip()
            if len(username) < 2 or not email or len(password) < 6:
                self._json(400, {"error": "Username, email, and a 6+ character password are required."})
                return
            if username.lower() in ALIASES or email in ALIASES:
                self._json(409, {"error": "That account already exists. Sign in instead."})
                return
            conn = db()
            if conn.fetchone("SELECT id FROM users WHERE lower(username) = ? OR lower(coalesce(email,'')) = ?", (username.lower(), email)):
                conn.close()
                self._json(409, {"error": "That username or email is already taken."})
                return
            uid = str(uuid.uuid4())
            now = datetime.now(timezone.utc).isoformat()
            conn.execute(
                "INSERT INTO users (id, username, email, password_hash, premium, bio, avatar_url, created_at) VALUES (?,?,?,?,?,?,?,?)",
                (uid, username, email, hash_password(password), "free", "", "", now),
            )
            conn.commit()
            row = conn.fetchone("SELECT * FROM users WHERE id = ?", (uid,))
            conn.close()
            token = make_token(uid)
            self._json(200, {"token": token, "user": user_payload(row, token)})
            return
        if path == "/api/auth/forgot":
            body = self.read_json_body()
            email = str(body.get("email") or "").strip().lower()
            conn = db()
            row = conn.fetchone("SELECT * FROM users WHERE lower(coalesce(email,'')) = ?", (email,)) if email else None
            if row:
                raw = os.urandom(16).hex()
                expires = str(int(time.time()) + 3600)
                conn.execute("UPDATE users SET reset_token = ?, reset_expires = ? WHERE id = ?", (hashlib.sha256(raw.encode()).hexdigest(), expires, row["id"]))
                conn.commit()
                conn.close()
                self._json(200, {"ok": True, "message": "If that email is registered, use this one-hour reset code.", "resetToken": raw})
                return
            conn.close()
            self._json(200, {"ok": True, "message": "If that email is registered, you can reset the password."})
            return
        if path == "/api/auth/reset":
            body = self.read_json_body()
            token = str(body.get("token") or body.get("resetToken") or "").strip()
            password = str(body.get("password") or "").strip()
            if len(password) < 6 or not token:
                self._json(400, {"error": "Reset code and a 6+ character password are required."})
                return
            hashed = hashlib.sha256(token.encode()).hexdigest()
            conn = db()
            row = conn.fetchone("SELECT * FROM users WHERE reset_token = ?", (hashed,))
            if not row or int(row.get("reset_expires") or 0) < time.time():
                conn.close()
                self._json(400, {"error": "Reset code is invalid or expired."})
                return
            conn.execute("UPDATE users SET password_hash = ?, reset_token = NULL, reset_expires = NULL WHERE id = ?", (hash_password(password), row["id"]))
            conn.commit()
            conn.close()
            self._json(200, {"ok": True})
            return
        if path == "/api/auth/password":
            user = self.require_user()
            if not user:
                return
            body = self.read_json_body()
            current = str(body.get("current") or body.get("currentPassword") or "")
            new = str(body.get("password") or body.get("newPassword") or "").strip()
            if len(new) < 6:
                self._json(400, {"error": "New password must be 6+ characters."})
                return
            if not verify_password(current, user["password_hash"]) and not (current == OWNER_PASS and user.get("email") == OWNER_EMAIL):
                self._json(401, {"error": "Current password is wrong."})
                return
            conn = db()
            conn.execute("UPDATE users SET password_hash = ? WHERE id = ?", (hash_password(new), user["id"]))
            conn.commit()
            conn.close()
            self._json(200, {"ok": True})
            return
        if path == "/api/logs":
            user = self.require_user()
            if not user:
                return
            body = self.read_json_body()
            title = str(body.get("title") or "").strip()
            text = str(body.get("body") or "").strip()
            if not title or not text:
                self._json(400, {"error": "Title and body are required."})
                return
            now = datetime.now(timezone.utc).isoformat()
            entry = {
                "id": str(uuid.uuid4()),
                "user_id": user["id"],
                "title": title[:200],
                "body": text[:8000],
                "mood": str(body.get("mood") or "")[:80],
                "location": str(body.get("location") or "")[:200],
                "created_at": now,
                "encrypted": True,
            }
            conn = db()
            conn.execute(
                "INSERT INTO crown_logs (id, user_id, title, body, mood, location, created_at) VALUES (?,?,?,?,?,?,?)",
                (entry["id"], user["id"], encrypt_text(entry["title"], user["id"]), encrypt_text(entry["body"], user["id"]), entry["mood"], entry["location"], now),
            )
            conn.commit()
            conn.close()
            self._json(200, {"log": entry})
            return
        if path == "/api/ai/scan":
            try:
                body = self.read_json_body()
                venue = str(body.get("venueName") or body.get("venue") or "").strip()
                image = str(body.get("image") or "").strip()
                if not venue and not image:
                    self._json(400, {"error": "Enter a venue name or upload a flyer."})
                    return
                if image and not image.startswith("data:"):
                    image = "data:image/jpeg;base64," + image
                result = scan_venue(venue, image)
                user = self.current_user()
                if user:
                    now = datetime.now(timezone.utc).isoformat()
                    sid = str(uuid.uuid4())
                    conn = db()
                    conn.execute(
                        "INSERT INTO scans (id, user_id, venue_name, safety_rating, green_flags, yellow_flags, summary, stars, created_at) VALUES (?,?,?,?,?,?,?,?,?)",
                        (sid, user["id"], result["venueName"], result["safetyRating"], json.dumps(result["greenFlags"]), json.dumps(result["yellowFlags"]), result["summary"], 0, now),
                    )
                    conn.commit()
                    conn.close()
                    result["id"] = sid
                    result["saved"] = True
                self._json(200, result)
            except Exception as exc:
                self._json(502, {"ok": False, "error": str(exc)[:300]})
            return
        if path == "/api/ai/aware":
            try:
                body = self.read_json_body()
                message = str(body.get("message") or "").strip()[:500]
                situation = body.get("situation") if isinstance(body.get("situation"), list) else []
                situation = [str(s).strip().lower()[:24] for s in situation if str(s).strip()][:6]
                city = str(body.get("city") or "").strip()[:80]
                try:
                    lat_f = float(body.get("lat")) if body.get("lat") not in (None, "") else None
                    lng_f = float(body.get("lng")) if body.get("lng") not in (None, "") else None
                except (TypeError, ValueError):
                    lat_f = lng_f = None
                try:
                    hour = int(body.get("hour"))
                except (TypeError, ValueError):
                    hour = datetime.now().astimezone().hour
                incidents = body.get("incidents") if isinstance(body.get("incidents"), list) else []
                slim = []
                for item in incidents[:8]:
                    if not isinstance(item, dict):
                        continue
                    try:
                        confirms = int(item.get("confirms") or 0)
                    except (TypeError, ValueError):
                        confirms = 0
                    slim.append({
                        "kind": str(item.get("kind") or "")[:24],
                        "status": str(item.get("status") or "")[:16],
                        "confirms": confirms,
                        "label": str(item.get("label") or "")[:40],
                    })
                self._json(200, aware_reply(message, situation, city, hour, slim, lat_f, lng_f))
            except Exception:
                self._json(200, {"ok": True, "reply": aware_fallback([], False), "verifyNews": False, "major": False, "backend": "fallback"})
            return
        if path.startswith("/api/scans/") and path.endswith("/rate"):
            user = self.require_user()
            if not user:
                return
            scan_id = path.split("/")[3]
            body = self.read_json_body()
            try:
                stars = int(body.get("stars") or 0)
            except (TypeError, ValueError):
                stars = 0
            stars = max(0, min(5, stars))
            conn = db()
            conn.execute("UPDATE scans SET stars = ? WHERE id = ? AND user_id = ?", (stars, scan_id, user["id"]))
            conn.commit()
            conn.close()
            self._json(200, {"ok": True, "stars": stars})
            return
        if path == "/api/contacts":
            user = self.require_user()
            if not user:
                return
            body = self.read_json_body()
            name = str(body.get("name") or "").strip()[:80]
            phone = str(body.get("phone") or "").strip()[:40]
            note = str(body.get("note") or "").strip()[:120]
            if not name:
                self._json(400, {"error": "Contact name is required."})
                return
            now = datetime.now(timezone.utc).isoformat()
            cid = str(uuid.uuid4())
            conn = db()
            conn.execute("INSERT INTO contacts (id, user_id, name, phone, note, created_at) VALUES (?,?,?,?,?,?)", (cid, user["id"], name, phone, note, now))
            conn.commit()
            conn.close()
            self._json(200, {"contact": {"id": cid, "user_id": user["id"], "name": name, "phone": phone, "note": note, "created_at": now}})
            return
        if path in ("/api/watch", "/api/watch/clear", "/api/watch/ack"):
            user = self.require_user()
            if not user:
                return
            now = datetime.now(timezone.utc).isoformat()
            if path.endswith("/clear"):
                conn = db()
                conn.execute("UPDATE watches SET status = 'cleared' WHERE user_id = ? AND status = 'armed'", (user["id"],))
                conn.commit()
                conn.close()
                self._json(200, {"ok": True, "smsBackend": sms_backend()})
                return
            if path.endswith("/ack"):
                conn = db()
                conn.execute(
                    "UPDATE watches SET status = 'fired_client', fired_at = ? WHERE user_id = ? AND status IN ('armed', 'pending_client')",
                    (now, user["id"]),
                )
                conn.commit()
                conn.close()
                self._json(200, {"ok": True})
                return
            body = self.read_json_body()
            try:
                until_ms = int(body.get("until") or 0)
            except (TypeError, ValueError):
                until_ms = 0
            if until_ms < int(time.time() * 1000) + 5000:
                self._json(400, {"error": "Timer is too short."})
                return
            try:
                lat_f = float(body.get("lat")) if body.get("lat") not in (None, "") else None
                lng_f = float(body.get("lng")) if body.get("lng") not in (None, "") else None
            except (TypeError, ValueError):
                lat_f = lng_f = None
            conn = db()
            conn.execute("UPDATE watches SET status = 'cleared' WHERE user_id = ? AND status = 'armed'", (user["id"],))
            contact = conn.fetchone("SELECT phone FROM contacts WHERE user_id = ? AND phone <> '' LIMIT 1", (user["id"],))
            phone = str((contact or {}).get("phone") or "").strip()[:40]
            wid = str(uuid.uuid4())
            conn.execute(
                "INSERT INTO watches (id, user_id, until_ms, lat, lng, phone, status, created_at) VALUES (?,?,?,?,?,?,?,?)",
                (wid, user["id"], until_ms, lat_f, lng_f, phone, "armed", now),
            )
            conn.commit()
            conn.close()
            self._json(200, {"ok": True, "id": wid, "smsBackend": sms_backend(), "phone": bool(phone)})
            return
        if path in ("/api/sos", "/api/checkin"):
            user = self.require_user()
            if not user:
                return
            body = self.read_json_body()
            kind = "sos" if path.endswith("sos") else str(body.get("kind") or "ok")
            if kind not in ("sos", "ok"):
                kind = "ok"
            lat = body.get("lat")
            lng = body.get("lng")
            try:
                lat_f = float(lat) if lat is not None and lat != "" else None
                lng_f = float(lng) if lng is not None and lng != "" else None
            except (TypeError, ValueError):
                lat_f = lng_f = None
            now = datetime.now(timezone.utc).isoformat()
            maps = ""
            if lat_f is not None and lng_f is not None:
                maps = f"https://maps.google.com/?q={lat_f},{lng_f}"
            em = emergency_for(lat_f, lng_f)
            medical = ice_text(user)
            message = str(body.get("message") or "").strip()
            if not message:
                if kind == "sos":
                    bits = ["QUEENDAR SOS — I need help."]
                    if maps:
                        bits.append(maps)
                    if em.get("primary"):
                        bits.append(f"Local emergency {em.get('primary')} ({em.get('country') or ''})".strip())
                    if medical:
                        bits.append(medical)
                    message = " ".join(bits).strip()
                else:
                    message = f"Queendar check-in: I'm safe. {maps}".strip()
            cid = str(uuid.uuid4())
            conn = db()
            conn.execute(
                "INSERT INTO checkins (id, user_id, kind, lat, lng, message, created_at) VALUES (?,?,?,?,?,?,?)",
                (cid, user["id"], kind, lat_f, lng_f, message[:800], now),
            )
            contacts = conn.fetchall("SELECT * FROM contacts WHERE user_id = ?", (user["id"],))
            conn.commit()
            conn.close()
            self._json(
                200,
                {
                    "ok": True,
                    "checkin": {"id": cid, "kind": kind, "lat": lat_f, "lng": lng_f, "message": message, "created_at": now, "maps": maps},
                    "contacts": contacts,
                    "emergency": em,
                    "ice": ice_card(user),
                },
            )
            return
        if path == "/api/incidents":
            user = self.require_user()
            if not user:
                return
            body = self.read_json_body()
            kind = str(body.get("kind") or "").strip().lower()
            if kind not in INCIDENT_KINDS:
                self._json(400, {"error": "Pick a valid alert type."})
                return
            note = str(body.get("note") or "").strip()[:180]
            try:
                lat_f = float(body.get("lat"))
                lng_f = float(body.get("lng"))
            except (TypeError, ValueError):
                self._json(400, {"error": "Location is required to post an alert."})
                return
            now = datetime.now(timezone.utc).isoformat()
            since = (datetime.now(timezone.utc) - timedelta(hours=6)).isoformat()
            iid = str(uuid.uuid4())
            conn = db()
            recent = conn.fetchone("SELECT count(*) AS n FROM incidents WHERE user_id = ? AND created_at >= ?", (user["id"], since))
            if int(recent["n"] if recent else 0) >= 8:
                conn.close()
                self._json(429, {"error": "Slow down — you can post more alerts later."})
                return
            window = (datetime.now(timezone.utc) - timedelta(minutes=45)).isoformat()
            twins = conn.fetchall("SELECT * FROM incidents WHERE kind = ? AND created_at >= ?", (kind, window))
            match = None
            for twin in twins:
                try:
                    if haversine(lat_f, lng_f, float(twin["lat"]), float(twin["lng"])) <= 0.4:
                        match = twin
                        break
                except (TypeError, ValueError):
                    continue
            if match:
                voted = conn.fetchone("SELECT user_id FROM incident_votes WHERE incident_id = ? AND user_id = ?", (match["id"], user["id"]))
                if not voted:
                    conn.execute("INSERT INTO incident_votes (incident_id, user_id) VALUES (?,?)", (match["id"], user["id"]))
                    conn.execute("UPDATE incidents SET confirms = confirms + 1 WHERE id = ?", (match["id"],))
                if note and note not in str(match.get("note") or ""):
                    merged_note = ((match.get("note") or "") + (" · " if match.get("note") else "") + note)[:180]
                    conn.execute("UPDATE incidents SET note = ? WHERE id = ?", (merged_note, match["id"]))
                conn.commit()
                row = conn.fetchone("SELECT * FROM incidents WHERE id = ?", (match["id"],))
                conn.close()
                self._json(200, {"ok": True, "merged": True, "incident": public_incident(row, lat_f, lng_f)})
                return
            conn.execute(
                "INSERT INTO incidents (id, user_id, kind, note, lat, lng, confirms, created_at) VALUES (?,?,?,?,?,?,?,?)",
                (iid, user["id"], kind, note, lat_f, lng_f, 1, now),
            )
            conn.execute("INSERT INTO incident_votes (incident_id, user_id) VALUES (?,?)", (iid, user["id"]))
            conn.commit()
            row = conn.fetchone("SELECT * FROM incidents WHERE id = ?", (iid,))
            conn.close()
            self._json(200, {"ok": True, "incident": public_incident(row, lat_f, lng_f)})
            return
        if path.startswith("/api/incidents/") and path.endswith("/confirm"):
            user = self.require_user()
            if not user:
                return
            iid = path.split("/")[3]
            conn = db()
            row = conn.fetchone("SELECT * FROM incidents WHERE id = ?", (iid,))
            if not row:
                conn.close()
                self._json(404, {"error": "Alert not found."})
                return
            voted = conn.fetchone("SELECT user_id FROM incident_votes WHERE incident_id = ? AND user_id = ?", (iid, user["id"]))
            if voted:
                conn.close()
                self._json(200, {"ok": True, "already": True, "incident": public_incident(row)})
                return
            conn.execute("INSERT INTO incident_votes (incident_id, user_id) VALUES (?,?)", (iid, user["id"]))
            conn.execute("UPDATE incidents SET confirms = confirms + 1 WHERE id = ?", (iid,))
            conn.commit()
            row = conn.fetchone("SELECT * FROM incidents WHERE id = ?", (iid,))
            conn.close()
            self._json(200, {"ok": True, "incident": public_incident(row)})
            return
        if path == "/api/plus/checkout":
            user = self.require_user()
            if not user:
                return
            if user.get("premium") in ("lifetime", "plus", "pro"):
                self._json(200, {"ok": True, "already": True, "user": user_payload(user)})
                return
            if not STRIPE_SECRET:
                self._json(503, {"error": "Plus checkout is not configured yet."})
                return
            try:
                session = stripe_form({
                    "mode": "subscription",
                    "success_url": f"{PUBLIC_URL}/?plus=success&session_id={{CHECKOUT_SESSION_ID}}",
                    "cancel_url": f"{PUBLIC_URL}/?plus=cancel",
                    "client_reference_id": user["id"],
                    "customer_email": user.get("email") or "",
                    "line_items[0][quantity]": 1,
                    "line_items[0][price_data][currency]": "eur",
                    "line_items[0][price_data][recurring][interval]": "month",
                    "line_items[0][price_data][unit_amount]": 499,
                    "line_items[0][price_data][product_data][name]": "QueenDar Plus",
                })
                self._json(200, {"ok": True, "url": session.get("url"), "id": session.get("id")})
            except urllib.error.HTTPError as exc:
                self._json(502, {"error": exc.read().decode()[:240]})
            except Exception as exc:
                self._json(502, {"error": str(exc)[:240]})
            return
        if path == "/api/plus/confirm":
            user = self.require_user()
            if not user:
                return
            body = self.read_json_body()
            session_id = str(body.get("session_id") or body.get("sessionId") or "").strip()
            if not STRIPE_SECRET or not session_id:
                self._json(400, {"error": "Missing checkout session."})
                return
            try:
                session = stripe_get(session_id)
            except Exception as exc:
                self._json(502, {"error": str(exc)[:200]})
                return
            paid = session.get("payment_status") in ("paid", "no_payment_required") or session.get("status") == "complete"
            if paid and (session.get("client_reference_id") == user["id"] or session.get("customer_email") == user.get("email")):
                conn = db()
                conn.execute("UPDATE users SET premium = ? WHERE id = ? AND premium != 'lifetime'", ("plus", user["id"]))
                conn.commit()
                row = conn.fetchone("SELECT * FROM users WHERE id = ?", (user["id"],))
                conn.close()
                self._json(200, {"ok": True, "user": user_payload(row)})
                return
            self._json(400, {"error": "Payment not complete."})
            return
        self._json(404, {"error": "not found"})

    def do_DELETE(self):
        path = self.path.split("?")[0]
        user = self.require_user()
        if not user:
            return
        if path.startswith("/api/logs/"):
            log_id = path.rsplit("/", 1)[-1]
            conn = db()
            conn.execute("DELETE FROM crown_logs WHERE id = ? AND user_id = ?", (log_id, user["id"]))
            conn.commit()
            conn.close()
            self._json(200, {"ok": True})
            return
        if path.startswith("/api/contacts/"):
            cid = path.rsplit("/", 1)[-1]
            conn = db()
            conn.execute("DELETE FROM contacts WHERE id = ? AND user_id = ?", (cid, user["id"]))
            conn.commit()
            conn.close()
            self._json(200, {"ok": True})
            return
        if path == "/api/account":
            conn = db()
            conn.execute("DELETE FROM crown_logs WHERE user_id = ?", (user["id"],))
            conn.execute("DELETE FROM scans WHERE user_id = ?", (user["id"],))
            conn.execute("DELETE FROM contacts WHERE user_id = ?", (user["id"],))
            conn.execute("DELETE FROM checkins WHERE user_id = ?", (user["id"],))
            conn.execute("DELETE FROM watches WHERE user_id = ?", (user["id"],))
            conn.execute("DELETE FROM incident_votes WHERE user_id = ?", (user["id"],))
            conn.execute("DELETE FROM users WHERE id = ?", (user["id"],))
            conn.commit()
            conn.close()
            self._json(200, {"ok": True})
            return
        self._json(404, {"error": "not found"})

    def log_message(self, *_args):
        return


if __name__ == "__main__":
    threading.Thread(target=watch_loop, daemon=True).start()
    ThreadingHTTPServer(("127.0.0.1", 3019), Handler).serve_forever()
