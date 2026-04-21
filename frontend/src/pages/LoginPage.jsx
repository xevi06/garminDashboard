import { useState } from "react";
import { Bike, PersonStanding, Footprints } from "lucide-react";

export function LoginPage({ onLogin, loading, error }) {
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");

  function handleSubmit(e) {
    e.preventDefault();
    if (email && password) onLogin(email, password);
  }

  return (
    <div className="min-h-screen bg-gradient-to-br from-blue-50 via-white to-indigo-50 flex items-center justify-center p-4">
      <div className="w-full max-w-md">
        <div className="text-center mb-8">
          <h1 className="text-4xl font-extrabold text-gray-900 mb-2">
            🏃 GarminDash
          </h1>
          <p className="text-gray-500">
            Dashboards intuitivos para tus datos de Garmin Connect
          </p>
          <div className="flex justify-center gap-6 mt-4 text-gray-400">
            <div className="flex flex-col items-center gap-1">
              <Bike size={28} className="text-blue-400" />
              <span className="text-xs">Ciclismo</span>
            </div>
            <div className="flex flex-col items-center gap-1">
              <PersonStanding size={28} className="text-green-400" />
              <span className="text-xs">Running</span>
            </div>
            <div className="flex flex-col items-center gap-1">
              <Footprints size={28} className="text-orange-400" />
              <span className="text-xs">Pasos</span>
            </div>
          </div>
        </div>

        <div className="bg-white rounded-2xl shadow-xl border border-gray-100 p-8">
          <h2 className="text-xl font-bold text-gray-800 mb-1">
            Conectar con Garmin
          </h2>
          <p className="text-sm text-gray-400 mb-6">
            Usa tus credenciales de Garmin Connect
          </p>

          <form onSubmit={handleSubmit} className="space-y-4">
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">
                Email
              </label>
              <input
                type="email"
                autoComplete="email"
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                required
                placeholder="tu@email.com"
                className="w-full px-4 py-3 rounded-xl border border-gray-200 focus:outline-none focus:ring-2 focus:ring-blue-500 text-sm"
              />
            </div>
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">
                Contraseña
              </label>
              <input
                type="password"
                autoComplete="current-password"
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                required
                placeholder="••••••••"
                className="w-full px-4 py-3 rounded-xl border border-gray-200 focus:outline-none focus:ring-2 focus:ring-blue-500 text-sm"
              />
            </div>

            {error && (
              <div className="bg-red-50 text-red-600 text-sm px-4 py-3 rounded-xl border border-red-100">
                {error}
              </div>
            )}

            <button
              type="submit"
              disabled={loading}
              className="w-full py-3 bg-blue-600 hover:bg-blue-700 disabled:opacity-60 disabled:cursor-not-allowed text-white font-semibold rounded-xl transition-colors flex items-center justify-center gap-2"
            >
              {loading ? (
                <>
                  <div className="w-4 h-4 border-2 border-white border-t-transparent rounded-full animate-spin" />
                  Conectando...
                </>
              ) : (
                "Entrar"
              )}
            </button>
          </form>

          <p className="text-xs text-gray-400 text-center mt-6">
            Tus credenciales solo se usan para conectar con Garmin Connect y
            nunca se almacenan en disco.
          </p>
        </div>
      </div>
    </div>
  );
}
