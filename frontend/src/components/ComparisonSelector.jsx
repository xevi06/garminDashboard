const OPTIONS = [
  { value: null, label: "Sin comparar" },
  { value: "week", label: "Sem. anterior" },
  { value: "month", label: "Mes anterior" },
  { value: "year", label: "Año anterior" },
];

export function ComparisonSelector({ mode, onChange }) {
  return (
    <div className="flex items-center gap-1.5 flex-wrap">
      <span className="text-xs text-gray-400 font-medium">Comparar:</span>
      {OPTIONS.map((o) => (
        <button
          key={String(o.value)}
          onClick={() => onChange(o.value)}
          className={`px-2.5 py-1 rounded-lg text-xs font-medium transition-colors ${
            mode === o.value
              ? "bg-gray-800 text-white"
              : "bg-white border border-gray-200 text-gray-500 hover:bg-gray-50 hover:border-gray-300"
          }`}
        >
          {o.value ? `↔ ${o.label}` : o.label}
        </button>
      ))}
    </div>
  );
}
