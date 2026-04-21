export function LoadingSpinner({ message = "Cargando datos de Garmin..." }) {
  return (
    <div className="flex flex-col items-center justify-center py-20 gap-4">
      <div className="w-12 h-12 border-4 border-blue-200 border-t-blue-600 rounded-full animate-spin" />
      <p className="text-gray-500 text-sm">{message}</p>
    </div>
  );
}

export function ErrorMessage({ message, onRetry }) {
  return (
    <div className="flex flex-col items-center justify-center py-20 gap-3">
      <div className="text-red-400 text-5xl">⚠️</div>
      <p className="text-gray-700 font-medium">Error al cargar datos</p>
      <p className="text-gray-500 text-sm text-center max-w-md">{message}</p>
      {onRetry && (
        <button
          onClick={onRetry}
          className="mt-2 px-4 py-2 bg-blue-600 text-white rounded-lg text-sm hover:bg-blue-700 transition-colors"
        >
          Reintentar
        </button>
      )}
    </div>
  );
}
