# La Buena Tijera · Sistema de reservas

Sistema de reservas para una barbería con un único profesional. Backend FastAPI y PostgreSQL; interfaz Next.js para clientes y barbero.

[Contrato de API](Docs/API_CONTRACT.md) · [Arquitectura](Docs/ARQUITECTURE.md) · [Capturas](#vista-previa) · [Licencia MIT](LICENSE)

## Vista previa

Portada completa de La Buena Tijera en escritorio.

![Portada completa de La Buena Tijera en escritorio](Docs/assets/frontend/portada-escritorio.jpg)

<details>
<summary>Ver la portada completa en móvil</summary>

![Portada completa de La Buena Tijera en móvil](Docs/assets/frontend/portada-movil.jpg)

</details>

## Funcionalidades

- Registro de clientes e inicio de sesión con JWT.
- Consulta de horarios futuros libres, descontando reservas pendientes y confirmadas.
- Solicitud de citas, consulta personal, cancelación y reprogramación de citas pendientes.
- Panel del barbero: lectura y reemplazo de horarios semanales, filtros de citas, confirmación y cancelación con motivo opcional.
- Separación de permisos por rol y propiedad de las citas.
- Restricción PostgreSQL contra reservas superpuestas, también bajo concurrencia.

Es un proyecto de portafolio en desarrollo. No incluye pagos, múltiples barberos ni recuperación de contraseñas. Los tokens se guardan en localStorage; cerrar sesión elimina la copia del navegador y los tokens emitidos siguen válidos hasta expirar. No se presenta como listo para producción.

## Tecnologías y estructura

Python 3.12+, FastAPI, SQLAlchemy 2, Alembic, psycopg, JWT y bcrypt. Next.js 16, React 19, TypeScript, Tailwind CSS 4 y Radix/shadcn.

```text
app/
  api/routers/      # Endpoints y permisos
  core/            # Configuración y autenticación
  db/              # Sesiones y usuario inicial del barbero
  models/          # Usuarios, citas y horarios
  repositories/    # Consultas y bloqueo transaccional
  schemas/         # Validaciones y respuestas
  services/        # Reglas y transacciones
migrations/        # Evolución del esquema PostgreSQL
tests/             # Pruebas de integración y concurrencia
frontend/src/
  app/             # /, /login, /register, /client, /provider
  components/      # Controles y navegación
  lib/             # API, sesión, tipos y fechas
Docs/              # Contratos, decisiones y capturas
```

## Inicio local

Requiere Python 3.12+, uv, PostgreSQL 15+ y Node.js 20.9+ con npm. Crea una base vacía cuyo propietario sea el usuario de conexión; los comandos de migración no crean la base ni el rol.

```bash
cp .env.example .env
# Configura DATABASE_URL, JWT_SECRET y las credenciales del barbero en .env.
uv sync --locked
uv run alembic upgrade head
uv run python -m app.db.seed
uv run uvicorn app.main:app --host 127.0.0.1 --port 8000
```

Swagger: http://127.0.0.1:8000/docs. La raíz de la API no tiene prefijo /api/v1.

En otra terminal:

```bash
cd frontend
cp .env.example .env.local
npm ci
npm run dev -- --hostname 127.0.0.1 --port 3000
```

Interfaz: http://127.0.0.1:3000. La variable correcta es `NEXT_PUBLIC_API_BASE_URL`. `NEXT_PUBLIC_PROVIDER_TZ` debe coincidir con `PROVIDER_TIMEZONE` del backend; ambas usan America/Bogota por defecto.

El barbero se crea con PROVIDER_EMAIL y PROVIDER_PASSWORD de .env. El seed es idempotente y no cambia credenciales de usuarios ya existentes. Los clientes se registran desde /register. La base comienza sin horarios ni citas: el barbero debe guardar su disponibilidad antes de que aparezcan turnos.

## Reglas de reservas

Las fechas de citas y filtros deben incluir zona horaria. Se almacenan como TIMESTAMPTZ y los horarios semanales se interpretan en la zona del barbero. Una cita debe empezar en el futuro, terminar después de empezar y mantenerse en un mismo día local, dentro de un bloque de disponibilidad.

Los intervalos usan [inicio, fin): las citas contiguas están permitidas. Pending y confirmed bloquean horarios; canceled los libera. El cliente solo cancela o reprograma pending. El barbero confirma pending y cancela pending/confirmed. Los cambios de horario semanal afectan nuevas reservas; no cancelan ni mueven citas ya aceptadas.

La migración `9c3e71a2b640` añade una restricción de exclusión. Si hay reservas activas superpuestas previas, falla sin borrarlas: deben revisarse antes de reintentar. Las operaciones de agenda se serializan por transacción para el único proveedor del MVP.

Las contraseñas admiten al menos 8 caracteres y hasta 72 bytes UTF-8, incluyendo caracteres acentuados; las entradas inválidas devuelven 422.

## Verificación

Las pruebas exigen una base PostgreSQL **desechable** terminada en `_test`. Limpian sus tablas entre casos. Nunca uses la base de la aplicación.

```bash
TEST_DATABASE_URL=postgresql+psycopg://usuario:clave@127.0.0.1:5432/reserves_test uv run python -m pytest -q
cd frontend
npx tsc --noEmit
npm run build
```

La suite cubre registro/login, roles y propiedad, disponibilidad, filtros, estados, fechas, cancelaciones, reprogramación y dos solicitudes simultáneas; también prueba la restricción de PostgreSQL sin pasar por el servicio. GitHub Actions ejecuta pruebas y compilación en cada push/pull request.

## Licencia

MIT. Autor: Ticonsky.
