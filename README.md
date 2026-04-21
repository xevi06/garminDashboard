# GarminDash

Dashboards intuitivos para tus datos de Garmin Connect: ciclismo, running y pasos diarios.

## Arranque rápido

### Backend (Python + FastAPI)

```bash
cd backend
bash run.sh
# → http://localhost:8000
```

### Frontend (React + Vite)

```bash
cd frontend
npm install
npm run dev
# → http://localhost:5173
```

Abre http://localhost:5173, introduce tus credenciales de Garmin Connect y listo.

## Características

- **Ciclismo**: distancia, velocidad, desnivel, potencia, FC, gráfico acumulado
- **Running**: distancia, ritmo (eje invertido), distribución de ritmos por zonas, FC, gráfico acumulado
- **Pasos diarios**: media móvil 7 días, media semanal, calorías, tiempo activo, objetivo diario
- Selector de período flexible (7d / 30d / 90d / 6m / 1 año / fechas custom)
- Caché de 5 minutos para respetar límites de la API de Garmin
- Las credenciales no se almacenan en disco

## Stack técnico

| Capa     | Tecnología                          |
|----------|-------------------------------------|
| Backend  | Python 3.11+, FastAPI, garminconnect |
| Frontend | React 18, Vite, Recharts, Tailwind  |
| Auth     | Bearer token en memoria de sesión   |
