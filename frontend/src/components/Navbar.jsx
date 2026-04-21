import { NavLink } from "react-router-dom";
import { Bike, PersonStanding, Footprints, LayoutDashboard, LogOut } from "lucide-react";

const links = [
  { to: "/", label: "Resumen", icon: LayoutDashboard },
  { to: "/cycling", label: "Ciclismo", icon: Bike },
  { to: "/running", label: "Running", icon: PersonStanding },
  { to: "/steps", label: "Pasos", icon: Footprints },
];

export function Navbar({ user, onLogout }) {
  return (
    <nav className="fixed top-0 left-0 right-0 z-50 bg-white border-b border-gray-100 shadow-sm">
      <div className="max-w-7xl mx-auto px-4 h-14 flex items-center justify-between">
        <div className="flex items-center gap-6">
          <span className="font-bold text-lg text-blue-600 tracking-tight">
            🏃 GarminDash
          </span>
          <div className="flex items-center gap-1">
            {links.map(({ to, label, icon: Icon }) => (
              <NavLink
                key={to}
                to={to}
                end={to === "/"}
                className={({ isActive }) =>
                  `flex items-center gap-1.5 px-3 py-2 rounded-lg text-sm font-medium transition-colors ${
                    isActive
                      ? "bg-blue-50 text-blue-700"
                      : "text-gray-600 hover:bg-gray-50 hover:text-gray-900"
                  }`
                }
              >
                <Icon size={16} />
                {label}
              </NavLink>
            ))}
          </div>
        </div>
        <div className="flex items-center gap-3">
          <span className="text-sm text-gray-500">{user?.displayName}</span>
          <button
            onClick={onLogout}
            className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-sm text-gray-500 hover:bg-red-50 hover:text-red-600 transition-colors"
          >
            <LogOut size={15} />
            Salir
          </button>
        </div>
      </div>
    </nav>
  );
}
