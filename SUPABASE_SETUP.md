# Supabase — Instrucciones de integración

## Setup (una sola vez)

### 1. Crear proyecto en supabase.com (free tier, 500 MB suficiente)

### 2. Ejecutar este SQL en el SQL Editor de Supabase

```sql
CREATE TABLE activities (
    id            BIGINT      NOT NULL,
    user_id       TEXT        NOT NULL,
    sport         TEXT        NOT NULL,  -- 'cycling','mountain_biking','running','swimming'
    date          DATE        NOT NULL,
    data          JSONB       NOT NULL,  -- dict completo normalizado de _norm()
    synced_at     TIMESTAMPTZ DEFAULT NOW(),
    PRIMARY KEY (user_id, id)
);
CREATE INDEX ON activities (user_id, sport, date);

CREATE TABLE daily_steps (
    user_id       TEXT    NOT NULL,
    date          DATE    NOT NULL,
    steps         INT,
    distance_km   FLOAT,
    calories      INT,
    step_goal     INT,
    goal_achieved BOOL,
    PRIMARY KEY (user_id, date)
);

CREATE TABLE goals (
    user_id  TEXT PRIMARY KEY,
    data     JSONB NOT NULL DEFAULT '{}'
);
```

### 3. Crear `.streamlit/secrets.toml` (ya en .gitignore)

```toml
[supabase]
url = "https://xxxx.supabase.co"
key = "eyJhb..."
```

### 4. Añadir a `requirements.txt`

```
supabase>=2.0.0
```

### 5. En Streamlit Cloud

App Settings → Secrets → pegar el mismo contenido de secrets.toml

---

## `db.py` — Módulo de persistencia (crear en raíz del proyecto)

```python
from supabase import create_client
import streamlit as st


def _client():
    cfg = st.secrets["supabase"]
    return create_client(cfg["url"], cfg["key"])


# ── Activities ────────────────────────────────────────────────────────────────

def get_cached_activities(user_id: str, sport: str, start: str, end: str) -> list[dict]:
    resp = (_client().table("activities")
            .select("data")
            .eq("user_id", user_id)
            .eq("sport", sport)
            .gte("date", start)
            .lte("date", end)
            .execute())
    return [r["data"] for r in resp.data]


def upsert_activities(user_id: str, sport: str, activities: list[dict]):
    rows = [{"id": a["id"], "user_id": user_id, "sport": sport,
             "date": a["date"], "data": a} for a in activities if a.get("id")]
    if rows:
        _client().table("activities").upsert(rows).execute()


def get_missing_date_ranges(user_id: str, sport: str, start: str, end: str) -> list[tuple]:
    """
    Devuelve sub-rangos (start, end) que faltan en caché.
    Siempre re-fetchea los últimos 14 días.
    """
    from datetime import date, timedelta, datetime
    today = date.today()
    fresh_cutoff = (today - timedelta(days=14)).isoformat()

    resp = (_client().table("activities")
            .select("date")
            .eq("user_id", user_id)
            .eq("sport", sport)
            .gte("date", start)
            .lt("date", fresh_cutoff)
            .execute())
    cached_dates = {r["date"] for r in resp.data}

    s = datetime.strptime(start, "%Y-%m-%d").date()
    e = min(datetime.strptime(end, "%Y-%m-%d").date(), today)

    missing = []
    cur = s
    while cur <= e:
        month_end = cur.replace(day=28) + timedelta(days=4)
        month_end = month_end.replace(day=1) - timedelta(days=1)
        month_end = min(month_end, e)
        month_str = cur.isoformat()[:7]
        is_recent = cur.isoformat() >= fresh_cutoff
        has_cached = any(d.startswith(month_str) for d in cached_dates)
        if is_recent or not has_cached:
            missing.append((cur.isoformat(), month_end.isoformat()))
        cur = month_end + timedelta(days=1)
    return missing


# ── Daily Steps ───────────────────────────────────────────────────────────────

def get_cached_steps(user_id: str, start: str, end: str) -> list[dict]:
    resp = (_client().table("daily_steps")
            .select("*")
            .eq("user_id", user_id)
            .gte("date", start)
            .lte("date", end)
            .execute())
    return resp.data


def upsert_steps(user_id: str, days: list[dict]):
    rows = [{"user_id": user_id, "date": d["date"], "steps": d["steps"],
             "distance_km": d["distanceKm"], "calories": d.get("calories", 0),
             "step_goal": d.get("stepGoal", 10000),
             "goal_achieved": d.get("goalAchieved", False)} for d in days]
    if rows:
        _client().table("daily_steps").upsert(rows).execute()


# ── Goals ─────────────────────────────────────────────────────────────────────

DEFAULT_GOALS = {
    "road": {"week": {"km": 0, "min": 0, "desnivel": 0},
             "month": {"km": 0, "min": 0, "desnivel": 0}},
    "mtb":  {"week": {"km": 0, "min": 0, "desnivel": 0},
             "month": {"km": 0, "min": 0, "desnivel": 0}},
    "run":  {"week": {"km": 0, "min": 0, "desnivel": 0},
             "month": {"km": 0, "min": 0, "desnivel": 0}},
    "swim": {"week": {"km": 0, "min": 0},
             "month": {"km": 0, "min": 0}},
}


def load_goals(user_id: str) -> dict:
    import copy
    resp = _client().table("goals").select("data").eq("user_id", user_id).execute()
    if resp.data:
        return resp.data[0]["data"]
    return copy.deepcopy(DEFAULT_GOALS)


def save_goals(user_id: str, goals: dict):
    _client().table("goals").upsert({"user_id": user_id, "data": goals}).execute()
```

---

## Cambios en `streamlit_app.py` al integrar Supabase

Reemplazar los `fetch_*` actuales (que llaman a Garmin cada vez) por versiones
que primero comprueban la caché de Supabase y solo hacen llamadas a Garmin
para los rangos de fechas que faltan. Ver el plan completo en
`/root/.claude/plans/synthetic-splashing-cherny.md`.
