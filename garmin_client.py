import uuid
import hashlib
from datetime import date, datetime, timedelta
from typing import Optional
from garminconnect import Garmin, GarminConnectAuthenticationError


class GarminAuthError(Exception):
    pass


class GarminClient:
    def __init__(self, email: str, password: str):
        self.email = email
        self.password = password
        self.user_id = hashlib.sha256(email.encode()).hexdigest()[:16]
        self._api: Optional[Garmin] = None

    def login(self):
        try:
            self._api = Garmin(self.email, self.password)
            self._api.login()
        except GarminConnectAuthenticationError as e:
            raise GarminAuthError(f"Credenciales incorrectas: {e}")
        except Exception as e:
            raise GarminAuthError(f"Error de conexión: {e}")

    def get_display_name(self) -> str:
        try:
            return self._api.get_full_name() or self.email
        except Exception:
            return self.email

    def _norm(self, act: dict) -> dict:
        start = act.get("startTimeLocal") or act.get("startTimeGMT", "")
        dur_s = act.get("duration", 0) or 0
        dist_m = act.get("distance", 0) or 0
        spd = act.get("averageSpeed", 0) or 0
        elev = act.get("elevationGain", 0) or 0
        avg_hr = act.get("averageHR", 0) or 0
        calories = act.get("calories", 0) or 0
        avg_power = act.get("avgPower", None)
        cadence = (act.get("averageBikingCadenceInRevPerMinute")
                   or act.get("averageRunningCadenceInStepsPerMinute") or 0)

        dist_km = round(dist_m / 1000, 2)
        dur_min = round(dur_s / 60, 1)
        spd_kmh = round(spd * 3.6, 2) if spd else 0
        pace = round(1000 / spd / 60, 2) if spd else None

        def _zone_min(key):
            return round((act.get(key, 0) or 0) / 60, 1)

        return {
            "id": act.get("activityId"),
            "name": act.get("activityName", ""),
            "date": start[:10] if start else "",
            "durationMin": dur_min,
            "distanceKm": dist_km,
            "avgSpeedKmh": spd_kmh,
            "avgPaceMinKm": pace,
            "elevationGainM": elev,
            "avgHr": avg_hr,
            "calories": calories,
            "avgPower": avg_power,
            "avgCadence": cadence,
            "hrZ1Min": _zone_min("hrTimeInZone_1"),
            "hrZ2Min": _zone_min("hrTimeInZone_2"),
            "hrZ3Min": _zone_min("hrTimeInZone_3"),
            "hrZ4Min": _zone_min("hrTimeInZone_4"),
            "hrZ5Min": _zone_min("hrTimeInZone_5"),
        }

    def get_cycling_activities(self, start_date: str, end_date: str) -> dict:
        raw = self._api.get_activities_by_date(start_date, end_date, activitytype="cycling")
        acts = sorted([self._norm(a) for a in raw], key=lambda x: x["date"])
        total_dist = round(sum(a["distanceKm"] for a in acts), 2)
        total_time = round(sum(a["durationMin"] for a in acts), 1)
        total_elev = round(sum(a["elevationGainM"] for a in acts), 0)
        avg_spd = round(sum(a["avgSpeedKmh"] for a in acts) / len(acts), 2) if acts else 0
        return {
            "activities": acts,
            "summary": {
                "totalActivities": len(acts),
                "totalDistanceKm": total_dist,
                "totalTimeMin": total_time,
                "totalElevationM": total_elev,
                "avgSpeedKmh": avg_spd,
            },
        }

    def get_running_activities(self, start_date: str, end_date: str) -> dict:
        raw = self._api.get_activities_by_date(start_date, end_date, activitytype="running")
        acts = sorted([self._norm(a) for a in raw], key=lambda x: x["date"])
        total_dist = round(sum(a["distanceKm"] for a in acts), 2)
        total_time = round(sum(a["durationMin"] for a in acts), 1)
        paces = [a["avgPaceMinKm"] for a in acts if a["avgPaceMinKm"]]
        avg_pace = round(sum(paces) / len(paces), 2) if paces else None
        return {
            "activities": acts,
            "summary": {
                "totalActivities": len(acts),
                "totalDistanceKm": total_dist,
                "totalTimeMin": total_time,
                "avgPaceMinKm": avg_pace,
            },
        }

    def get_swimming_activities(self, start_date: str, end_date: str) -> dict:
        raw = self._api.get_activities_by_date(start_date, end_date, activitytype="swimming")
        acts = sorted([self._norm(a) for a in raw], key=lambda x: x["date"])
        return {
            "activities": acts,
            "summary": {
                "totalActivities": len(acts),
                "totalDistanceKm": round(sum(a["distanceKm"] for a in acts), 2),
                "totalTimeMin": round(sum(a["durationMin"] for a in acts), 1),
            },
        }

    def get_daily_steps(self, start_date: str, end_date: str) -> dict:
        start = datetime.strptime(start_date, "%Y-%m-%d").date()
        end = datetime.strptime(end_date, "%Y-%m-%d").date()
        days = []
        cur = start
        while cur <= end:
            try:
                s = self._api.get_stats(cur.isoformat())
                days.append({
                    "date": cur.isoformat(),
                    "steps": s.get("totalSteps", 0) or 0,
                    "distanceKm": round((s.get("totalDistanceMeters", 0) or 0) / 1000, 2),
                    "calories": s.get("activeKilocalories", 0) or 0,
                    "stepGoal": s.get("dailyStepGoal", 10000) or 10000,
                    "goalAchieved": (s.get("totalSteps", 0) or 0) >= (s.get("dailyStepGoal", 10000) or 10000),
                    "activeTimeMin": round((s.get("highlyActiveSeconds", 0) or 0) / 60, 1),
                })
            except Exception:
                days.append({
                    "date": cur.isoformat(), "steps": 0, "distanceKm": 0,
                    "calories": 0, "stepGoal": 10000, "goalAchieved": False, "activeTimeMin": 0,
                })
            cur += timedelta(days=1)

        total = sum(d["steps"] for d in days)
        goal_days = sum(1 for d in days if d["goalAchieved"])
        return {
            "days": days,
            "summary": {
                "totalDays": len(days),
                "totalSteps": total,
                "avgDailySteps": round(total / len(days)) if days else 0,
                "daysGoalAchieved": goal_days,
                "goalAchievedPct": round(goal_days / len(days) * 100, 1) if days else 0,
            },
        }

    def get_summary(self) -> dict:
        today = date.today()
        last30 = (today - timedelta(days=30)).isoformat()
        today_str = today.isoformat()
        try:
            cycling = self._api.get_activities_by_date(last30, today_str, activitytype="cycling")
        except Exception:
            cycling = []
        try:
            running = self._api.get_activities_by_date(last30, today_str, activitytype="running")
        except Exception:
            running = []
        try:
            steps_today = self._api.get_stats(today_str).get("totalSteps", 0) or 0
        except Exception:
            steps_today = 0
        return {
            "last30Days": {
                "cyclingActivities": len(cycling),
                "runningActivities": len(running),
                "cyclingDistanceKm": round(sum((a.get("distance", 0) or 0) / 1000 for a in cycling), 1),
                "runningDistanceKm": round(sum((a.get("distance", 0) or 0) / 1000 for a in running), 1),
            },
            "today": {"steps": steps_today},
        }
