import { useState } from "react";
import {
  BarChart, Bar, LineChart, Line, ComposedChart,
  XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer,
  Cell, ReferenceLine, Legend,
} from "recharts";
import { Footprints, TrendingUp, Flame, CheckCircle } from "lucide-react";
import { api } from "../api/garmin";
import { useFetch } from "../hooks/useFetch";
import { StatCard } from "../components/StatCard";
import { DateRangePicker } from "../components/DateRangePicker";
import { ComparisonSelector } from "../components/ComparisonSelector";
import { LoadingSpinner, ErrorMessage } from "../components/LoadingSpinner";
import { formatDate, formatNumber } from "../utils/formatters";
import { getComparisonRange, getDelta, COMP_LABELS } from "../utils/comparison";

function subDays(n) {
  const d = new Date();
  d.setDate(d.getDate() - n);
  return d.toISOString().slice(0, 10);
}

const ORANGE = "#f97316";
const GREEN = "#22c55e";
const BLUE = "#3b82f6";
const RED = "#ef4444";
const COMP_COLOR = "#9ca3af";
const COMP_LIGHT = "#d1d5db";

function CustomTooltip({ active, payload, label }) {
  if (!active || !payload?.length) return null;
  return (
    <div className="bg-white border border-gray-100 rounded-xl shadow-lg p-3 text-xs">
      <p className="font-semibold text-gray-700 mb-1">{label}</p>
      {payload.map((p) =>
        p.value != null ? (
          <p key={p.name} style={{ color: p.color || p.fill || p.stroke }}>
            {p.name}: <strong>{formatNumber(p.value)}</strong>
          </p>
        ) : null
      )}
    </div>
  );
}

function buildWeekly(days) {
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
  const [compMode, setCompMode] = useState(null);

  const compRange = getComparisonRange(startDate, endDate, compMode);
  const compLabel = compMode ? COMP_LABELS[compMode] : null;

  const { data, loading, error, refetch } = useFetch(
    () => api.getSteps(startDate, endDate),
    [startDate, endDate]
  );

  const { data: compData } = useFetch(
    () => compRange ? api.getSteps(compRange[0], compRange[1]) : Promise.resolve(null),
    [compRange?.[0], compRange?.[1]]
  );

  if (loading) return <LoadingSpinner message="Cargando datos de pasos diarios..." />;
  if (error) return <ErrorMessage message={error} onRetry={refetch} />;
  if (!data) return null;

  const { days, summary } = data;
  const compDays = compData?.days ?? [];
  const compSummary = compData?.summary ?? null;
  const hasComp = compMode && compDays.length > 0;

  const goalSteps = days[0]?.stepGoal || 10000;
  const maxLen = Math.max(days.length, compDays.length);

  // Merged daily data by day index ("Día N" as x key)
  const dailyMerged = Array.from({ length: maxLen }, (_, i) => {
    const d = days[i];
    const c = compDays[i];
    return {
      label: `Día ${i + 1}`,
      Pasos: d?.steps ?? null,
      goalAchieved: d?.goalAchieved ?? false,
      ...(hasComp ? { [`Pasos ${compLabel}`]: c?.steps ?? null } : {}),
    };
  });

  // Rolling 7-day average
  const rollingMerged = Array.from({ length: maxLen }, (_, i) => {
    const slice = days.slice(Math.max(0, i - 6), i + 1);
    const compSlice = compDays.slice(Math.max(0, i - 6), i + 1);
    return {
      label: hasComp ? `Día ${i + 1}` : formatDate(days[i]?.date || ""),
      "Media 7 días": slice.length ? Math.round(slice.reduce((s, d) => s + d.steps, 0) / slice.length) : null,
      ...(hasComp && compSlice.length ? { [`Media ${compLabel}`]: Math.round(compSlice.reduce((s, d) => s + d.steps, 0) / compSlice.length) } : {}),
    };
  });

  // Weekly
  const weeklyData = buildWeekly(days);
  const compWeeklyData = hasComp ? buildWeekly(compDays) : [];
  const weeklyMerged = Array.from({ length: Math.max(weeklyData.length, compWeeklyData.length) }, (_, i) => ({
    label: weeklyData[i]?.label || compWeeklyData[i]?.label || `Sem. ${i + 1}`,
    "Pasos (media)": weeklyData[i]?.steps ?? null,
    goalAbove: weeklyData[i] ? weeklyData[i].steps >= weeklyData[i].stepGoal : false,
    ...(hasComp ? { [`Pasos ${compLabel}`]: compWeeklyData[i]?.steps ?? null } : {}),
  }));

  const xIntervalDaily = maxLen > 20 ? Math.floor(maxLen / 10) : 0;

  // Deltas
  const deltaAvg = getDelta(summary.avgDailySteps, compSummary?.avgDailySteps);
  const deltaTotal = getDelta(summary.totalSteps, compSummary?.totalSteps);
  const deltaGoal = getDelta(summary.goalAchievedPct, compSummary?.goalAchievedPct);
  const deltaCals = getDelta(
    days.reduce((s, d) => s + d.calories, 0),
    compDays.length ? compDays.reduce((s, d) => s + d.calories, 0) : null
  );

  return (
    <div className="space-y-6">
      <div className="flex flex-col gap-3">
        <div className="flex flex-col sm:flex-row sm:items-center gap-4 justify-between">
          <div>
            <h1 className="text-2xl font-bold text-gray-900 flex items-center gap-2">
              <Footprints className="text-orange-500" size={28} /> Pasos diarios
            </h1>
            <p className="text-gray-500 text-sm mt-0.5">
              {days.length} días · Objetivo {formatNumber(goalSteps)} pasos/día
              {hasComp && <span className="text-gray-400"> · comparando con {compLabel}</span>}
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
        <StatCard
          label="Media diaria"
          value={formatNumber(summary.avgDailySteps)}
          unit="pasos"
          icon={Footprints}
          color="orange"
          delta={hasComp ? deltaAvg : null}
          sub={!hasComp ? (summary.avgDailySteps >= goalSteps ? "✅ Por encima del objetivo" : `${formatNumber(goalSteps - summary.avgDailySteps)} menos que el objetivo`) : null}
        />
        <StatCard label="Total período" value={formatNumber(summary.totalSteps)} unit="pasos" icon={TrendingUp} color="blue" delta={hasComp ? deltaTotal : null} />
        <StatCard
          label="Días con objetivo"
          value={`${summary.daysGoalAchieved} / ${summary.totalDays}`}
          icon={CheckCircle}
          color="green"
          delta={hasComp ? deltaGoal : null}
          sub={!hasComp ? `${summary.goalAchievedPct}% de los días` : null}
        />
        <StatCard
          label="Calorías totales"
          value={formatNumber(days.reduce((s, d) => s + d.calories, 0))}
          unit="kcal"
          icon={Flame}
          color="red"
          delta={hasComp ? deltaCals : null}
        />
      </div>

      {/* Daily steps */}
      <div className="bg-white rounded-2xl border border-gray-100 p-6 shadow-sm">
        <h2 className="text-base font-semibold text-gray-800 mb-4">
          Pasos diarios {hasComp && <span className="text-gray-400 font-normal text-sm">· actual vs {compLabel}</span>}
        </h2>
        <ResponsiveContainer width="100%" height={250}>
          {hasComp ? (
            <BarChart data={dailyMerged} barCategoryGap="15%" barSize={maxLen > 40 ? 3 : maxLen > 20 ? 5 : 9}>
              <CartesianGrid strokeDasharray="3 3" stroke="#f3f4f6" />
              <XAxis dataKey="label" tick={{ fontSize: 10 }} tickLine={false} interval={xIntervalDaily} />
              <YAxis tick={{ fontSize: 10 }} tickLine={false} axisLine={false} />
              <Tooltip content={<CustomTooltip />} />
              <Legend iconType="circle" iconSize={8} wrapperStyle={{ fontSize: 11 }} />
              <ReferenceLine y={goalSteps} stroke={GREEN} strokeDasharray="4 4" label={{ value: "Objetivo", position: "right", fontSize: 9, fill: GREEN }} />
              <Bar dataKey="Pasos" fill={ORANGE} radius={[2, 2, 0, 0]} />
              <Bar dataKey={`Pasos ${compLabel}`} fill={COMP_LIGHT} radius={[2, 2, 0, 0]} />
            </BarChart>
          ) : (
            <BarChart data={dailyMerged} barSize={days.length > 40 ? 4 : days.length > 20 ? 8 : 16}>
              <CartesianGrid strokeDasharray="3 3" stroke="#f3f4f6" />
              <XAxis dataKey="label" tick={{ fontSize: 10 }} tickLine={false} interval={xIntervalDaily} />
              <YAxis tick={{ fontSize: 10 }} tickLine={false} axisLine={false} />
              <Tooltip content={<CustomTooltip />} />
              <ReferenceLine y={goalSteps} stroke={GREEN} strokeDasharray="4 4" label={{ value: "Objetivo", position: "right", fontSize: 9, fill: GREEN }} />
              <Bar dataKey="Pasos" radius={[3, 3, 0, 0]}>
                {dailyMerged.map((d, i) => (
                  <Cell key={i} fill={d.goalAchieved ? ORANGE : "#fdba74"} />
                ))}
              </Bar>
            </BarChart>
          )}
        </ResponsiveContainer>
        {!hasComp && (
          <div className="flex items-center gap-4 mt-3 text-xs text-gray-400">
            <span className="flex items-center gap-1"><span className="w-3 h-3 rounded-sm inline-block" style={{ background: ORANGE }} /> Objetivo alcanzado</span>
            <span className="flex items-center gap-1"><span className="w-3 h-3 rounded-sm inline-block" style={{ background: "#fdba74" }} /> Sin alcanzar objetivo</span>
          </div>
        )}
      </div>

      {/* Rolling avg + Weekly */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        <div className="bg-white rounded-2xl border border-gray-100 p-6 shadow-sm">
          <h2 className="text-base font-semibold text-gray-800 mb-4">Media móvil de 7 días</h2>
          <ResponsiveContainer width="100%" height={200}>
            <LineChart data={rollingMerged}>
              <CartesianGrid strokeDasharray="3 3" stroke="#f3f4f6" />
              <XAxis dataKey="label" tick={{ fontSize: 10 }} tickLine={false} interval={Math.floor(maxLen / 6)} />
              <YAxis tick={{ fontSize: 10 }} tickLine={false} axisLine={false} domain={["auto", "auto"]} />
              <Tooltip content={<CustomTooltip />} />
              {hasComp && <Legend iconType="circle" iconSize={8} wrapperStyle={{ fontSize: 11 }} />}
              <ReferenceLine y={goalSteps} stroke={GREEN} strokeDasharray="4 4" />
              <Line type="monotone" dataKey="Media 7 días" stroke={ORANGE} strokeWidth={2.5} dot={false} activeDot={{ r: 5 }} />
              {hasComp && <Line type="monotone" dataKey={`Media ${compLabel}`} stroke={COMP_COLOR} strokeWidth={2} strokeDasharray="4 3" dot={false} activeDot={{ r: 4 }} />}
            </LineChart>
          </ResponsiveContainer>
        </div>

        <div className="bg-white rounded-2xl border border-gray-100 p-6 shadow-sm">
          <h2 className="text-base font-semibold text-gray-800 mb-4">
            Media semanal {hasComp && <span className="text-gray-400 font-normal text-sm">· actual vs {compLabel}</span>}
          </h2>
          <ResponsiveContainer width="100%" height={200}>
            <BarChart data={weeklyMerged} barCategoryGap="20%" barSize={hasComp ? 14 : 24}>
              <CartesianGrid strokeDasharray="3 3" stroke="#f3f4f6" />
              <XAxis dataKey="label" tick={{ fontSize: 11 }} tickLine={false} />
              <YAxis tick={{ fontSize: 10 }} tickLine={false} axisLine={false} />
              <Tooltip content={<CustomTooltip />} />
              {hasComp && <Legend iconType="circle" iconSize={8} wrapperStyle={{ fontSize: 11 }} />}
              <ReferenceLine y={goalSteps} stroke={GREEN} strokeDasharray="4 4" />
              <Bar dataKey="Pasos (media)" fill={BLUE} radius={[4, 4, 0, 0]}>
                {weeklyMerged.map((d, i) => (
                  <Cell key={i} fill={d.goalAbove ? BLUE : "#93c5fd"} />
                ))}
              </Bar>
              {hasComp && <Bar dataKey={`Pasos ${compLabel}`} fill={COMP_LIGHT} radius={[4, 4, 0, 0]} />}
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
            <ComposedChart data={dailyMerged.filter((d) => d.Pasos != null)} barSize={maxLen > 30 ? 5 : 12}>
              <CartesianGrid strokeDasharray="3 3" stroke="#f3f4f6" />
              <XAxis dataKey="label" tick={{ fontSize: 10 }} tickLine={false} interval={xIntervalDaily} />
              <YAxis tick={{ fontSize: 10 }} tickLine={false} axisLine={false} unit=" kcal" />
              <Tooltip content={<CustomTooltip />} />
              <Bar dataKey="Pasos" name="Calorías (pasos)" fill={RED} radius={[3, 3, 0, 0]} />
            </ComposedChart>
          </ResponsiveContainer>
        </div>
      )}

      {/* Detail table */}
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
                {hasComp && <th className="text-right px-4 py-3 font-medium text-gray-400">{compLabel}</th>}
                <th className="text-right px-4 py-3 font-medium">% Obj.</th>
                <th className="text-right px-4 py-3 font-medium">Dist.</th>
                <th className="text-right px-4 py-3 font-medium">Calorías</th>
                <th className="text-right px-4 py-3 font-medium">T. activo</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-gray-50">
              {[...days].reverse().slice(0, 30).map((d, i) => {
                const pct = d.stepGoal > 0 ? Math.round((d.steps / d.stepGoal) * 100) : 0;
                const compDay = hasComp ? compDays[days.length - 1 - i] : null;
                return (
                  <tr key={d.date} className="hover:bg-gray-50 transition-colors">
                    <td className="px-4 py-3 text-gray-500">{formatDate(d.date)}</td>
                    <td className="px-4 py-3 text-right font-mono font-semibold" style={{ color: d.goalAchieved ? ORANGE : "inherit" }}>
                      {formatNumber(d.steps)}
                    </td>
                    {hasComp && (
                      <td className="px-4 py-3 text-right font-mono text-gray-400">
                        {compDay ? formatNumber(compDay.steps) : "—"}
                      </td>
                    )}
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
