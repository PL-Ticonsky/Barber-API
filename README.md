# La Buena Tijera · **Reservas online para una barbería clásica.** Los clientes eligen su cita y el barbero organiza su agenda desde un panel propio.

[![FastAPI](https://img.shields.io/badge/FastAPI-009688?logo=fastapi&logoColor=white)](https://fastapi.tiangolo.com/)
[![Next.js](https://img.shields.io/badge/Next.js-171717?logo=nextdotjs&logoColor=white)](https://nextjs.org/)
[![PostgreSQL](https://img.shields.io/badge/PostgreSQL-4169E1?logo=postgresql&logoColor=white)](https://www.postgresql.org/)
[![GitHub Actions](https://github.com/PL-Ticonsky/Reserves_API_FastAPI/actions/workflows/verify.yml/badge.svg?branch=main)](https://github.com/PL-Ticonsky/Reserves_API_FastAPI/actions/workflows/verify.yml)
[![Licencia MIT](https://img.shields.io/badge/Licencia-MIT-E8B94F)](LICENSE)

[Inicio local](#inicio-local) · [Contrato de API](Docs/API_CONTRACT.md) · [Arquitectura](Docs/ARQUITECTURE.md)

## Vista previa

![Portada de La Buena Tijera con la navegación, el botón de reservas y una fotografía de la barbería](Docs/assets/frontend/la-buena-tijera.png)

## Cómo se usa

| Cliente | Barbero |
| --- | --- |
| Crea una cuenta y consulta los turnos libres. | Define los bloques de atención de cada día. |
| Solicita una cita y consulta su estado en **Mis citas**. | Filtra la agenda y confirma las solicitudes. |
| Cambia el horario o cancela mientras la cita esté pendiente. | Cancela citas e indica el motivo si lo necesita. |

## Qué resuelve el sistema

- **Disponibilidad real.** La agenda descuenta los horarios de citas pendientes y confirmadas.
- **Reservas sin solapamientos.** PostgreSQL impide que se ocupen dos veces los mismos minutos, incluso con solicitudes simultáneas.
- **Acceso por rol.** El cliente consulta sus propias citas y el barbero gestiona la agenda.

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

## Cómo se gestiona una cita

La disponibilidad semanal y las citas activas determinan qué horarios puede elegir el cliente.

```mermaid
flowchart LR
    A["Cliente · elige un turno"] --> B["FastAPI · recibe la solicitud"]
    B --> C["PostgreSQL · evita solapamientos"]
    C --> D["Cita pendiente"]
    D --> E["Barbero · confirma o cancela"]
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
