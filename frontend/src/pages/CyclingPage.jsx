import { useState } from "react";
import {
  AreaChart, Area, BarChart, Bar, LineChart, Line,
  XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer, Legend,
} from "recharts";
import { Bike, TrendingUp, Clock, Mountain, Zap, Heart } from "lucide-react";
import { api } from "../api/garmin";
import { useFetch } from "../hooks/useFetch";
import { StatCard } from "../components/StatCard";
import { DateRangePicker } from "../components/DateRangePicker";
import { LoadingSpinner, ErrorMessage } from "../components/LoadingSpinner";
import { formatDate, formatDuration, formatNumber } from "../utils/formatters";

function subDays(n) {
  const d = new Date();
  d.setDate(d.getDate() - n);
  return d.toISOString().slice(0, 10);
}

const BLUE = "#3b82f6";
const BLUE_LIGHT = "#93c5fd";
const ORANGE = "#f97316";
const GREEN = "#22c55e";
const PURPLE = "#a855f7";
const RED = "#ef4444";

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

export function CyclingPage() {
  const [startDate, setStartDate] = useState(subDays(90));
  const [endDate, setEndDate] = useState(new Date().toISOString().slice(0, 10));

  const { data, loading, error, refetch } = useFetch(
    () => api.getCycling(startDate, endDate),
    [startDate, endDate]
  );

  if (loading) return <LoadingSpinner message="Cargando actividades de ciclismo..." />;
  if (error) return <ErrorMessage message={error} onRetry={refetch} />;
  if (!data) return null;

  const { activities, summary } = data;
  const hasActivities = activities.length > 0;

  // Prepare chart data
  const chartData = activities.map((a) => ({
    date: formatDate(a.date),
    "Distancia (km)": a.distanceKm,
    "Velocidad media (km/h)": a.avgSpeedKmh,
    "Desnivel (m)": a.elevationGainM,
    "FC media": a.avgHr,
    "Potencia (W)": a.avgPower,
    "Duración (min)": a.durationMin,
  }));

  // Cumulative distance
  let cumulative = 0;
  const cumulativeData = activities.map((a) => {
    cumulative += a.distanceKm;
    return { date: formatDate(a.date), "Distancia acumulada (km)": Math.round(cumulative) };
  });

  return (
    <div className="space-y-6">
      <div className="flex flex-col sm:flex-row sm:items-center gap-4 justify-between">
        <div>
          <h1 className="text-2xl font-bold text-gray-900 flex items-center gap-2">
            <Bike className="text-blue-500" size={28} /> Ciclismo
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

      {/* KPI cards */}
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
        <StatCard
          label="Actividades"
          value={formatNumber(summary.totalActivities)}
          icon={Bike}
          color="blue"
        />
        <StatCard
          label="Distancia total"
          value={formatNumber(summary.totalDistanceKm, 1)}
          unit="km"
          icon={TrendingUp}
          color="green"
        />
        <StatCard
          label="Tiempo total"
          value={formatDuration(summary.totalTimeMin)}
          icon={Clock}
          color="purple"
        />
        <StatCard
          label="Desnivel total"
          value={formatNumber(summary.totalElevationM)}
          unit="m"
          icon={Mountain}
          color="orange"
        />
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
            <h2 className="text-base font-semibold text-gray-800 mb-4">
              Distancia por actividad (km)
            </h2>
            <ResponsiveContainer width="100%" height={220}>
              <BarChart data={chartData} barSize={activities.length > 30 ? 4 : 20}>
                <CartesianGrid strokeDasharray="3 3" stroke="#f3f4f6" />
                <XAxis dataKey="date" tick={{ fontSize: 11 }} tickLine={false} />
                <YAxis tick={{ fontSize: 11 }} tickLine={false} axisLine={false} unit=" km" />
                <Tooltip content={<CustomTooltip />} />
                <Bar dataKey="Distancia (km)" fill={BLUE} radius={[4, 4, 0, 0]} />
              </BarChart>
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
                  <XAxis dataKey="date" tick={{ fontSize: 10 }} tickLine={false} />
                  <YAxis tick={{ fontSize: 10 }} tickLine={false} axisLine={false} domain={["auto", "auto"]} unit=" km/h" />
                  <Tooltip content={<CustomTooltip />} />
                  <Line
                    type="monotone"
                    dataKey="Velocidad media (km/h)"
                    stroke={ORANGE}
                    strokeWidth={2}
                    dot={activities.length < 30}
                    activeDot={{ r: 5 }}
                  />
                </LineChart>
              </ResponsiveContainer>
            </div>

            <div className="bg-white rounded-2xl border border-gray-100 p-6 shadow-sm">
              <h2 className="text-base font-semibold text-gray-800 mb-4 flex items-center gap-2">
                <Mountain size={16} className="text-purple-500" /> Desnivel positivo (m)
              </h2>
              <ResponsiveContainer width="100%" height={200}>
                <BarChart data={chartData} barSize={activities.length > 30 ? 4 : 18}>
                  <CartesianGrid strokeDasharray="3 3" stroke="#f3f4f6" />
                  <XAxis dataKey="date" tick={{ fontSize: 10 }} tickLine={false} />
                  <YAxis tick={{ fontSize: 10 }} tickLine={false} axisLine={false} unit=" m" />
                  <Tooltip content={<CustomTooltip />} />
                  <Bar dataKey="Desnivel (m)" fill={PURPLE} radius={[4, 4, 0, 0]} />
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
                  <linearGradient id="blueGrad" x1="0" y1="0" x2="0" y2="1">
                    <stop offset="5%" stopColor={BLUE} stopOpacity={0.2} />
                    <stop offset="95%" stopColor={BLUE} stopOpacity={0} />
                  </linearGradient>
                </defs>
                <CartesianGrid strokeDasharray="3 3" stroke="#f3f4f6" />
                <XAxis dataKey="date" tick={{ fontSize: 10 }} tickLine={false} />
                <YAxis tick={{ fontSize: 10 }} tickLine={false} axisLine={false} unit=" km" />
                <Tooltip content={<CustomTooltip />} />
                <Area
                  type="monotone"
                  dataKey="Distancia acumulada (km)"
                  stroke={BLUE}
                  strokeWidth={2}
                  fill="url(#blueGrad)"
                />
              </AreaChart>
            </ResponsiveContainer>
          </div>

          {/* HR and Power if available */}
          {activities.some((a) => a.avgHr > 0) && (
            <div className="bg-white rounded-2xl border border-gray-100 p-6 shadow-sm">
              <h2 className="text-base font-semibold text-gray-800 mb-4 flex items-center gap-2">
                <Heart size={16} className="text-red-500" /> Frecuencia cardíaca media (bpm)
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

          {activities.some((a) => a.avgPower) && (
            <div className="bg-white rounded-2xl border border-gray-100 p-6 shadow-sm">
              <h2 className="text-base font-semibold text-gray-800 mb-4 flex items-center gap-2">
                <Zap size={16} className="text-yellow-500" /> Potencia media (W)
              </h2>
              <ResponsiveContainer width="100%" height={200}>
                <LineChart data={chartData.filter((d) => d["Potencia (W)"] > 0)}>
                  <CartesianGrid strokeDasharray="3 3" stroke="#f3f4f6" />
                  <XAxis dataKey="date" tick={{ fontSize: 10 }} tickLine={false} />
                  <YAxis tick={{ fontSize: 10 }} tickLine={false} axisLine={false} domain={["auto", "auto"]} unit=" W" />
                  <Tooltip content={<CustomTooltip />} />
                  <Line
                    type="monotone"
                    dataKey="Potencia (W)"
                    stroke="#eab308"
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
