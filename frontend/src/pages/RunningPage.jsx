import { useState } from "react";
import {
  AreaChart, Area, BarChart, Bar, LineChart, Line,
  XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer, ReferenceLine,
} from "recharts";
import { PersonStanding, TrendingUp, Clock, Heart, Timer } from "lucide-react";
import { api } from "../api/garmin";
import { useFetch } from "../hooks/useFetch";
import { StatCard } from "../components/StatCard";
import { DateRangePicker } from "../components/DateRangePicker";
import { LoadingSpinner, ErrorMessage } from "../components/LoadingSpinner";
import { formatDate, formatDuration, formatNumber, formatPace, paceLabel } from "../utils/formatters";

function subDays(n) {
  const d = new Date();
  d.setDate(d.getDate() - n);
  return d.toISOString().slice(0, 10);
}

const GREEN = "#22c55e";
const RED = "#ef4444";
const BLUE = "#3b82f6";
const ORANGE = "#f97316";

function CustomTooltip({ active, payload, label }) {
  if (!active || !payload?.length) return null;
  return (
    <div className="bg-white border border-gray-100 rounded-xl shadow-lg p-3 text-xs">
      <p className="font-semibold text-gray-700 mb-1">{label}</p>
      {payload.map((p) => (
        <p key={p.name} style={{ color: p.color }}>
          {p.name}: <strong>{p.value}</strong>
        </p>
      ))}
    </div>
  );
}

function PaceTooltip({ active, payload, label }) {
  if (!active || !payload?.length) return null;
  const val = payload[0]?.value;
  return (
    <div className="bg-white border border-gray-100 rounded-xl shadow-lg p-3 text-xs">
      <p className="font-semibold text-gray-700 mb-1">{label}</p>
      <p style={{ color: GREEN }}>
        Ritmo: <strong>{paceLabel(val)} /km</strong>
      </p>
    </div>
  );
}

function formatYAxisPace(val) {
  return paceLabel(val);
}

export function RunningPage() {
  const [startDate, setStartDate] = useState(subDays(90));
  const [endDate, setEndDate] = useState(new Date().toISOString().slice(0, 10));

  const { data, loading, error, refetch } = useFetch(
    () => api.getRunning(startDate, endDate),
    [startDate, endDate]
  );

  if (loading) return <LoadingSpinner message="Cargando actividades de running..." />;
  if (error) return <ErrorMessage message={error} onRetry={refetch} />;
  if (!data) return null;

  const { activities, summary } = data;
  const hasActivities = activities.length > 0;

  const chartData = activities.map((a) => ({
    date: formatDate(a.date),
    "Distancia (km)": a.distanceKm,
    "Ritmo (min/km)": a.avgPaceMinKm,
    "FC media": a.avgHr,
    "Cadencia (ppm)": a.avgCadence,
    "Duración (min)": a.durationMin,
  }));

  // Cumulative
  let cumulative = 0;
  const cumulativeData = activities.map((a) => {
    cumulative += a.distanceKm;
    return { date: formatDate(a.date), "Distancia acumulada (km)": Math.round(cumulative) };
  });

  // Pace zone histogram (rough)
  const paceZones = [
    { label: "<4:00", min: 0, max: 4, count: 0, color: "#ef4444" },
    { label: "4-4:30", min: 4, max: 4.5, count: 0, color: "#f97316" },
    { label: "4:30-5", min: 4.5, max: 5, count: 0, color: "#eab308" },
    { label: "5-5:30", min: 5, max: 5.5, count: 0, color: "#22c55e" },
    { label: "5:30-6", min: 5.5, max: 6, count: 0, color: "#3b82f6" },
    { label: ">6:00", min: 6, max: Infinity, count: 0, color: "#a855f7" },
  ];
  activities.forEach((a) => {
    if (!a.avgPaceMinKm) return;
    const zone = paceZones.find((z) => a.avgPaceMinKm >= z.min && a.avgPaceMinKm < z.max);
    if (zone) zone.count++;
  });

  const avgPaceStr = summary.avgPaceMinKm ? formatPace(summary.avgPaceMinKm) : "—";

  return (
    <div className="space-y-6">
      <div className="flex flex-col sm:flex-row sm:items-center gap-4 justify-between">
        <div>
          <h1 className="text-2xl font-bold text-gray-900 flex items-center gap-2">
            <PersonStanding className="text-green-500" size={28} /> Running
          </h1>
          <p className="text-gray-500 text-sm mt-0.5">
            {activities.length} actividades en el período seleccionado
          </p>
        </div>
        <DateRangePicker
          startDate={startDate}
          endDate={endDate}
          onChange={(s, e) => { setStartDate(s); setEndDate(e); }}
        />
      </div>

      {/* KPIs */}
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
        <StatCard label="Actividades" value={formatNumber(summary.totalActivities)} icon={PersonStanding} color="green" />
        <StatCard label="Distancia total" value={formatNumber(summary.totalDistanceKm, 1)} unit="km" icon={TrendingUp} color="blue" />
        <StatCard label="Tiempo total" value={formatDuration(summary.totalTimeMin)} icon={Clock} color="purple" />
        <StatCard label="Ritmo medio" value={avgPaceStr} icon={Timer} color="orange" />
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
            <h2 className="text-base font-semibold text-gray-800 mb-4">
              Distancia por actividad (km)
            </h2>
            <ResponsiveContainer width="100%" height={220}>
              <BarChart data={chartData} barSize={activities.length > 30 ? 4 : 20}>
                <CartesianGrid strokeDasharray="3 3" stroke="#f3f4f6" />
                <XAxis dataKey="date" tick={{ fontSize: 11 }} tickLine={false} />
                <YAxis tick={{ fontSize: 11 }} tickLine={false} axisLine={false} unit=" km" />
                <Tooltip content={<CustomTooltip />} />
                <Bar dataKey="Distancia (km)" fill={GREEN} radius={[4, 4, 0, 0]} />
              </BarChart>
            </ResponsiveContainer>
          </div>

          {/* Pace evolution */}
          <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
            <div className="bg-white rounded-2xl border border-gray-100 p-6 shadow-sm">
              <h2 className="text-base font-semibold text-gray-800 mb-1 flex items-center gap-2">
                <Timer size={16} className="text-green-500" /> Evolución del ritmo (min/km)
              </h2>
              <p className="text-xs text-gray-400 mb-4">Menor es mejor — eje invertido</p>
              <ResponsiveContainer width="100%" height={200}>
                <LineChart data={chartData.filter((d) => d["Ritmo (min/km)"])}>
                  <CartesianGrid strokeDasharray="3 3" stroke="#f3f4f6" />
                  <XAxis dataKey="date" tick={{ fontSize: 10 }} tickLine={false} />
                  <YAxis
                    tick={{ fontSize: 10 }}
                    tickLine={false}
                    axisLine={false}
                    reversed
                    tickFormatter={formatYAxisPace}
                    domain={["auto", "auto"]}
                  />
                  <Tooltip content={<PaceTooltip />} />
                  {summary.avgPaceMinKm && (
                    <ReferenceLine
                      y={summary.avgPaceMinKm}
                      stroke={GREEN}
                      strokeDasharray="4 4"
                      label={{ value: `Promedio ${paceLabel(summary.avgPaceMinKm)}`, position: "right", fontSize: 10, fill: GREEN }}
                    />
                  )}
                  <Line
                    type="monotone"
                    dataKey="Ritmo (min/km)"
                    stroke={GREEN}
                    strokeWidth={2}
                    dot={activities.length < 30}
                    activeDot={{ r: 5 }}
                  />
                </LineChart>
              </ResponsiveContainer>
            </div>

            {/* Pace zone distribution */}
            <div className="bg-white rounded-2xl border border-gray-100 p-6 shadow-sm">
              <h2 className="text-base font-semibold text-gray-800 mb-4">
                Distribución de ritmos
              </h2>
              <ResponsiveContainer width="100%" height={200}>
                <BarChart data={paceZones} layout="vertical" barSize={18}>
                  <XAxis type="number" tick={{ fontSize: 10 }} tickLine={false} />
                  <YAxis type="category" dataKey="label" tick={{ fontSize: 11 }} tickLine={false} axisLine={false} width={55} />
                  <Tooltip content={<CustomTooltip />} />
                  <Bar dataKey="count" name="Salidas" radius={[0, 4, 4, 0]}>
                    {paceZones.map((z) => (
                      <rect key={z.label} fill={z.color} />
                    ))}
                  </Bar>
                </BarChart>
              </ResponsiveContainer>
            </div>
          </div>

          {/* Cumulative distance */}
          <div className="bg-white rounded-2xl border border-gray-100 p-6 shadow-sm">
            <h2 className="text-base font-semibold text-gray-800 mb-4">
              Distancia acumulada (km)
            </h2>
            <ResponsiveContainer width="100%" height={200}>
              <AreaChart data={cumulativeData}>
                <defs>
                  <linearGradient id="greenGrad" x1="0" y1="0" x2="0" y2="1">
                    <stop offset="5%" stopColor={GREEN} stopOpacity={0.2} />
                    <stop offset="95%" stopColor={GREEN} stopOpacity={0} />
                  </linearGradient>
                </defs>
                <CartesianGrid strokeDasharray="3 3" stroke="#f3f4f6" />
                <XAxis dataKey="date" tick={{ fontSize: 10 }} tickLine={false} />
                <YAxis tick={{ fontSize: 10 }} tickLine={false} axisLine={false} unit=" km" />
                <Tooltip content={<CustomTooltip />} />
                <Area
                  type="monotone"
                  dataKey="Distancia acumulada (km)"
                  stroke={GREEN}
                  strokeWidth={2}
                  fill="url(#greenGrad)"
                />
              </AreaChart>
            </ResponsiveContainer>
          </div>

          {/* Heart rate */}
          {activities.some((a) => a.avgHr > 0) && (
            <div className="bg-white rounded-2xl border border-gray-100 p-6 shadow-sm">
              <h2 className="text-base font-semibold text-gray-800 mb-4 flex items-center gap-2">
                <Heart size={16} className="text-red-500" /> FC media por salida (bpm)
              </h2>
              <ResponsiveContainer width="100%" height={200}>
                <LineChart data={chartData.filter((d) => d["FC media"] > 0)}>
                  <CartesianGrid strokeDasharray="3 3" stroke="#f3f4f6" />
                  <XAxis dataKey="date" tick={{ fontSize: 10 }} tickLine={false} />
                  <YAxis tick={{ fontSize: 10 }} tickLine={false} axisLine={false} domain={["auto", "auto"]} unit=" bpm" />
                  <Tooltip content={<CustomTooltip />} />
                  <Line
                    type="monotone"
                    dataKey="FC media"
                    stroke={RED}
                    strokeWidth={2}
                    dot={false}
                    activeDot={{ r: 5 }}
                  />
                </LineChart>
              </ResponsiveContainer>
            </div>
          )}

          {/* Activity table */}
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
