import uuid
import hashlib
from datetime import date, datetime, timedelta
from typing import Optional
from garminconnect import Garmin, GarminConnectAuthenticationError, GarminConnectTooManyRequestsError


class GarminAuthError(Exception):
    pass


class GarminClient:
    def __init__(self, email: str, password: str):
        self.email = email
        self.password = password
        self.user_id = hashlib.sha256(email.encode()).hexdigest()[:16]
        self._api: Optional[Garmin] = None

    def login(self) -> str:
        try:
            self._api = Garmin(self.email, self.password)
            self._api.login()
        except GarminConnectAuthenticationError as e:
            raise GarminAuthError(f"Invalid credentials: {e}")
        except Exception as e:
            raise GarminAuthError(f"Auth failed: {e}")

        token = hashlib.sha256(f"{self.email}{uuid.uuid4()}".encode()).hexdigest()
        return token

    def get_display_name(self) -> str:
        try:
            profile = self._api.get_full_name()
            return profile or self.email
        except Exception:
            return self.email

    def _activity_to_dict(self, act: dict) -> dict:
        """Normalize a Garmin activity record."""
        start_time = act.get("startTimeLocal") or act.get("startTimeGMT", "")
        duration_s = act.get("duration", 0) or 0
        distance_m = act.get("distance", 0) or 0
        avg_speed = act.get("averageSpeed", 0) or 0
        max_speed = act.get("maxSpeed", 0) or 0
        elevation_gain = act.get("elevationGain", 0) or 0
        avg_hr = act.get("averageHR", 0) or 0
        max_hr = act.get("maxHR", 0) or 0
        calories = act.get("calories", 0) or 0
        avg_power = act.get("avgPower", None)
        normalized_power = act.get("normPower", None)
        avg_cadence = act.get("averageBikingCadenceInRevPerMinute") or act.get("averageRunningCadenceInStepsPerMinute") or 0
        vo2max = act.get("vO2MaxValue", None)

        distance_km = round(distance_m / 1000, 2)
        duration_min = round(duration_s / 60, 1)

        # Speed conversions
        avg_speed_kmh = round(avg_speed * 3.6, 2) if avg_speed else 0
        max_speed_kmh = round(max_speed * 3.6, 2) if max_speed else 0

        # Pace (min/km)
        avg_pace = None
        if avg_speed and avg_speed > 0:
            pace_s_per_km = 1000 / avg_speed
            avg_pace = round(pace_s_per_km / 60, 2)

        return {
            "id": act.get("activityId"),
            "name": act.get("activityName", ""),
            "date": start_time[:10] if start_time else "",
            "startTime": start_time,
            "durationMin": duration_min,
            "distanceKm": distance_km,
            "avgSpeedKmh": avg_speed_kmh,
            "maxSpeedKmh": max_speed_kmh,
            "avgPaceMinKm": avg_pace,
            "elevationGainM": elevation_gain,
            "avgHr": avg_hr,
            "maxHr": max_hr,
            "calories": calories,
            "avgPower": avg_power,
            "normalizedPower": normalized_power,
            "avgCadence": avg_cadence,
            "vo2max": vo2max,
        }

    def get_cycling_activities(self, start_date: str, end_date: str) -> dict:
        activities = self._api.get_activities_by_date(start_date, end_date, activitytype="cycling")
        normalized = [self._activity_to_dict(a) for a in activities]
        normalized.sort(key=lambda x: x["date"])

        total_distance = round(sum(a["distanceKm"] for a in normalized), 2)
        total_time = round(sum(a["durationMin"] for a in normalized), 1)
        total_elevation = round(sum(a["elevationGainM"] for a in normalized), 0)
        avg_speed = round(
            sum(a["avgSpeedKmh"] for a in normalized) / len(normalized), 2
        ) if normalized else 0

        return {
            "activities": normalized,
            "summary": {
                "totalActivities": len(normalized),
                "totalDistanceKm": total_distance,
                "totalTimeMin": total_time,
                "totalElevationM": total_elevation,
                "avgSpeedKmh": avg_speed,
            },
        }

    def get_running_activities(self, start_date: str, end_date: str) -> dict:
        activities = self._api.get_activities_by_date(start_date, end_date, activitytype="running")
        normalized = [self._activity_to_dict(a) for a in activities]
        normalized.sort(key=lambda x: x["date"])

        total_distance = round(sum(a["distanceKm"] for a in normalized), 2)
        total_time = round(sum(a["durationMin"] for a in normalized), 1)
        valid_paces = [a["avgPaceMinKm"] for a in normalized if a["avgPaceMinKm"]]
        avg_pace = round(sum(valid_paces) / len(valid_paces), 2) if valid_paces else None

        return {
            "activities": normalized,
            "summary": {
                "totalActivities": len(normalized),
                "totalDistanceKm": total_distance,
                "totalTimeMin": total_time,
                "avgPaceMinKm": avg_pace,
            },
        }

    def get_daily_steps(self, start_date: str, end_date: str) -> dict:
        start = datetime.strptime(start_date, "%Y-%m-%d").date()
        end = datetime.strptime(end_date, "%Y-%m-%d").date()

        days = []
        current = start
        while current <= end:
            try:
                stats = self._api.get_stats(current.isoformat())
                steps = stats.get("totalSteps", 0) or 0
                distance_m = stats.get("totalDistanceMeters", 0) or 0
                calories = stats.get("activeKilocalories", 0) or 0
                goal = stats.get("dailyStepGoal", 10000) or 10000
                active_time = stats.get("highlyActiveSeconds", 0) or 0
                moderate_time = stats.get("moderateIntensityMinutes", 0) or 0
                vigorous_time = stats.get("vigorousIntensityMinutes", 0) or 0

                days.append({
                    "date": current.isoformat(),
                    "steps": steps,
                    "distanceKm": round(distance_m / 1000, 2),
                    "calories": calories,
                    "stepGoal": goal,
                    "goalAchieved": steps >= goal,
                    "activeTimeMin": round(active_time / 60, 1),
                    "moderateIntensityMin": moderate_time,
                    "vigorousIntensityMin": vigorous_time,
                })
            except Exception:
                days.append({
                    "date": current.isoformat(),
                    "steps": 0,
                    "distanceKm": 0,
                    "calories": 0,
                    "stepGoal": 10000,
                    "goalAchieved": False,
                    "activeTimeMin": 0,
                    "moderateIntensityMin": 0,
                    "vigorousIntensityMin": 0,
                })
            current += timedelta(days=1)

        total_steps = sum(d["steps"] for d in days)
        days_with_goal = sum(1 for d in days if d["goalAchieved"])
        avg_steps = round(total_steps / len(days), 0) if days else 0

        return {
            "days": days,
            "summary": {
                "totalDays": len(days),
                "totalSteps": total_steps,
                "avgDailySteps": avg_steps,
                "daysGoalAchieved": days_with_goal,
                "goalAchievedPct": round(days_with_goal / len(days) * 100, 1) if days else 0,
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
            stats = self._api.get_stats(today_str)
            steps_today = stats.get("totalSteps", 0) or 0
        except Exception:
            steps_today = 0

        return {
            "last30Days": {
                "cyclingActivities": len(cycling),
                "runningActivities": len(running),
                "cyclingDistanceKm": round(
                    sum((a.get("distance", 0) or 0) / 1000 for a in cycling), 1
                ),
                "runningDistanceKm": round(
                    sum((a.get("distance", 0) or 0) / 1000 for a in running), 1
                ),
            },
            "today": {
                "steps": steps_today,
            },
        }
