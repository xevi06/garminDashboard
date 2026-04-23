from datetime import date, timedelta

import pandas as pd
import streamlit as st

from garmin_client import GarminAuthError, GarminClient

# ── Page config ───────────────────────────────────────────────────────────────
st.set_page_config(page_title="GarminDash", page_icon="🏃", layout="wide")
st.markdown(
    "<style>#MainMenu,footer,[data-testid='stDeployButton']{display:none}</style>",
    unsafe_allow_html=True,
)

# ── Session state ─────────────────────────────────────────────────────────────
if "client" not in st.session_state:
    st.session_state.client = None
if "display_name" not in st.session_state:
    st.session_state.display_name = ""

# ── Helpers ───────────────────────────────────────────────────────────────────
def fmt_dur(m):
    if not m:
        return "—"
    return f"{int(m // 60)}h {int(m % 60)}m" if m >= 60 else f"{int(m)}m"

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
def fetch_swimming(_client, uid, s, e):
    return _client.get_swimming_activities(s, e)

# ── Login ─────────────────────────────────────────────────────────────────────
def login_page():
    _, col, _ = st.columns([1, 1.1, 1])
    with col:
        st.markdown("## 🏃 GarminDash")
        st.caption("Dashboard de entrenamiento para Garmin Connect.")
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

        hoy = date.today()
        st.markdown("**Período**")
        start_date = st.date_input("Desde", hoy - timedelta(days=90))
        end_date   = st.date_input("Hasta", hoy)

        st.divider()
        st.caption("Caché: 5 min")

    return start_date, end_date

# ── Dynamic Table ─────────────────────────────────────────────────────────────
def page_tabla(client, uid, start, end):
    st.title("📋 Tabla dinámica")

    st.markdown("**Nivel de agrupación**")
    level = st.radio("nivel", ["Día", "Semana", "Mes", "Año"],
                     horizontal=True, label_visibility="collapsed")

    _SPORT_OPTS = ["Tiempo", "Km", "Desnivel",
                   "FC media", "FC Z1", "FC Z2", "FC Z3", "FC Z4", "FC Z5",
                   "Pot. media", "W/FC"]

    c1, c2, c3, c4 = st.columns(4)
    with c1:
        bike_cols = st.multiselect("🚴 Ciclismo", _SPORT_OPTS,
                                   default=["Tiempo", "Km", "Desnivel"])
    with c2:
        run_cols  = st.multiselect("🏃 Running",  _SPORT_OPTS,
                                   default=["Tiempo", "Km", "Desnivel"])
    with c3:
        swim_cols = st.multiselect("🏊 Natación", ["Tiempo", "Km"], default=[])
    with c4:
        step_cols = st.multiselect("👣 Pasos", ["Pasos", "Km", "Calorías"],
                                   default=["Pasos"])

    s, e = start.isoformat(), end.isoformat()
    with st.spinner("Cargando datos…"):
        bike_data  = fetch_cycling(client, uid, s, e)  if bike_cols  else {"activities": []}
        run_data   = fetch_running(client, uid, s, e)  if run_cols   else {"activities": []}
        swim_data  = fetch_swimming(client, uid, s, e) if swim_cols  else {"activities": []}
        step_data  = fetch_steps(client, uid, s, e)    if step_cols  else {"days": []}

    def period_key(date_str):
        d = pd.Timestamp(date_str)
        if level == "Día":    return date_str
        if level == "Semana":
            iso = d.isocalendar()
            return f"{iso.year}-S{iso.week:02d}"
        if level == "Mes":   return f"{d.year}-{d.month:02d}"
        return str(d.year)

    all_p = []
    cur = start
    while cur <= end:
        k = period_key(cur.isoformat())
        if k not in all_p:
            all_p.append(k)
        cur += timedelta(days=1)

    def aggregate(activities):
        base = pd.DataFrame({"Período": all_p}).set_index("Período")
        if not activities:
            return base.assign(tiempo=None, km=None, desnivel=None,
                               fc_media=None, pot_media=None,
                               hr_z1=None, hr_z2=None, hr_z3=None, hr_z4=None, hr_z5=None)
        df = pd.DataFrame(activities)
        df["_p"] = df["date"].apply(period_key)

        def _mean_pos(s):
            v = s[s > 0]
            return round(float(v.mean()), 0) if len(v) else None

        grp = df.groupby("_p").agg(
            tiempo=("durationMin", "sum"),
            km=("distanceKm", "sum"),
            desnivel=("elevationGainM", "sum"),
            fc_media=("avgHr",    _mean_pos),
            pot_media=("avgPower", _mean_pos),
            hr_z1=("hrZ1Min", "sum"),
            hr_z2=("hrZ2Min", "sum"),
            hr_z3=("hrZ3Min", "sum"),
            hr_z4=("hrZ4Min", "sum"),
            hr_z5=("hrZ5Min", "sum"),
        )
        result = base.join(grp, how="left")
        mask = result["pot_media"].notna() & result["fc_media"].notna() & (result["fc_media"] > 0)
        result["w_fc"] = (result["pot_media"] / result["fc_media"]).where(mask).round(2)
        return result

    def aggregate_steps(days):
        base = pd.DataFrame({"Período": all_p}).set_index("Período")
        if not days:
            return base.assign(pasos=None, km=None, calorias=None)
        df = pd.DataFrame(days)
        df["_p"] = df["date"].apply(period_key)
        grp = df.groupby("_p").agg(
            pasos=("steps", "sum"),
            km=("distanceKm", "sum"),
            calorias=("calories", "sum"),
        )
        return base.join(grp, how="left")

    bike_agg  = aggregate(bike_data["activities"])
    run_agg   = aggregate(run_data["activities"])
    swim_agg  = aggregate(swim_data["activities"])
    step_agg  = aggregate_steps(step_data["days"])

    num = {}
    for prefix, agg, cols in [("🚴", bike_agg, bike_cols), ("🏃", run_agg, run_cols)]:
        if "Tiempo"     in cols: num[f"{prefix} Tiempo"]     = agg["tiempo"]
        if "Km"         in cols: num[f"{prefix} Km"]         = agg["km"]
        if "Desnivel"   in cols: num[f"{prefix} Desnivel"]   = agg["desnivel"]
        if "FC media"   in cols: num[f"{prefix} FC media"]   = agg["fc_media"]
        if "FC Z1"      in cols: num[f"{prefix} FC Z1"]      = agg["hr_z1"]
        if "FC Z2"      in cols: num[f"{prefix} FC Z2"]      = agg["hr_z2"]
        if "FC Z3"      in cols: num[f"{prefix} FC Z3"]      = agg["hr_z3"]
        if "FC Z4"      in cols: num[f"{prefix} FC Z4"]      = agg["hr_z4"]
        if "FC Z5"      in cols: num[f"{prefix} FC Z5"]      = agg["hr_z5"]
        if "Pot. media" in cols: num[f"{prefix} Pot. media"] = agg["pot_media"]
        if "W/FC"       in cols: num[f"{prefix} W/FC"]       = agg["w_fc"]
    if "Tiempo"   in swim_cols: num["🏊 Tiempo"]   = swim_agg["tiempo"]
    if "Km"       in swim_cols: num["🏊 Km"]       = swim_agg["km"]
    if "Pasos"    in step_cols: num["👣 Pasos"]    = step_agg["pasos"]
    if "Km"       in step_cols: num["👣 Km"]       = step_agg["km"]
    if "Calorías" in step_cols: num["👣 Calorías"] = step_agg["calorias"]

    if not num:
        st.info("Selecciona al menos una métrica."); return

    tbl = pd.DataFrame(num)
    tbl.index.name = "Período"
    tbl = tbl.where(tbl > 0)   # zero → NaN: shows "—" and gets no heatmap colour
    tbl = tbl.iloc[::-1]       # newest period first

    def _fmt(col, v):
        if pd.isna(v): return "—"
        if "Tiempo"     in col: return fmt_dur(v)
        if "Km"         in col: return f"{v:.1f}"
        if "Desnivel"   in col: return f"{v:.0f} m"
        if "Pasos"      in col: return f"{int(v):,}".replace(",", ".")
        if "Calorías"   in col: return f"{v:.0f} kcal"
        if "W/FC"       in col: return f"{v:.2f}"   # antes que "FC"
        if "FC Z"       in col: return fmt_dur(v)
        if "FC"         in col: return f"{int(v)} bpm"
        if "Pot. media" in col: return f"{int(v)} W"
        return str(v)

    # Append median to each column header as reference value
    rename = {}
    for col in tbl.columns:
        med = tbl[col].median()
        rename[col] = f"{col} ({_fmt(col, med)})" if pd.notna(med) and med > 0 else col
    tbl = tbl.rename(columns=rename)

    styler = tbl.style.format(
        {col: (lambda v, c=col: _fmt(c, v)) for col in tbl.columns},
        na_rep="—",
    )

    bike_c = [c for c in tbl.columns if "🚴" in c]
    run_c  = [c for c in tbl.columns if "🏃" in c]
    swim_c = [c for c in tbl.columns if "🏊" in c]
    step_c = [c for c in tbl.columns if "👣" in c]

    if bike_c: styler = styler.background_gradient(subset=bike_c, cmap="Blues",   axis=0)
    if run_c:  styler = styler.background_gradient(subset=run_c,  cmap="Greens",  axis=0)
    if swim_c: styler = styler.background_gradient(subset=swim_c, cmap="Purples", axis=0)
    if step_c: styler = styler.background_gradient(subset=step_c, cmap="Oranges", axis=0)

    st.dataframe(styler, use_container_width=True)

# ── Main ──────────────────────────────────────────────────────────────────────
if st.session_state.client is None:
    login_page()
else:
    client = st.session_state.client
    uid    = client.user_id
    start_date, end_date = sidebar()
    page_tabla(client, uid, start_date, end_date)
