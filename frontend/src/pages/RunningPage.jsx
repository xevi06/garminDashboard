import { useState } from "react";
import {
  AreaChart, Area, BarChart, Bar, LineChart, Line, ComposedChart,
  XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer, ReferenceLine, Legend,
} from "recharts";
import { PersonStanding, TrendingUp, Clock, Heart, Timer } from "lucide-react";
import { api } from "../api/garmin";
import { useFetch } from "../hooks/useFetch";
import { StatCard } from "../components/StatCard";
import { DateRangePicker } from "../components/DateRangePicker";
import { ComparisonSelector } from "../components/ComparisonSelector";
import { LoadingSpinner, ErrorMessage } from "../components/LoadingSpinner";
import { formatDate, formatDuration, formatNumber, formatPace, paceLabel } from "../utils/formatters";
import { getComparisonRange, getDelta, COMP_LABELS } from "../utils/comparison";

function subDays(n) {
  const d = new Date();
  d.setDate(d.getDate() - n);
  return d.toISOString().slice(0, 10);
}

const GREEN = "#22c55e";
const RED = "#ef4444";
const COMP_COLOR = "#9ca3af";

function CustomTooltip({ active, payload, label }) {
  if (!active || !payload?.length) return null;
  return (
    <div className="bg-white border border-gray-100 rounded-xl shadow-lg p-3 text-xs">
      <p className="font-semibold text-gray-700 mb-1">{label}</p>
      {payload.map((p) =>
        p.value != null ? (
          <p key={p.name} style={{ color: p.color || p.stroke }}>
            {p.name}: <strong>{formatNumber(p.value, 2)}</strong>
          </p>
        ) : null
      )}
    </div>
  );
}

function PaceTooltip({ active, payload, label }) {
  if (!active || !payload?.length) return null;
  return (
    <div className="bg-white border border-gray-100 rounded-xl shadow-lg p-3 text-xs">
      <p className="font-semibold text-gray-700 mb-1">{label}</p>
      {payload.map((p) =>
        p.value != null ? (
          <p key={p.name} style={{ color: p.color || p.stroke }}>
            {p.name}: <strong>{paceLabel(p.value)} /km</strong>
          </p>
        ) : null
      )}
    </div>
  );
}

export function RunningPage() {
  const [startDate, setStartDate] = useState(subDays(90));
  const [endDate, setEndDate] = useState(new Date().toISOString().slice(0, 10));
  const [compMode, setCompMode] = useState(null);

  const compRange = getComparisonRange(startDate, endDate, compMode);
  const compLabel = compMode ? COMP_LABELS[compMode] : null;

  const { data, loading, error, refetch } = useFetch(
    () => api.getRunning(startDate, endDate),
    [startDate, endDate]
  );

  const { data: compData } = useFetch(
    () => compRange ? api.getRunning(compRange[0], compRange[1]) : Promise.resolve(null),
    [compRange?.[0], compRange?.[1]]
  );

  if (loading) return <LoadingSpinner message="Cargando actividades de running..." />;
  if (error) return <ErrorMessage message={error} onRetry={refetch} />;
  if (!data) return null;

  const { activities, summary } = data;
  const compActs = compData?.activities ?? [];
  const compSummary = compData?.summary ?? null;
  const hasComp = compMode && compActs.length > 0;
  const hasActivities = activities.length > 0;

  const maxLen = Math.max(activities.length, compActs.length);
  const barSize = maxLen > 50 ? 3 : maxLen > 30 ? 6 : maxLen > 15 ? 10 : 18;

  // Merged chart data by activity index
  const chartData = Array.from({ length: maxLen }, (_, i) => ({
    label: `Sal. ${i + 1}`,
    "Distancia (km)": activities[i]?.distanceKm ?? null,
    [`Dist. ${compLabel}`]: hasComp ? (compActs[i]?.distanceKm ?? null) : undefined,
    "Ritmo (min/km)": activities[i]?.avgPaceMinKm ?? null,
    [`Ritmo ${compLabel}`]: hasComp ? (compActs[i]?.avgPaceMinKm ?? null) : undefined,
    "FC media": activities[i]?.avgHr || null,
    [`FC ${compLabel}`]: hasComp ? (compActs[i]?.avgHr || null) : undefined,
  }));

  // Cumulative
  let cum = 0, cumComp = 0;
  const cumulativeData = Array.from({ length: maxLen }, (_, i) => {
    if (activities[i]) cum = Math.round((cum + activities[i].distanceKm) * 10) / 10;
    if (compActs[i]) cumComp = Math.round((cumComp + compActs[i].distanceKm) * 10) / 10;
    return {
      label: `Sal. ${i + 1}`,
      Actual: activities[i] !== undefined ? cum : null,
      ...(hasComp ? { [compLabel]: compActs[i] !== undefined ? cumComp : null } : {}),
    };
  });

  // Pace zones (primary + comparison side by side)
  const paceZoneDefs = [
    { label: "<4:00", min: 0, max: 4 },
    { label: "4-4:30", min: 4, max: 4.5 },
    { label: "4:30-5", min: 4.5, max: 5 },
    { label: "5-5:30", min: 5, max: 5.5 },
    { label: "5:30-6", min: 5.5, max: 6 },
    { label: ">6:00", min: 6, max: Infinity },
  ];
  const paceZoneColors = ["#ef4444", "#f97316", "#eab308", "#22c55e", "#3b82f6", "#a855f7"];
  const paceZones = paceZoneDefs.map((z, idx) => {
    const count = activities.filter((a) => a.avgPaceMinKm >= z.min && a.avgPaceMinKm < z.max).length;
    const compCount = compActs.filter((a) => a.avgPaceMinKm >= z.min && a.avgPaceMinKm < z.max).length;
    return { ...z, count, compCount, color: paceZoneColors[idx] };
  });

  const xInterval = maxLen > 20 ? Math.floor(maxLen / 8) : 0;
  const avgPaceStr = summary.avgPaceMinKm ? formatPace(summary.avgPaceMinKm) : "—";

  // Deltas
  const deltaActs = getDelta(summary.totalActivities, compSummary?.totalActivities);
  const deltaDist = getDelta(summary.totalDistanceKm, compSummary?.totalDistanceKm);
  const deltaTime = getDelta(summary.totalTimeMin, compSummary?.totalTimeMin);
  // Pace: lower is better → negate delta so it reads intuitively in the badge
  const deltaPaceRaw = getDelta(summary.avgPaceMinKm, compSummary?.avgPaceMinKm);
  const deltaPace = deltaPaceRaw != null ? -deltaPaceRaw : null;

  return (
    <div className="space-y-6">
      <div className="flex flex-col gap-3">
        <div className="flex flex-col sm:flex-row sm:items-center gap-4 justify-between">
          <div>
            <h1 className="text-2xl font-bold text-gray-900 flex items-center gap-2">
              <PersonStanding className="text-green-500" size={28} /> Running
            </h1>
            <p className="text-gray-500 text-sm mt-0.5">
              {activities.length} actividades
              {hasComp && <span className="text-gray-400"> · {compActs.length} en período anterior</span>}
            </p>
          </div>
          <DateRangePicker
            startDate={startDate}
            endDate={endDate}
            onChange={(s, e) => { setStartDate(s); setEndDate(e); }}
          />
        </div>
        <ComparisonSelector mode={compMode} onChange={setCompMode} />
      </div>

      {/* KPIs */}
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
        <StatCard label="Actividades" value={formatNumber(summary.totalActivities)} icon={PersonStanding} color="green" delta={hasComp ? deltaActs : null} />
        <StatCard label="Distancia total" value={formatNumber(summary.totalDistanceKm, 1)} unit="km" icon={TrendingUp} color="blue" delta={hasComp ? deltaDist : null} />
        <StatCard label="Tiempo total" value={formatDuration(summary.totalTimeMin)} icon={Clock} color="purple" delta={hasComp ? deltaTime : null} />
        <StatCard label="Ritmo medio" value={avgPaceStr} icon={Timer} color="orange" delta={hasComp ? deltaPace : null} />
      </div>

      {!hasActivities ? (
        <div className="text-center py-16 text-gray-400">
          <PersonStanding size={48} className="mx-auto mb-3 opacity-30" />
          <p className="text-lg font-medium">Sin actividades en este período</p>
          <p className="text-sm">Prueba con un rango de fechas mayor</p>
        </div>
      ) : (
        <>
          {/* Distance per run */}
          <div className="bg-white rounded-2xl border border-gray-100 p-6 shadow-sm">
            <h2 className="text-base font-semibold text-gray-800 mb-4">Distancia por actividad (km)</h2>
            <ResponsiveContainer width="100%" height={220}>
              <ComposedChart data={chartData} barSize={barSize}>
                <CartesianGrid strokeDasharray="3 3" stroke="#f3f4f6" />
                <XAxis dataKey="label" tick={{ fontSize: 10 }} tickLine={false} interval={xInterval} />
                <YAxis tick={{ fontSize: 10 }} tickLine={false} axisLine={false} unit=" km" />
                <Tooltip content={<CustomTooltip />} />
                {hasComp && <Legend iconType="circle" iconSize={8} wrapperStyle={{ fontSize: 11 }} />}
                <Bar dataKey="Distancia (km)" fill={GREEN} radius={[3, 3, 0, 0]} />
                {hasComp && <Line type="monotone" dataKey={`Dist. ${compLabel}`} stroke={COMP_COLOR} strokeWidth={2} strokeDasharray="4 3" dot={false} activeDot={{ r: 4 }} />}
              </ComposedChart>
            </ResponsiveContainer>
          </div>

          {/* Pace + Zones */}
          <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
            <div className="bg-white rounded-2xl border border-gray-100 p-6 shadow-sm">
              <h2 className="text-base font-semibold text-gray-800 mb-1 flex items-center gap-2">
                <Timer size={16} className="text-green-500" /> Evolución del ritmo (min/km)
              </h2>
              <p className="text-xs text-gray-400 mb-4">Eje invertido — menor es mejor</p>
              <ResponsiveContainer width="100%" height={200}>
                <LineChart data={chartData.filter((d) => d["Ritmo (min/km)"] != null)}>
                  <CartesianGrid strokeDasharray="3 3" stroke="#f3f4f6" />
                  <XAxis dataKey="label" tick={{ fontSize: 10 }} tickLine={false} interval={xInterval} />
                  <YAxis tick={{ fontSize: 10 }} tickLine={false} axisLine={false} reversed tickFormatter={paceLabel} domain={["auto", "auto"]} />
                  <Tooltip content={<PaceTooltip />} />
                  {summary.avgPaceMinKm && (
                    <ReferenceLine y={summary.avgPaceMinKm} stroke={GREEN} strokeDasharray="4 4"
                      label={{ value: `Prom. ${paceLabel(summary.avgPaceMinKm)}`, position: "right", fontSize: 9, fill: GREEN }} />
                  )}
                  {hasComp && <Legend iconType="circle" iconSize={8} wrapperStyle={{ fontSize: 11 }} />}
                  <Line type="monotone" dataKey="Ritmo (min/km)" stroke={GREEN} strokeWidth={2} dot={false} activeDot={{ r: 5 }} />
                  {hasComp && <Line type="monotone" dataKey={`Ritmo ${compLabel}`} stroke={COMP_COLOR} strokeWidth={2} strokeDasharray="4 3" dot={false} activeDot={{ r: 4 }} />}
                </LineChart>
              </ResponsiveContainer>
            </div>

            <div className="bg-white rounded-2xl border border-gray-100 p-6 shadow-sm">
              <h2 className="text-base font-semibold text-gray-800 mb-4">
                Distribución de ritmos {hasComp && <span className="text-gray-400 font-normal text-sm">· actual vs {compLabel}</span>}
              </h2>
              <ResponsiveContainer width="100%" height={200}>
                <BarChart data={paceZones} layout="vertical" barSize={hasComp ? 9 : 18} barCategoryGap="20%">
                  <XAxis type="number" tick={{ fontSize: 10 }} tickLine={false} />
                  <YAxis type="category" dataKey="label" tick={{ fontSize: 11 }} tickLine={false} axisLine={false} width={55} />
                  <Tooltip content={<CustomTooltip />} />
                  {hasComp && <Legend iconType="circle" iconSize={8} wrapperStyle={{ fontSize: 11 }} />}
                  <Bar dataKey="count" name="Actual" radius={[0, 3, 3, 0]}>
                    {paceZones.map((z) => (
                      <rect key={z.label} fill={z.color} />
                    ))}
                  </Bar>
                  {hasComp && <Bar dataKey="compCount" name={compLabel} fill={COMP_COLOR} radius={[0, 3, 3, 0]} />}
                </BarChart>
              </ResponsiveContainer>
            </div>
          </div>

          {/* Cumulative */}
          <div className="bg-white rounded-2xl border border-gray-100 p-6 shadow-sm">
            <h2 className="text-base font-semibold text-gray-800 mb-4">Distancia acumulada (km)</h2>
            <ResponsiveContainer width="100%" height={220}>
              <AreaChart data={cumulativeData}>
                <defs>
                  <linearGradient id="greenGrad" x1="0" y1="0" x2="0" y2="1">
                    <stop offset="5%" stopColor={GREEN} stopOpacity={0.2} />
                    <stop offset="95%" stopColor={GREEN} stopOpacity={0} />
                  </linearGradient>
                  <linearGradient id="grayGrad" x1="0" y1="0" x2="0" y2="1">
                    <stop offset="5%" stopColor={COMP_COLOR} stopOpacity={0.15} />
                    <stop offset="95%" stopColor={COMP_COLOR} stopOpacity={0} />
                  </linearGradient>
                </defs>
                <CartesianGrid strokeDasharray="3 3" stroke="#f3f4f6" />
                <XAxis dataKey="label" tick={{ fontSize: 10 }} tickLine={false} interval={maxLen > 20 ? Math.floor(maxLen / 8) : 0} />
                <YAxis tick={{ fontSize: 10 }} tickLine={false} axisLine={false} unit=" km" />
                <Tooltip content={<CustomTooltip />} />
                {hasComp && <Legend iconType="circle" iconSize={8} wrapperStyle={{ fontSize: 11 }} />}
                {hasComp && <Area type="monotone" dataKey={compLabel} stroke={COMP_COLOR} strokeWidth={2} strokeDasharray="5 3" fill="url(#grayGrad)" dot={false} />}
                <Area type="monotone" dataKey="Actual" stroke={GREEN} strokeWidth={2.5} fill="url(#greenGrad)" dot={false} activeDot={{ r: 5 }} />
              </AreaChart>
            </ResponsiveContainer>
          </div>

          {/* FC */}
          {activities.some((a) => a.avgHr > 0) && (
            <div className="bg-white rounded-2xl border border-gray-100 p-6 shadow-sm">
              <h2 className="text-base font-semibold text-gray-800 mb-4 flex items-center gap-2">
                <Heart size={16} className="text-red-500" /> FC media por salida (bpm)
              </h2>
              <ResponsiveContainer width="100%" height={200}>
                <LineChart data={chartData.filter((d) => d["FC media"] != null)}>
                  <CartesianGrid strokeDasharray="3 3" stroke="#f3f4f6" />
                  <XAxis dataKey="label" tick={{ fontSize: 10 }} tickLine={false} interval={xInterval} />
                  <YAxis tick={{ fontSize: 10 }} tickLine={false} axisLine={false} domain={["auto", "auto"]} unit=" bpm" />
                  <Tooltip content={<CustomTooltip />} />
                  {hasComp && <Legend iconType="circle" iconSize={8} wrapperStyle={{ fontSize: 11 }} />}
                  <Line type="monotone" dataKey="FC media" stroke={RED} strokeWidth={2} dot={false} activeDot={{ r: 5 }} />
                  {hasComp && <Line type="monotone" dataKey={`FC ${compLabel}`} stroke={COMP_COLOR} strokeWidth={2} strokeDasharray="4 3" dot={false} activeDot={{ r: 4 }} />}
                </LineChart>
              </ResponsiveContainer>
            </div>
          )}

          {/* Table */}
          <div className="bg-white rounded-2xl border border-gray-100 shadow-sm overflow-hidden">
            <div className="px-6 py-4 border-b border-gray-50">
              <h2 className="text-base font-semibold text-gray-800">Últimas salidas</h2>
            </div>
            <div className="overflow-x-auto">
              <table className="w-full text-sm">
                <thead>
                  <tr className="bg-gray-50 text-gray-500 text-xs uppercase tracking-wide">
                    <th className="text-left px-4 py-3 font-medium">Fecha</th>
                    <th className="text-left px-4 py-3 font-medium">Nombre</th>
                    <th className="text-right px-4 py-3 font-medium">Dist.</th>
                    <th className="text-right px-4 py-3 font-medium">Tiempo</th>
                    <th className="text-right px-4 py-3 font-medium">Ritmo</th>
                    <th className="text-right px-4 py-3 font-medium">FC</th>
                    <th className="text-right px-4 py-3 font-medium">Cal.</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-gray-50">
                  {[...activities].reverse().slice(0, 20).map((a) => (
                    <tr key={a.id} className="hover:bg-gray-50 transition-colors">
                      <td className="px-4 py-3 text-gray-500">{formatDate(a.date)}</td>
                      <td className="px-4 py-3 font-medium text-gray-800 max-w-[200px] truncate">{a.name || "Running"}</td>
                      <td className="px-4 py-3 text-right font-mono">{formatNumber(a.distanceKm, 2)} km</td>
                      <td className="px-4 py-3 text-right">{formatDuration(a.durationMin)}</td>
                      <td className="px-4 py-3 text-right font-mono text-green-700">{formatPace(a.avgPaceMinKm)}</td>
                      <td className="px-4 py-3 text-right">{a.avgHr ? `${a.avgHr} bpm` : "—"}</td>
                      <td className="px-4 py-3 text-right">{a.calories ? `${formatNumber(a.calories)} kcal` : "—"}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </div>
        </>
      )}
    </div>
  );
}
