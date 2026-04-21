import { useState } from "react";
import {
  BarChart, Bar, LineChart, Line,
  XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer,
  Cell, ReferenceLine,
} from "recharts";
import { Footprints, Target, TrendingUp, Flame, CheckCircle } from "lucide-react";
import { api } from "../api/garmin";
import { useFetch } from "../hooks/useFetch";
import { StatCard } from "../components/StatCard";
import { DateRangePicker } from "../components/DateRangePicker";
import { LoadingSpinner, ErrorMessage } from "../components/LoadingSpinner";
import { formatDate, formatNumber } from "../utils/formatters";

function subDays(n) {
  const d = new Date();
  d.setDate(d.getDate() - n);
  return d.toISOString().slice(0, 10);
}

const ORANGE = "#f97316";
const GREEN = "#22c55e";
const BLUE = "#3b82f6";
const RED = "#ef4444";
const GRAY = "#d1d5db";

function CustomTooltip({ active, payload, label }) {
  if (!active || !payload?.length) return null;
  return (
    <div className="bg-white border border-gray-100 rounded-xl shadow-lg p-3 text-xs">
      <p className="font-semibold text-gray-700 mb-1">{label}</p>
      {payload.map((p) => (
        <p key={p.name} style={{ color: p.color || p.fill }}>
          {p.name}: <strong>{typeof p.value === "number" ? formatNumber(p.value) : p.value}</strong>
        </p>
      ))}
    </div>
  );
}

function WeeklyBar({ days }) {
  const weeks = [];
  let week = [];
  days.forEach((d, i) => {
    week.push(d);
    if (week.length === 7 || i === days.length - 1) {
      weeks.push({
        label: `Sem. ${weeks.length + 1}`,
        steps: Math.round(week.reduce((s, x) => s + x.steps, 0) / week.length),
        stepGoal: week[0]?.stepGoal || 10000,
      });
      week = [];
    }
  });
  return weeks;
}

export function StepsPage() {
  const [startDate, setStartDate] = useState(subDays(30));
  const [endDate, setEndDate] = useState(new Date().toISOString().slice(0, 10));

  const { data, loading, error, refetch } = useFetch(
    () => api.getSteps(startDate, endDate),
    [startDate, endDate]
  );

  if (loading) return <LoadingSpinner message="Cargando datos de pasos diarios..." />;
  if (error) return <ErrorMessage message={error} onRetry={refetch} />;
  if (!data) return null;

  const { days, summary } = data;

  const chartData = days.map((d) => ({
    date: formatDate(d.date),
    Pasos: d.steps,
    Objetivo: d.stepGoal,
    goalAchieved: d.goalAchieved,
    "Dist. (km)": d.distanceKm,
    "Calorías": d.calories,
    "Tiempo activo (min)": d.activeTimeMin,
  }));

  const weeklyData = WeeklyBar(days);

  // Rolling 7-day average
  const rollingAvg = days.map((_, i) => {
    const slice = days.slice(Math.max(0, i - 6), i + 1);
    return {
      date: formatDate(days[i].date),
      "Media 7 días": Math.round(slice.reduce((s, d) => s + d.steps, 0) / slice.length),
    };
  });

  const goalSteps = days[0]?.stepGoal || 10000;

  return (
    <div className="space-y-6">
      <div className="flex flex-col sm:flex-row sm:items-center gap-4 justify-between">
        <div>
          <h1 className="text-2xl font-bold text-gray-900 flex items-center gap-2">
            <Footprints className="text-orange-500" size={28} /> Pasos diarios
          </h1>
          <p className="text-gray-500 text-sm mt-0.5">
            {days.length} días · Objetivo {formatNumber(goalSteps)} pasos/día
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
        <StatCard
          label="Media diaria"
          value={formatNumber(summary.avgDailySteps)}
          unit="pasos"
          icon={Footprints}
          color="orange"
          sub={summary.avgDailySteps >= goalSteps ? "✅ Por encima del objetivo" : `${formatNumber(goalSteps - summary.avgDailySteps)} menos que el objetivo`}
        />
        <StatCard
          label="Total período"
          value={formatNumber(summary.totalSteps)}
          unit="pasos"
          icon={TrendingUp}
          color="blue"
        />
        <StatCard
          label="Días con objetivo"
          value={`${summary.daysGoalAchieved} / ${summary.totalDays}`}
          icon={CheckCircle}
          color="green"
          sub={`${summary.goalAchievedPct}% de los días`}
        />
        <StatCard
          label="Calorías totales"
          value={formatNumber(days.reduce((s, d) => s + d.calories, 0))}
          unit="kcal"
          icon={Flame}
          color="red"
        />
      </div>

      {/* Daily steps bar chart */}
      <div className="bg-white rounded-2xl border border-gray-100 p-6 shadow-sm">
        <h2 className="text-base font-semibold text-gray-800 mb-4">
          Pasos diarios
        </h2>
        <ResponsiveContainer width="100%" height={240}>
          <BarChart data={chartData} barSize={days.length > 40 ? 4 : days.length > 20 ? 8 : 16}>
            <CartesianGrid strokeDasharray="3 3" stroke="#f3f4f6" />
            <XAxis
              dataKey="date"
              tick={{ fontSize: 10 }}
              tickLine={false}
              interval={days.length > 20 ? Math.floor(days.length / 10) : 0}
            />
            <YAxis tick={{ fontSize: 10 }} tickLine={false} axisLine={false} />
            <Tooltip content={<CustomTooltip />} />
            <ReferenceLine
              y={goalSteps}
              stroke={GREEN}
              strokeDasharray="4 4"
              label={{ value: "Objetivo", position: "right", fontSize: 10, fill: GREEN }}
            />
            <Bar dataKey="Pasos" radius={[3, 3, 0, 0]}>
              {chartData.map((d, i) => (
                <Cell key={i} fill={d.goalAchieved ? ORANGE : "#fdba74"} />
              ))}
            </Bar>
          </BarChart>
        </ResponsiveContainer>
        <div className="flex items-center gap-4 mt-3 text-xs text-gray-400">
          <span className="flex items-center gap-1">
            <span className="w-3 h-3 rounded-sm inline-block" style={{ background: ORANGE }} /> Objetivo alcanzado
          </span>
          <span className="flex items-center gap-1">
            <span className="w-3 h-3 rounded-sm inline-block" style={{ background: "#fdba74" }} /> Sin alcanzar objetivo
          </span>
        </div>
      </div>

      {/* Rolling average + weekly */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        <div className="bg-white rounded-2xl border border-gray-100 p-6 shadow-sm">
          <h2 className="text-base font-semibold text-gray-800 mb-4">
            Media móvil de 7 días
          </h2>
          <ResponsiveContainer width="100%" height={200}>
            <LineChart data={rollingAvg}>
              <CartesianGrid strokeDasharray="3 3" stroke="#f3f4f6" />
              <XAxis
                dataKey="date"
                tick={{ fontSize: 10 }}
                tickLine={false}
                interval={Math.floor(days.length / 6)}
              />
              <YAxis tick={{ fontSize: 10 }} tickLine={false} axisLine={false} domain={["auto", "auto"]} />
              <Tooltip content={<CustomTooltip />} />
              <ReferenceLine y={goalSteps} stroke={GREEN} strokeDasharray="4 4" />
              <Line
                type="monotone"
                dataKey="Media 7 días"
                stroke={ORANGE}
                strokeWidth={2.5}
                dot={false}
                activeDot={{ r: 5 }}
              />
            </LineChart>
          </ResponsiveContainer>
        </div>

        <div className="bg-white rounded-2xl border border-gray-100 p-6 shadow-sm">
          <h2 className="text-base font-semibold text-gray-800 mb-4">
            Media semanal de pasos
          </h2>
          <ResponsiveContainer width="100%" height={200}>
            <BarChart data={weeklyData} barSize={24}>
              <CartesianGrid strokeDasharray="3 3" stroke="#f3f4f6" />
              <XAxis dataKey="label" tick={{ fontSize: 11 }} tickLine={false} />
              <YAxis tick={{ fontSize: 10 }} tickLine={false} axisLine={false} />
              <Tooltip content={<CustomTooltip />} />
              <ReferenceLine y={goalSteps} stroke={GREEN} strokeDasharray="4 4" />
              <Bar dataKey="steps" name="Pasos (media)" fill={BLUE} radius={[4, 4, 0, 0]}>
                {weeklyData.map((d, i) => (
                  <Cell key={i} fill={d.steps >= d.stepGoal ? BLUE : "#93c5fd"} />
                ))}
              </Bar>
            </BarChart>
          </ResponsiveContainer>
        </div>
      </div>

      {/* Calories */}
      {days.some((d) => d.calories > 0) && (
        <div className="bg-white rounded-2xl border border-gray-100 p-6 shadow-sm">
          <h2 className="text-base font-semibold text-gray-800 mb-4 flex items-center gap-2">
            <Flame size={16} className="text-red-500" /> Calorías activas por día
          </h2>
          <ResponsiveContainer width="100%" height={200}>
            <BarChart data={chartData.filter((d) => d["Calorías"] > 0)} barSize={days.length > 30 ? 5 : 14}>
              <CartesianGrid strokeDasharray="3 3" stroke="#f3f4f6" />
              <XAxis dataKey="date" tick={{ fontSize: 10 }} tickLine={false} interval={days.length > 20 ? Math.floor(days.length / 8) : 0} />
              <YAxis tick={{ fontSize: 10 }} tickLine={false} axisLine={false} unit=" kcal" />
              <Tooltip content={<CustomTooltip />} />
              <Bar dataKey="Calorías" fill={RED} radius={[3, 3, 0, 0]} />
            </BarChart>
          </ResponsiveContainer>
        </div>
      )}

      {/* Summary table */}
      <div className="bg-white rounded-2xl border border-gray-100 shadow-sm overflow-hidden">
        <div className="px-6 py-4 border-b border-gray-50">
          <h2 className="text-base font-semibold text-gray-800">Detalle por día</h2>
        </div>
        <div className="overflow-x-auto">
          <table className="w-full text-sm">
            <thead>
              <tr className="bg-gray-50 text-gray-500 text-xs uppercase tracking-wide">
                <th className="text-left px-4 py-3 font-medium">Fecha</th>
                <th className="text-right px-4 py-3 font-medium">Pasos</th>
                <th className="text-right px-4 py-3 font-medium">Objetivo</th>
                <th className="text-right px-4 py-3 font-medium">% Obj.</th>
                <th className="text-right px-4 py-3 font-medium">Dist.</th>
                <th className="text-right px-4 py-3 font-medium">Calorías</th>
                <th className="text-right px-4 py-3 font-medium">T. activo</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-gray-50">
              {[...days].reverse().slice(0, 30).map((d) => {
                const pct = d.stepGoal > 0 ? Math.round((d.steps / d.stepGoal) * 100) : 0;
                return (
                  <tr key={d.date} className="hover:bg-gray-50 transition-colors">
                    <td className="px-4 py-3 text-gray-500">{formatDate(d.date)}</td>
                    <td className="px-4 py-3 text-right font-mono font-semibold" style={{ color: d.goalAchieved ? ORANGE : "inherit" }}>
                      {formatNumber(d.steps)}
                    </td>
                    <td className="px-4 py-3 text-right text-gray-400">{formatNumber(d.stepGoal)}</td>
                    <td className="px-4 py-3 text-right">
                      <span className={`px-2 py-0.5 rounded-full text-xs font-medium ${d.goalAchieved ? "bg-green-50 text-green-700" : "bg-gray-100 text-gray-500"}`}>
                        {pct}%
                      </span>
                    </td>
                    <td className="px-4 py-3 text-right">{formatNumber(d.distanceKm, 1)} km</td>
                    <td className="px-4 py-3 text-right">{d.calories ? `${formatNumber(d.calories)} kcal` : "—"}</td>
                    <td className="px-4 py-3 text-right">{d.activeTimeMin ? `${d.activeTimeMin} min` : "—"}</td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  );
}
