import { useState } from "react";
import {
  AreaChart, Area, BarChart, Bar, LineChart, Line, ComposedChart,
  XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer, Legend,
} from "recharts";
import { Bike, TrendingUp, Clock, Mountain, Zap, Heart } from "lucide-react";
import { api } from "../api/garmin";
import { useFetch } from "../hooks/useFetch";
import { StatCard } from "../components/StatCard";
import { DateRangePicker } from "../components/DateRangePicker";
import { ComparisonSelector } from "../components/ComparisonSelector";
import { LoadingSpinner, ErrorMessage } from "../components/LoadingSpinner";
import { formatDate, formatDuration, formatNumber } from "../utils/formatters";
import { getComparisonRange, getDelta, COMP_LABELS } from "../utils/comparison";

function subDays(n) {
  const d = new Date();
  d.setDate(d.getDate() - n);
  return d.toISOString().slice(0, 10);
}

const BLUE = "#3b82f6";
const ORANGE = "#f97316";
const PURPLE = "#a855f7";
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
            {p.name}: <strong>{typeof p.value === "number" ? formatNumber(p.value, 1) : p.value}</strong>
          </p>
        ) : null
      )}
    </div>
  );
}

export function CyclingPage() {
  const [startDate, setStartDate] = useState(subDays(90));
  const [endDate, setEndDate] = useState(new Date().toISOString().slice(0, 10));
  const [compMode, setCompMode] = useState(null);

  const compRange = getComparisonRange(startDate, endDate, compMode);
  const compLabel = compMode ? COMP_LABELS[compMode] : null;

  const { data, loading, error, refetch } = useFetch(
    () => api.getCycling(startDate, endDate),
    [startDate, endDate]
  );

  const { data: compData } = useFetch(
    () => compRange ? api.getCycling(compRange[0], compRange[1]) : Promise.resolve(null),
    [compRange?.[0], compRange?.[1]]
  );

  if (loading) return <LoadingSpinner message="Cargando actividades de ciclismo..." />;
  if (error) return <ErrorMessage message={error} onRetry={refetch} />;
  if (!data) return null;

  const { activities, summary } = data;
  const compActs = compData?.activities ?? [];
  const compSummary = compData?.summary ?? null;
  const hasComp = compMode && compActs.length > 0;
  const hasActivities = activities.length > 0;

  const maxLen = Math.max(activities.length, compActs.length);

  // Merged chart data aligned by activity index
  const chartData = Array.from({ length: maxLen }, (_, i) => ({
    label: `Sal. ${i + 1}`,
    "Distancia (km)": activities[i]?.distanceKm ?? null,
    [`Dist. ${compLabel}`]: hasComp ? (compActs[i]?.distanceKm ?? null) : undefined,
    "Velocidad (km/h)": activities[i]?.avgSpeedKmh ?? null,
    [`Vel. ${compLabel}`]: hasComp ? (compActs[i]?.avgSpeedKmh ?? null) : undefined,
    "Desnivel (m)": activities[i]?.elevationGainM ?? null,
    [`Desn. ${compLabel}`]: hasComp ? (compActs[i]?.elevationGainM ?? null) : undefined,
    "FC media": activities[i]?.avgHr || null,
    [`FC ${compLabel}`]: hasComp ? (compActs[i]?.avgHr || null) : undefined,
    "Potencia (W)": activities[i]?.avgPower ?? null,
    [`Pot. ${compLabel}`]: hasComp ? (compActs[i]?.avgPower ?? null) : undefined,
  }));

  // Cumulative distance
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

  // X-axis config
  const xKey = hasComp ? "label" : "label";
  const barSize = maxLen > 50 ? 3 : maxLen > 30 ? 6 : maxLen > 15 ? 10 : 18;

  // Deltas for KPI cards
  const deltaActs = getDelta(summary.totalActivities, compSummary?.totalActivities);
  const deltaDist = getDelta(summary.totalDistanceKm, compSummary?.totalDistanceKm);
  const deltaTime = getDelta(summary.totalTimeMin, compSummary?.totalTimeMin);
  const deltaElev = getDelta(summary.totalElevationM, compSummary?.totalElevationM);

  return (
    <div className="space-y-6">
      <div className="flex flex-col gap-3">
        <div className="flex flex-col sm:flex-row sm:items-center gap-4 justify-between">
          <div>
            <h1 className="text-2xl font-bold text-gray-900 flex items-center gap-2">
              <Bike className="text-blue-500" size={28} /> Ciclismo
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

      {/* KPI cards */}
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
        <StatCard label="Actividades" value={formatNumber(summary.totalActivities)} icon={Bike} color="blue" delta={hasComp ? deltaActs : null} />
        <StatCard label="Distancia total" value={formatNumber(summary.totalDistanceKm, 1)} unit="km" icon={TrendingUp} color="green" delta={hasComp ? deltaDist : null} />
        <StatCard label="Tiempo total" value={formatDuration(summary.totalTimeMin)} icon={Clock} color="purple" delta={hasComp ? deltaTime : null} />
        <StatCard label="Desnivel total" value={formatNumber(summary.totalElevationM)} unit="m" icon={Mountain} color="orange" delta={hasComp ? deltaElev : null} />
      </div>

      {!hasActivities ? (
        <div className="text-center py-16 text-gray-400">
          <Bike size={48} className="mx-auto mb-3 opacity-30" />
          <p className="text-lg font-medium">Sin actividades en este período</p>
          <p className="text-sm">Prueba con un rango de fechas mayor</p>
        </div>
      ) : (
        <>
          {/* Distance per activity */}
          <div className="bg-white rounded-2xl border border-gray-100 p-6 shadow-sm">
            <h2 className="text-base font-semibold text-gray-800 mb-4">Distancia por actividad (km)</h2>
            <ResponsiveContainer width="100%" height={220}>
              <ComposedChart data={chartData} barSize={barSize}>
                <CartesianGrid strokeDasharray="3 3" stroke="#f3f4f6" />
                <XAxis dataKey={xKey} tick={{ fontSize: 10 }} tickLine={false} interval={maxLen > 20 ? Math.floor(maxLen / 10) : 0} />
                <YAxis tick={{ fontSize: 10 }} tickLine={false} axisLine={false} unit=" km" />
                <Tooltip content={<CustomTooltip />} />
                {hasComp && <Legend iconType="circle" iconSize={8} wrapperStyle={{ fontSize: 11 }} />}
                <Bar dataKey="Distancia (km)" fill={BLUE} radius={[3, 3, 0, 0]} />
                {hasComp && (
                  <Line type="monotone" dataKey={`Dist. ${compLabel}`} stroke={COMP_COLOR} strokeWidth={2} strokeDasharray="4 3" dot={false} activeDot={{ r: 4 }} />
                )}
              </ComposedChart>
            </ResponsiveContainer>
          </div>

          {/* Speed and elevation */}
          <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
            <div className="bg-white rounded-2xl border border-gray-100 p-6 shadow-sm">
              <h2 className="text-base font-semibold text-gray-800 mb-4 flex items-center gap-2">
                <Zap size={16} className="text-orange-500" /> Velocidad media (km/h)
              </h2>
              <ResponsiveContainer width="100%" height={200}>
                <LineChart data={chartData}>
                  <CartesianGrid strokeDasharray="3 3" stroke="#f3f4f6" />
                  <XAxis dataKey={xKey} tick={{ fontSize: 10 }} tickLine={false} interval={maxLen > 20 ? Math.floor(maxLen / 8) : 0} />
                  <YAxis tick={{ fontSize: 10 }} tickLine={false} axisLine={false} domain={["auto", "auto"]} unit=" km/h" />
                  <Tooltip content={<CustomTooltip />} />
                  {hasComp && <Legend iconType="circle" iconSize={8} wrapperStyle={{ fontSize: 11 }} />}
                  <Line type="monotone" dataKey="Velocidad (km/h)" stroke={ORANGE} strokeWidth={2} dot={false} activeDot={{ r: 5 }} />
                  {hasComp && <Line type="monotone" dataKey={`Vel. ${compLabel}`} stroke={COMP_COLOR} strokeWidth={2} strokeDasharray="4 3" dot={false} activeDot={{ r: 4 }} />}
                </LineChart>
              </ResponsiveContainer>
            </div>

            <div className="bg-white rounded-2xl border border-gray-100 p-6 shadow-sm">
              <h2 className="text-base font-semibold text-gray-800 mb-4 flex items-center gap-2">
                <Mountain size={16} className="text-purple-500" /> Desnivel positivo (m)
              </h2>
              <ResponsiveContainer width="100%" height={200}>
                <ComposedChart data={chartData} barSize={barSize}>
                  <CartesianGrid strokeDasharray="3 3" stroke="#f3f4f6" />
                  <XAxis dataKey={xKey} tick={{ fontSize: 10 }} tickLine={false} interval={maxLen > 20 ? Math.floor(maxLen / 8) : 0} />
                  <YAxis tick={{ fontSize: 10 }} tickLine={false} axisLine={false} unit=" m" />
                  <Tooltip content={<CustomTooltip />} />
                  {hasComp && <Legend iconType="circle" iconSize={8} wrapperStyle={{ fontSize: 11 }} />}
                  <Bar dataKey="Desnivel (m)" fill={PURPLE} radius={[3, 3, 0, 0]} />
                  {hasComp && <Line type="monotone" dataKey={`Desn. ${compLabel}`} stroke={COMP_COLOR} strokeWidth={2} strokeDasharray="4 3" dot={false} activeDot={{ r: 4 }} />}
                </ComposedChart>
              </ResponsiveContainer>
            </div>
          </div>

          {/* Cumulative distance */}
          <div className="bg-white rounded-2xl border border-gray-100 p-6 shadow-sm">
            <h2 className="text-base font-semibold text-gray-800 mb-4">Distancia acumulada (km)</h2>
            <ResponsiveContainer width="100%" height={220}>
              <AreaChart data={cumulativeData}>
                <defs>
                  <linearGradient id="blueGrad" x1="0" y1="0" x2="0" y2="1">
                    <stop offset="5%" stopColor={BLUE} stopOpacity={0.2} />
                    <stop offset="95%" stopColor={BLUE} stopOpacity={0} />
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
                {hasComp && (
                  <Area type="monotone" dataKey={compLabel} stroke={COMP_COLOR} strokeWidth={2} strokeDasharray="5 3" fill="url(#grayGrad)" dot={false} />
                )}
                <Area type="monotone" dataKey="Actual" stroke={BLUE} strokeWidth={2.5} fill="url(#blueGrad)" dot={false} activeDot={{ r: 5 }} />
              </AreaChart>
            </ResponsiveContainer>
          </div>

          {/* FC */}
          {activities.some((a) => a.avgHr > 0) && (
            <div className="bg-white rounded-2xl border border-gray-100 p-6 shadow-sm">
              <h2 className="text-base font-semibold text-gray-800 mb-4 flex items-center gap-2">
                <Heart size={16} className="text-red-500" /> Frecuencia cardíaca media (bpm)
              </h2>
              <ResponsiveContainer width="100%" height={200}>
                <LineChart data={chartData.filter((d) => d["FC media"] != null)}>
                  <CartesianGrid strokeDasharray="3 3" stroke="#f3f4f6" />
                  <XAxis dataKey={xKey} tick={{ fontSize: 10 }} tickLine={false} interval={maxLen > 20 ? Math.floor(maxLen / 8) : 0} />
                  <YAxis tick={{ fontSize: 10 }} tickLine={false} axisLine={false} domain={["auto", "auto"]} unit=" bpm" />
                  <Tooltip content={<CustomTooltip />} />
                  {hasComp && <Legend iconType="circle" iconSize={8} wrapperStyle={{ fontSize: 11 }} />}
                  <Line type="monotone" dataKey="FC media" stroke={RED} strokeWidth={2} dot={false} activeDot={{ r: 5 }} />
                  {hasComp && <Line type="monotone" dataKey={`FC ${compLabel}`} stroke={COMP_COLOR} strokeWidth={2} strokeDasharray="4 3" dot={false} activeDot={{ r: 4 }} />}
                </LineChart>
              </ResponsiveContainer>
            </div>
          )}

          {/* Power */}
          {activities.some((a) => a.avgPower) && (
            <div className="bg-white rounded-2xl border border-gray-100 p-6 shadow-sm">
              <h2 className="text-base font-semibold text-gray-800 mb-4 flex items-center gap-2">
                <Zap size={16} className="text-yellow-500" /> Potencia media (W)
              </h2>
              <ResponsiveContainer width="100%" height={200}>
                <LineChart data={chartData.filter((d) => d["Potencia (W)"] != null)}>
                  <CartesianGrid strokeDasharray="3 3" stroke="#f3f4f6" />
                  <XAxis dataKey={xKey} tick={{ fontSize: 10 }} tickLine={false} interval={maxLen > 20 ? Math.floor(maxLen / 8) : 0} />
                  <YAxis tick={{ fontSize: 10 }} tickLine={false} axisLine={false} domain={["auto", "auto"]} unit=" W" />
                  <Tooltip content={<CustomTooltip />} />
                  {hasComp && <Legend iconType="circle" iconSize={8} wrapperStyle={{ fontSize: 11 }} />}
                  <Line type="monotone" dataKey="Potencia (W)" stroke="#eab308" strokeWidth={2} dot={false} activeDot={{ r: 5 }} />
                  {hasComp && <Line type="monotone" dataKey={`Pot. ${compLabel}`} stroke={COMP_COLOR} strokeWidth={2} strokeDasharray="4 3" dot={false} activeDot={{ r: 4 }} />}
                </LineChart>
              </ResponsiveContainer>
            </div>
          )}

          {/* Table */}
          <div className="bg-white rounded-2xl border border-gray-100 shadow-sm overflow-hidden">
            <div className="px-6 py-4 border-b border-gray-50">
              <h2 className="text-base font-semibold text-gray-800">Últimas actividades</h2>
            </div>
            <div className="overflow-x-auto">
              <table className="w-full text-sm">
                <thead>
                  <tr className="bg-gray-50 text-gray-500 text-xs uppercase tracking-wide">
                    <th className="text-left px-4 py-3 font-medium">Fecha</th>
                    <th className="text-left px-4 py-3 font-medium">Nombre</th>
                    <th className="text-right px-4 py-3 font-medium">Dist.</th>
                    <th className="text-right px-4 py-3 font-medium">Tiempo</th>
                    <th className="text-right px-4 py-3 font-medium">Vel. media</th>
                    <th className="text-right px-4 py-3 font-medium">Desnivel</th>
                    <th className="text-right px-4 py-3 font-medium">FC</th>
                    <th className="text-right px-4 py-3 font-medium">Cal.</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-gray-50">
                  {[...activities].reverse().slice(0, 20).map((a) => (
                    <tr key={a.id} className="hover:bg-gray-50 transition-colors">
                      <td className="px-4 py-3 text-gray-500">{formatDate(a.date)}</td>
                      <td className="px-4 py-3 font-medium text-gray-800 max-w-[200px] truncate">{a.name || "Ciclismo"}</td>
                      <td className="px-4 py-3 text-right font-mono">{formatNumber(a.distanceKm, 1)} km</td>
                      <td className="px-4 py-3 text-right">{formatDuration(a.durationMin)}</td>
                      <td className="px-4 py-3 text-right">{formatNumber(a.avgSpeedKmh, 1)} km/h</td>
                      <td className="px-4 py-3 text-right">{formatNumber(a.elevationGainM)} m</td>
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
