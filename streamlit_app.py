import calendar
from datetime import date, timedelta

import pandas as pd
import plotly.graph_objects as go
import streamlit as st

from garmin_client import GarminAuthError, GarminClient

# ── Page config ───────────────────────────────────────────────────────────────
st.set_page_config(page_title="GarminDash", page_icon="🏃", layout="wide")
st.markdown(
    "<style>#MainMenu,footer,[data-testid='stDeployButton']{display:none}</style>",
    unsafe_allow_html=True,
)

# ── Colors ────────────────────────────────────────────────────────────────────
BLUE   = "#3b82f6"
GREEN  = "#22c55e"
ORANGE = "#f97316"
PURPLE = "#a855f7"
RED    = "#ef4444"
YELLOW = "#eab308"
GRAY   = "#9ca3af"
GRAY_L = "#d1d5db"

COMP_LABELS = {"week": "Sem. ant.", "month": "Mes ant.", "year": "Año ant."}

# ── Session state ─────────────────────────────────────────────────────────────
if "client" not in st.session_state:
    st.session_state.client = None
if "display_name" not in st.session_state:
    st.session_state.display_name = ""

# ── Helpers ───────────────────────────────────────────────────────────────────
def fmt_pace(p):
    if not p:
        return "—"
    return f"{int(p)}:{int((p % 1) * 60):02d} /km"

def fmt_dur(m):
    if not m:
        return "—"
    return f"{int(m // 60)}h {int(m % 60)}m" if m >= 60 else f"{int(m)}m"

def delta_pct(curr, prev):
    if not curr or not prev:
        return None
    return round((curr - prev) / abs(prev) * 100, 1)

def fmt_delta(curr, prev):
    d = delta_pct(curr, prev)
    return f"{d:+.1f}%" if d is not None else None

def comp_range(start: date, end: date, mode: str):
    if mode == "week":
        return start - timedelta(weeks=1), end - timedelta(weeks=1)
    if mode == "month":
        def sub1m(d):
            mo = d.month - 1 or 12
            yr = d.year if d.month > 1 else d.year - 1
            return d.replace(year=yr, month=mo, day=min(d.day, calendar.monthrange(yr, mo)[1]))
        return sub1m(start), sub1m(end)
    if mode == "year":
        try:
            return start.replace(year=start.year - 1), end.replace(year=end.year - 1)
        except ValueError:
            return start.replace(year=start.year - 1, day=28), end.replace(year=end.year - 1, day=28)
    return None, None

# ── Chart styling ─────────────────────────────────────────────────────────────
def _style(fig, height=300, legend=False):
    fig.update_layout(
        height=height,
        margin=dict(l=0, r=0, t=8, b=0),
        plot_bgcolor="white",
        paper_bgcolor="white",
        showlegend=legend,
        hovermode="x unified",
        legend=dict(orientation="h", y=-0.2, x=0),
        font=dict(size=12),
    )
    fig.update_xaxes(gridcolor="#f3f4f6", showline=False, tickfont_size=11)
    fig.update_yaxes(gridcolor="#f3f4f6", showline=False, tickfont_size=11)
    return fig

def show(fig, height=300, legend=False):
    st.plotly_chart(_style(fig, height, legend), use_container_width=True)

# ── Cached data fetchers ──────────────────────────────────────────────────────
@st.cache_data(ttl=300)
def fetch_cycling(_client, uid, s, e):
    return _client.get_cycling_activities(s, e)

@st.cache_data(ttl=300)
def fetch_running(_client, uid, s, e):
    return _client.get_running_activities(s, e)

@st.cache_data(ttl=300)
def fetch_steps(_client, uid, s, e):
    return _client.get_daily_steps(s, e)

@st.cache_data(ttl=300)
def fetch_summary(_client, uid):
    return _client.get_summary()

# ── Login ─────────────────────────────────────────────────────────────────────
def login_page():
    _, col, _ = st.columns([1, 1.1, 1])
    with col:
        st.markdown("## 🏃 GarminDash")
        st.caption("Dashboards de ciclismo, running y pasos para Garmin Connect.")
        st.divider()
        with st.form("login"):
            email    = st.text_input("Email", placeholder="tu@email.com")
            password = st.text_input("Contraseña", type="password")
            ok = st.form_submit_button("Conectar", use_container_width=True, type="primary")
        if ok:
            if not email or not password:
                st.error("Introduce email y contraseña.")
                return
            with st.spinner("Conectando con Garmin Connect…"):
                try:
                    c = GarminClient(email, password)
                    c.login()
                    st.session_state.client = c
                    st.session_state.display_name = c.get_display_name()
                    st.rerun()
                except GarminAuthError as e:
                    st.error(str(e))
                except Exception as e:
                    st.error(f"Error inesperado: {e}")
        st.caption("Las credenciales solo se usan para conectar con Garmin y no se guardan en disco.")

# ── Sidebar ───────────────────────────────────────────────────────────────────
def sidebar():
    with st.sidebar:
        st.markdown("### 🏃 GarminDash")
        st.caption(st.session_state.display_name)
        if st.button("Cerrar sesión", use_container_width=True):
            st.session_state.client = None
            st.cache_data.clear()
            st.rerun()
        st.divider()

        page = st.radio(
            "Página",
            ["📊 Resumen", "🚴 Ciclismo", "🏃 Running", "👣 Pasos"],
            label_visibility="collapsed",
        )
        st.divider()

        hoy = date.today()
        st.markdown("**Período**")
        start_date = st.date_input("Desde", hoy - timedelta(days=90))
        end_date   = st.date_input("Hasta", hoy)

        st.markdown("**Comparar con**")
        comp_sel = st.selectbox(
            "Comparar", ["Sin comparar", "Semana anterior", "Mes anterior", "Año anterior"],
            label_visibility="collapsed",
        )
        comp_mode = {"Sin comparar": None, "Semana anterior": "week",
                     "Mes anterior": "month", "Año anterior": "year"}[comp_sel]

        st.divider()
        st.caption("Caché: 5 min")

    return page, start_date, end_date, comp_mode

# ── Summary ───────────────────────────────────────────────────────────────────
def page_summary(client, uid):
    with st.spinner("Cargando resumen…"):
        data = fetch_summary(client, uid)
    l30  = data["last30Days"]
    hoy  = data["today"]

    st.title("📊 Resumen — últimos 30 días")
    c = st.columns(4)
    c[0].metric("🚴 Salidas bici",    l30["cyclingActivities"])
    c[1].metric("🚴 Km bici",         f"{l30['cyclingDistanceKm']:.1f} km")
    c[2].metric("🏃 Salidas running", l30["runningActivities"])
    c[3].metric("🏃 Km running",      f"{l30['runningDistanceKm']:.1f} km")
    st.divider()
    st.metric("👣 Pasos hoy", f"{hoy['steps']:,}".replace(",", "."))

# ── Cycling ───────────────────────────────────────────────────────────────────
def page_cycling(client, uid, start, end, cmode):
    s, e = start.isoformat(), end.isoformat()
    with st.spinner("Cargando ciclismo…"):
        data  = fetch_cycling(client, uid, s, e)
        cdata = None
        if cmode:
            cs, ce = comp_range(start, end, cmode)
            if cs:
                cdata = fetch_cycling(client, uid, cs.isoformat(), ce.isoformat())

    acts   = data["activities"];  sm  = data["summary"]
    cacts  = cdata["activities"] if cdata else []
    csm    = cdata["summary"]    if cdata else None
    clabel = COMP_LABELS.get(cmode, "")
    has_c  = bool(cacts)

    st.title("🚴 Ciclismo")
    if not acts:
        st.warning("Sin actividades en este período."); return

    # KPIs
    c = st.columns(4)
    c[0].metric("Actividades",   sm["totalActivities"],              fmt_delta(sm["totalActivities"],  csm["totalActivities"]  if csm else None))
    c[1].metric("Distancia",     f"{sm['totalDistanceKm']:.1f} km",  fmt_delta(sm["totalDistanceKm"],  csm["totalDistanceKm"]  if csm else None))
    c[2].metric("Tiempo",        fmt_dur(sm["totalTimeMin"]),         fmt_delta(sm["totalTimeMin"],     csm["totalTimeMin"]     if csm else None))
    c[3].metric("Desnivel",      f"{sm['totalElevationM']:.0f} m",   fmt_delta(sm["totalElevationM"],  csm["totalElevationM"]  if csm else None))

    df  = pd.DataFrame(acts).assign(label=lambda d: [f"Sal. {i+1}" for i in range(len(d))])
    dfc = pd.DataFrame(cacts).assign(label=lambda d: [f"Sal. {i+1}" for i in range(len(d))]) if has_c else None

    # Distance
    st.subheader("Distancia por actividad (km)")
    fig = go.Figure()
    fig.add_bar(x=df.label, y=df.distanceKm, name="Actual", marker_color=BLUE)
    if has_c:
        fig.add_scatter(x=dfc.label, y=dfc.distanceKm, name=clabel,
                        line=dict(color=GRAY, dash="dash", width=2), mode="lines")
    show(fig, legend=has_c)

    col1, col2 = st.columns(2)
    with col1:
        st.subheader("Velocidad media (km/h)")
        fig = go.Figure()
        fig.add_scatter(x=df.label, y=df.avgSpeedKmh, name="Actual",
                        line=dict(color=ORANGE, width=2), mode="lines")
        if has_c:
            fig.add_scatter(x=dfc.label, y=dfc.avgSpeedKmh, name=clabel,
                            line=dict(color=GRAY, dash="dash", width=2), mode="lines")
        show(fig, legend=has_c)

    with col2:
        st.subheader("Desnivel positivo (m)")
        fig = go.Figure()
        fig.add_bar(x=df.label, y=df.elevationGainM, name="Actual", marker_color=PURPLE)
        if has_c:
            fig.add_scatter(x=dfc.label, y=dfc.elevationGainM, name=clabel,
                            line=dict(color=GRAY, dash="dash", width=2), mode="lines")
        show(fig, legend=has_c)

    # Cumulative
    st.subheader("Distancia acumulada (km)")
    df["cum"] = df.distanceKm.cumsum()
    fig = go.Figure()
    if has_c:
        dfc["cum"] = dfc.distanceKm.cumsum()
        fig.add_scatter(x=dfc.label, y=dfc.cum, name=clabel,
                        fill="tozeroy", fillcolor="rgba(156,163,175,0.08)",
                        line=dict(color=GRAY, dash="dash", width=2), mode="lines")
    fig.add_scatter(x=df.label, y=df.cum, name="Actual",
                    fill="tozeroy", fillcolor="rgba(59,130,246,0.1)",
                    line=dict(color=BLUE, width=2.5), mode="lines")
    show(fig, legend=has_c)

    # FC
    df_hr = df[df.avgHr > 0]
    if not df_hr.empty:
        st.subheader("Frecuencia cardíaca media (bpm)")
        fig = go.Figure()
        fig.add_scatter(x=df_hr.label, y=df_hr.avgHr, name="Actual",
                        line=dict(color=RED, width=2), mode="lines")
        if has_c:
            dfc_hr = dfc[dfc.avgHr > 0]
            if not dfc_hr.empty:
                fig.add_scatter(x=dfc_hr.label, y=dfc_hr.avgHr, name=clabel,
                                line=dict(color=GRAY, dash="dash", width=2), mode="lines")
        show(fig, legend=has_c)

    # Power
    df_p = df[df.avgPower.notna() & (df.avgPower > 0)]
    if not df_p.empty:
        st.subheader("Potencia media (W)")
        fig = go.Figure()
        fig.add_scatter(x=df_p.label, y=df_p.avgPower, name="Actual",
                        line=dict(color=YELLOW, width=2), mode="lines")
        if has_c:
            dfc_p = dfc[dfc.avgPower.notna() & (dfc.avgPower > 0)]
            if not dfc_p.empty:
                fig.add_scatter(x=dfc_p.label, y=dfc_p.avgPower, name=clabel,
                                line=dict(color=GRAY, dash="dash", width=2), mode="lines")
        show(fig, legend=has_c)

    # Table
    st.subheader("Últimas actividades")
    tbl = df[["date","name","distanceKm","durationMin","avgSpeedKmh","elevationGainM","avgHr","calories"]]\
        .sort_values("date", ascending=False).head(20).copy()
    tbl["date"] = pd.to_datetime(tbl.date).dt.strftime("%d %b")
    tbl["durationMin"] = tbl.durationMin.apply(fmt_dur)
    tbl.columns = ["Fecha","Nombre","Dist. (km)","Tiempo","Vel. (km/h)","Desnivel (m)","FC","Cal."]
    st.dataframe(tbl, use_container_width=True, hide_index=True)

# ── Running ───────────────────────────────────────────────────────────────────
def page_running(client, uid, start, end, cmode):
    s, e = start.isoformat(), end.isoformat()
    with st.spinner("Cargando running…"):
        data  = fetch_running(client, uid, s, e)
        cdata = None
        if cmode:
            cs, ce = comp_range(start, end, cmode)
            if cs:
                cdata = fetch_running(client, uid, cs.isoformat(), ce.isoformat())

    acts   = data["activities"];  sm  = data["summary"]
    cacts  = cdata["activities"] if cdata else []
    csm    = cdata["summary"]    if cdata else None
    clabel = COMP_LABELS.get(cmode, "")
    has_c  = bool(cacts)

    st.title("🏃 Running")
    if not acts:
        st.warning("Sin actividades en este período."); return

    # KPIs (pace: lower is better → delta_color inverse)
    c = st.columns(4)
    c[0].metric("Actividades",  sm["totalActivities"],             fmt_delta(sm["totalActivities"], csm["totalActivities"] if csm else None))
    c[1].metric("Distancia",    f"{sm['totalDistanceKm']:.1f} km", fmt_delta(sm["totalDistanceKm"], csm["totalDistanceKm"] if csm else None))
    c[2].metric("Tiempo",       fmt_dur(sm["totalTimeMin"]),        fmt_delta(sm["totalTimeMin"],    csm["totalTimeMin"]    if csm else None))
    pace_delta = fmt_delta(sm.get("avgPaceMinKm"), csm.get("avgPaceMinKm") if csm else None)
    c[3].metric("Ritmo medio",  fmt_pace(sm.get("avgPaceMinKm")),  pace_delta, delta_color="inverse")

    df  = pd.DataFrame(acts).assign(label=lambda d: [f"Sal. {i+1}" for i in range(len(d))])
    dfc = pd.DataFrame(cacts).assign(label=lambda d: [f"Sal. {i+1}" for i in range(len(d))]) if has_c else None

    # Distance
    st.subheader("Distancia por actividad (km)")
    fig = go.Figure()
    fig.add_bar(x=df.label, y=df.distanceKm, name="Actual", marker_color=GREEN)
    if has_c:
        fig.add_scatter(x=dfc.label, y=dfc.distanceKm, name=clabel,
                        line=dict(color=GRAY, dash="dash", width=2), mode="lines")
    show(fig, legend=has_c)

    col1, col2 = st.columns(2)
    with col1:
        st.subheader("Ritmo (min/km) — eje invertido")
        df_p = df[df.avgPaceMinKm.notna()]
        fig = go.Figure()
        fig.add_scatter(
            x=df_p.label, y=df_p.avgPaceMinKm, name="Actual",
            line=dict(color=GREEN, width=2), mode="lines",
            customdata=[fmt_pace(p) for p in df_p.avgPaceMinKm],
            hovertemplate="%{x}: %{customdata}<extra></extra>",
        )
        if has_c:
            dfc_p = dfc[dfc.avgPaceMinKm.notna()]
            if not dfc_p.empty:
                fig.add_scatter(x=dfc_p.label, y=dfc_p.avgPaceMinKm, name=clabel,
                                line=dict(color=GRAY, dash="dash", width=2), mode="lines")
        fig.update_yaxes(autorange="reversed")
        show(fig, legend=has_c)

    with col2:
        st.subheader("Zonas de ritmo")
        zones = [("<4:00",0,4),("4-4:30",4,4.5),("4:30-5",4.5,5),
                 ("5-5:30",5,5.5),("5:30-6",5.5,6),(">6:00",6,1e9)]
        zcolors = [RED,ORANGE,YELLOW,GREEN,BLUE,PURPLE]
        znames  = [z[0] for z in zones]
        zcounts = [sum(1 for a in acts  if a.get("avgPaceMinKm") and z[1] <= a["avgPaceMinKm"] < z[2]) for z in zones]
        ccounts = [sum(1 for a in cacts if a.get("avgPaceMinKm") and z[1] <= a["avgPaceMinKm"] < z[2]) for z in zones] if has_c else []
        fig = go.Figure()
        if has_c:
            fig.add_bar(y=znames, x=ccounts, name=clabel, marker_color=GRAY_L, orientation="h")
        fig.add_bar(y=znames, x=zcounts, name="Actual", marker_color=zcolors, orientation="h")
        fig.update_layout(barmode="group")
        show(fig, legend=has_c)

    # Cumulative
    st.subheader("Distancia acumulada (km)")
    df["cum"] = df.distanceKm.cumsum()
    fig = go.Figure()
    if has_c:
        dfc["cum"] = dfc.distanceKm.cumsum()
        fig.add_scatter(x=dfc.label, y=dfc.cum, name=clabel,
                        fill="tozeroy", fillcolor="rgba(156,163,175,0.08)",
                        line=dict(color=GRAY, dash="dash", width=2), mode="lines")
    fig.add_scatter(x=df.label, y=df.cum, name="Actual",
                    fill="tozeroy", fillcolor="rgba(34,197,94,0.1)",
                    line=dict(color=GREEN, width=2.5), mode="lines")
    show(fig, legend=has_c)

    # FC
    df_hr = df[df.avgHr > 0]
    if not df_hr.empty:
        st.subheader("FC media por salida (bpm)")
        fig = go.Figure()
        fig.add_scatter(x=df_hr.label, y=df_hr.avgHr, name="Actual",
                        line=dict(color=RED, width=2), mode="lines")
        if has_c:
            dfc_hr = dfc[dfc.avgHr > 0]
            if not dfc_hr.empty:
                fig.add_scatter(x=dfc_hr.label, y=dfc_hr.avgHr, name=clabel,
                                line=dict(color=GRAY, dash="dash", width=2), mode="lines")
        show(fig, legend=has_c)

    # Table
    st.subheader("Últimas salidas")
    tbl = df[["date","name","distanceKm","durationMin","avgPaceMinKm","avgHr","calories"]]\
        .sort_values("date", ascending=False).head(20).copy()
    tbl["date"]        = pd.to_datetime(tbl.date).dt.strftime("%d %b")
    tbl["durationMin"] = tbl.durationMin.apply(fmt_dur)
    tbl["avgPaceMinKm"] = tbl.avgPaceMinKm.apply(fmt_pace)
    tbl.columns = ["Fecha","Nombre","Dist. (km)","Tiempo","Ritmo","FC","Cal."]
    st.dataframe(tbl, use_container_width=True, hide_index=True)

# ── Steps ─────────────────────────────────────────────────────────────────────
def page_steps(client, uid, start, end, cmode):
    s, e = start.isoformat(), end.isoformat()
    if (end - start).days > 90:
        st.info("Los pasos se obtienen día a día. Períodos largos tardan un poco…")
    with st.spinner("Cargando pasos…"):
        data  = fetch_steps(client, uid, s, e)
        cdata = None
        if cmode:
            cs, ce = comp_range(start, end, cmode)
            if cs:
                cdata = fetch_steps(client, uid, cs.isoformat(), ce.isoformat())

    days   = data["days"];  sm  = data["summary"]
    cdays  = cdata["days"] if cdata else []
    csm    = cdata["summary"] if cdata else None
    clabel = COMP_LABELS.get(cmode, "")
    has_c  = bool(cdays)
    goal   = days[0]["stepGoal"] if days else 10000

    st.title("👣 Pasos diarios")

    # KPIs
    total_cal  = sum(d["calories"] for d in days)
    ctotal_cal = sum(d["calories"] for d in cdays) if has_c else None
    c = st.columns(4)
    c[0].metric("Media diaria",       f"{sm['avgDailySteps']:,.0f}".replace(",","."),  fmt_delta(sm["avgDailySteps"],    csm["avgDailySteps"]    if csm else None))
    c[1].metric("Total período",      f"{sm['totalSteps']:,}".replace(",","."),         fmt_delta(sm["totalSteps"],       csm["totalSteps"]       if csm else None))
    c[2].metric("Días con objetivo",  f"{sm['daysGoalAchieved']} / {sm['totalDays']}", fmt_delta(sm["goalAchievedPct"],  csm["goalAchievedPct"]  if csm else None))
    c[3].metric("Calorías",           f"{total_cal:,} kcal".replace(",","."),           fmt_delta(total_cal, ctotal_cal))

    df  = pd.DataFrame(days).assign(label=lambda d: [f"Día {i+1}" for i in range(len(d))])
    dfc = pd.DataFrame(cdays).assign(label=lambda d: [f"Día {i+1}" for i in range(len(d))]) if has_c else None

    # Daily bars
    st.subheader("Pasos diarios")
    bar_colors = [ORANGE if r.goalAchieved else "#fdba74" for _, r in df.iterrows()]
    fig = go.Figure()
    if has_c:
        fig.add_bar(x=dfc.label, y=dfc.steps, name=clabel, marker_color=GRAY_L, opacity=0.7)
    fig.add_bar(x=df.label, y=df.steps, name="Actual", marker_color=bar_colors)
    fig.add_hline(y=goal, line_dash="dash", line_color=GREEN,
                  annotation_text=f"Objetivo {goal:,}".replace(",","."))
    fig.update_layout(barmode="overlay")
    show(fig, height=280, legend=has_c)
    if not has_c:
        st.caption("🟠 Objetivo alcanzado · 🔶 Sin alcanzar")

    col1, col2 = st.columns(2)
    with col1:
        st.subheader("Media móvil 7 días")
        df["roll7"] = df.steps.rolling(7, min_periods=1).mean().round(0)
        fig = go.Figure()
        if has_c:
            dfc["roll7"] = dfc.steps.rolling(7, min_periods=1).mean().round(0)
            fig.add_scatter(x=dfc.label, y=dfc.roll7, name=clabel,
                            line=dict(color=GRAY, dash="dash", width=2), mode="lines")
        fig.add_scatter(x=df.label, y=df.roll7, name="Actual",
                        line=dict(color=ORANGE, width=2.5), mode="lines")
        fig.add_hline(y=goal, line_dash="dash", line_color=GREEN)
        show(fig, legend=has_c)

    with col2:
        st.subheader("Media semanal")
        def weekly(day_list):
            rows = []
            for i in range(0, len(day_list), 7):
                chunk = day_list[i:i+7]
                rows.append({"label": f"Sem. {i//7+1}",
                              "steps": round(sum(d["steps"] for d in chunk) / len(chunk)),
                              "goal":  chunk[0]["stepGoal"]})
            return pd.DataFrame(rows)
        dfw = weekly(days)
        fig = go.Figure()
        if has_c:
            dfwc = weekly(cdays)
            fig.add_bar(x=dfwc.label, y=dfwc.steps, name=clabel, marker_color=GRAY_L)
        wcolors = [BLUE if r.steps >= r.goal else "#93c5fd" for _, r in dfw.iterrows()]
        fig.add_bar(x=dfw.label, y=dfw.steps, name="Actual", marker_color=wcolors)
        fig.add_hline(y=goal, line_dash="dash", line_color=GREEN)
        fig.update_layout(barmode="group")
        show(fig, legend=has_c)

    # Calories
    df_cal = df[df.calories > 0]
    if not df_cal.empty:
        st.subheader("Calorías activas por día")
        fig = go.Figure()
        fig.add_bar(x=df_cal.label, y=df_cal.calories, marker_color=RED, name="Calorías")
        show(fig)

    # Table
    st.subheader("Detalle por día")
    tbl = df[["date","steps","stepGoal","distanceKm","calories","activeTimeMin"]]\
        .sort_values("date", ascending=False).head(30).copy()
    tbl["pct"] = (tbl.steps / tbl.stepGoal * 100).round(0).astype(int).astype(str) + "%"
    tbl["date"] = pd.to_datetime(tbl.date).dt.strftime("%d %b")
    tbl.columns = ["Fecha","Pasos","Objetivo","Dist. (km)","Cal.","T. activo (min)","% Obj."]
    tbl = tbl[["Fecha","Pasos","Objetivo","% Obj.","Dist. (km)","Cal.","T. activo (min)"]]
    st.dataframe(tbl, use_container_width=True, hide_index=True)

# ── Main ──────────────────────────────────────────────────────────────────────
if st.session_state.client is None:
    login_page()
else:
    client = st.session_state.client
    uid    = client.user_id
    page, start_date, end_date, cmode = sidebar()

    if   page == "📊 Resumen":  page_summary(client, uid)
    elif page == "🚴 Ciclismo": page_cycling(client, uid, start_date, end_date, cmode)
    elif page == "🏃 Running":  page_running(client, uid, start_date, end_date, cmode)
    elif page == "👣 Pasos":    page_steps(client, uid, start_date, end_date, cmode)
