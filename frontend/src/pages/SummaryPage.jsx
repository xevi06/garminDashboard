import { Bike, PersonStanding, Footprints, TrendingUp, ArrowRight } from "lucide-react";
import { Link } from "react-router-dom";
import { api } from "../api/garmin";
import { useFetch } from "../hooks/useFetch";
import { LoadingSpinner, ErrorMessage } from "../components/LoadingSpinner";
import { formatNumber } from "../utils/formatters";

function SummaryCard({ to, icon: Icon, color, title, stats }) {
  const colors = {
    blue: { bg: "from-blue-500 to-blue-600", icon: "text-blue-100", badge: "bg-blue-100 text-blue-700" },
    green: { bg: "from-green-500 to-green-600", icon: "text-green-100", badge: "bg-green-100 text-green-700" },
    orange: { bg: "from-orange-400 to-orange-500", icon: "text-orange-100", badge: "bg-orange-100 text-orange-700" },
  };
  const c = colors[color];

  return (
    <Link
      to={to}
      className={`bg-gradient-to-br ${c.bg} rounded-2xl p-6 text-white shadow-lg hover:shadow-xl transition-all hover:-translate-y-0.5 group`}
    >
      <div className="flex items-start justify-between mb-4">
        <Icon size={36} className={c.icon} />
        <ArrowRight size={18} className="opacity-60 group-hover:opacity-100 group-hover:translate-x-1 transition-all" />
      </div>
      <h2 className="text-xl font-bold mb-3">{title}</h2>
      <div className="space-y-1.5">
        {stats.map((s) => (
          <div key={s.label} className="flex items-center justify-between">
            <span className="text-sm opacity-80">{s.label}</span>
            <span className="text-sm font-semibold">{s.value}</span>
          </div>
        ))}
      </div>
    </Link>
  );
}

export function SummaryPage({ user }) {
  const { data, loading, error, refetch } = useFetch(() => api.getSummary(), []);

  if (loading) return <LoadingSpinner message="Cargando resumen..." />;
  if (error) return <ErrorMessage message={error} onRetry={refetch} />;
  if (!data) return null;

  const { last30Days, today } = data;

  return (
    <div className="space-y-8">
      <div>
        <h1 className="text-3xl font-extrabold text-gray-900">
          Hola, {user?.displayName?.split(" ")[0] || "atleta"} 👋
        </h1>
        <p className="text-gray-400 mt-1">Resumen de los últimos 30 días</p>
      </div>

      {/* Today's steps banner */}
      <div className="bg-gradient-to-r from-orange-50 to-amber-50 border border-orange-100 rounded-2xl p-5 flex items-center justify-between">
        <div className="flex items-center gap-4">
          <Footprints size={32} className="text-orange-500" />
          <div>
            <p className="text-sm text-orange-600 font-medium">Pasos hoy</p>
            <p className="text-3xl font-bold text-orange-700">
              {formatNumber(today.steps)}
            </p>
          </div>
        </div>
        <Link
          to="/steps"
          className="flex items-center gap-1 text-sm text-orange-600 font-medium hover:text-orange-800 transition-colors"
        >
          Ver historial <ArrowRight size={14} />
        </Link>
      </div>

      {/* Main cards */}
      <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
        <SummaryCard
          to="/cycling"
          icon={Bike}
          color="blue"
          title="Ciclismo"
          stats={[
            { label: "Actividades", value: `${last30Days.cyclingActivities} salidas` },
            { label: "Distancia total", value: `${formatNumber(last30Days.cyclingDistanceKm, 1)} km` },
          ]}
        />
        <SummaryCard
          to="/running"
          icon={PersonStanding}
          color="green"
          title="Running"
          stats={[
            { label: "Actividades", value: `${last30Days.runningActivities} salidas` },
            { label: "Distancia total", value: `${formatNumber(last30Days.runningDistanceKm, 1)} km` },
          ]}
        />
        <SummaryCard
          to="/steps"
          icon={Footprints}
          color="orange"
          title="Pasos"
          stats={[
            { label: "Media diaria", value: `— pasos` },
            { label: "Ver historial", value: "→" },
          ]}
        />
      </div>

      {/* Tips */}
      <div className="bg-white rounded-2xl border border-gray-100 p-6 shadow-sm">
        <h2 className="text-base font-semibold text-gray-800 mb-3 flex items-center gap-2">
          <TrendingUp size={18} className="text-blue-500" /> Cómo usar GarminDash
        </h2>
        <ul className="space-y-2 text-sm text-gray-500">
          <li className="flex items-start gap-2">
            <span className="text-blue-400 mt-0.5">•</span>
            Selecciona un deporte en el menú superior para ver tus dashboards detallados.
          </li>
          <li className="flex items-start gap-2">
            <span className="text-blue-400 mt-0.5">•</span>
            Usa los botones de período (7 días, 30 días, 90 días…) para filtrar las fechas.
          </li>
          <li className="flex items-start gap-2">
            <span className="text-blue-400 mt-0.5">•</span>
            Los datos se cachean 5 minutos para evitar límites de la API de Garmin.
          </li>
        </ul>
      </div>
    </div>
  );
}
