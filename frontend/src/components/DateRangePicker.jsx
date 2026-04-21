export function DateRangePicker({ startDate, endDate, onChange }) {
  const presets = [
    { label: "7 días", days: 7 },
    { label: "30 días", days: 30 },
    { label: "90 días", days: 90 },
    { label: "6 meses", days: 180 },
    { label: "1 año", days: 365 },
  ];

  function applyPreset(days) {
    const end = new Date();
    const start = new Date();
    start.setDate(start.getDate() - days);
    onChange(start.toISOString().slice(0, 10), end.toISOString().slice(0, 10));
  }

  return (
    <div className="flex flex-wrap items-center gap-2">
      {presets.map((p) => (
        <button
          key={p.days}
          onClick={() => applyPreset(p.days)}
          className="px-3 py-1.5 rounded-lg text-sm font-medium bg-white border border-gray-200 hover:bg-gray-50 hover:border-gray-300 transition-colors"
        >
          {p.label}
        </button>
      ))}
      <div className="flex items-center gap-2 ml-2">
        <input
          type="date"
          value={startDate}
          onChange={(e) => onChange(e.target.value, endDate)}
          className="px-3 py-1.5 rounded-lg text-sm border border-gray-200 bg-white focus:outline-none focus:ring-2 focus:ring-blue-500"
        />
        <span className="text-gray-400 text-sm">→</span>
        <input
          type="date"
          value={endDate}
          onChange={(e) => onChange(startDate, e.target.value)}
          className="px-3 py-1.5 rounded-lg text-sm border border-gray-200 bg-white focus:outline-none focus:ring-2 focus:ring-blue-500"
        />
      </div>
    </div>
  );
}
