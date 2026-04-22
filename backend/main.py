from fastapi import FastAPI, HTTPException, Depends, Response
from fastapi.middleware.cors import CORSMiddleware
from fastapi.security import HTTPBearer, HTTPAuthorizationCredentials
from pydantic import BaseModel
from datetime import date, datetime, timedelta
from typing import Optional
import json
import os

from garmin_client import GarminClient, GarminAuthError
from cache import cache_get, cache_set

app = FastAPI(title="Garmin Dashboard API", version="1.0.0")

# ALLOWED_ORIGINS env var: comma-separated list of allowed origins.
# When unset (production default) we allow all origins with credentials=False,
# which is correct for Bearer-token auth (tokens live in headers, not cookies).
_raw = os.getenv("ALLOWED_ORIGINS", "")
if _raw.strip():
    _origins = [o.strip() for o in _raw.split(",") if o.strip()]
    _credentials = True
else:
    _origins = ["*"]
    _credentials = False

app.add_middleware(
    CORSMiddleware,
    allow_origins=_origins,
    allow_credentials=_credentials,
    allow_methods=["*"],
    allow_headers=["*"],
)

security = HTTPBearer(auto_error=False)

# In-memory session store (token -> garmin client)
_sessions: dict[str, GarminClient] = {}


class LoginRequest(BaseModel):
    email: str
    password: str


class DateRangeParams(BaseModel):
    start_date: str = (date.today() - timedelta(days=30)).isoformat()
    end_date: str = date.today().isoformat()


def get_client(credentials: Optional[HTTPAuthorizationCredentials] = Depends(security)) -> GarminClient:
    if not credentials:
        raise HTTPException(status_code=401, detail="No token provided")
    token = credentials.credentials
    client = _sessions.get(token)
    if not client:
        raise HTTPException(status_code=401, detail="Session expired, please login again")
    return client


@app.post("/api/auth/login")
async def login(req: LoginRequest):
    try:
        client = GarminClient(req.email, req.password)
        token = client.login()
        _sessions[token] = client
        return {"token": token, "displayName": client.get_display_name()}
    except GarminAuthError as e:
        raise HTTPException(status_code=401, detail=str(e))
    except Exception as e:
        raise HTTPException(status_code=500, detail=f"Login failed: {str(e)}")


@app.post("/api/auth/logout")
async def logout(credentials: Optional[HTTPAuthorizationCredentials] = Depends(security)):
    if credentials and credentials.credentials in _sessions:
        del _sessions[credentials.credentials]
    return {"ok": True}


@app.get("/api/activities/cycling")
async def get_cycling_activities(
    start_date: str = (date.today() - timedelta(days=90)).isoformat(),
    end_date: str = date.today().isoformat(),
    client: GarminClient = Depends(get_client),
):
    cache_key = f"cycling:{client.user_id}:{start_date}:{end_date}"
    cached = cache_get(cache_key)
    if cached:
        return cached

    data = client.get_cycling_activities(start_date, end_date)
    cache_set(cache_key, data, ttl=300)
    return data


@app.get("/api/activities/running")
async def get_running_activities(
    start_date: str = (date.today() - timedelta(days=90)).isoformat(),
    end_date: str = date.today().isoformat(),
    client: GarminClient = Depends(get_client),
):
    cache_key = f"running:{client.user_id}:{start_date}:{end_date}"
    cached = cache_get(cache_key)
    if cached:
        return cached

    data = client.get_running_activities(start_date, end_date)
    cache_set(cache_key, data, ttl=300)
    return data


@app.get("/api/steps/daily")
async def get_daily_steps(
    start_date: str = (date.today() - timedelta(days=30)).isoformat(),
    end_date: str = date.today().isoformat(),
    client: GarminClient = Depends(get_client),
):
    cache_key = f"steps:{client.user_id}:{start_date}:{end_date}"
    cached = cache_get(cache_key)
    if cached:
        return cached

    data = client.get_daily_steps(start_date, end_date)
    cache_set(cache_key, data, ttl=300)
    return data


@app.get("/api/stats/summary")
async def get_summary(
    client: GarminClient = Depends(get_client),
):
    cache_key = f"summary:{client.user_id}"
    cached = cache_get(cache_key)
    if cached:
        return cached

    data = client.get_summary()
    cache_set(cache_key, data, ttl=300)
    return data
