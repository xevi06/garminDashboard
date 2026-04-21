export function StatCard({ label, value, unit, icon: Icon, color = "blue", sub }) {
  const colors = {
    blue: "bg-blue-50 text-blue-600 border-blue-100",
    green: "bg-green-50 text-green-600 border-green-100",
    orange: "bg-orange-50 text-orange-600 border-orange-100",
    purple: "bg-purple-50 text-purple-600 border-purple-100",
    red: "bg-red-50 text-red-600 border-red-100",
    teal: "bg-teal-50 text-teal-600 border-teal-100",
  };
  const iconColors = {
    blue: "text-blue-500",
    green: "text-green-500",
    orange: "text-orange-500",
    purple: "text-purple-500",
    red: "text-red-500",
    teal: "text-teal-500",
  };

  return (
    <div className={`rounded-2xl border p-5 flex flex-col gap-1 ${colors[color]}`}>
      <div className="flex items-center justify-between">
        <span className="text-sm font-medium opacity-70">{label}</span>
        {Icon && <Icon size={20} className={iconColors[color]} />}
      </div>
      <div className="flex items-end gap-1">
        <span className="text-3xl font-bold">{value}</span>
        {unit && <span className="text-sm font-medium pb-1 opacity-60">{unit}</span>}
      </div>
      {sub && <span className="text-xs opacity-60">{sub}</span>}
    </div>
  );
}
