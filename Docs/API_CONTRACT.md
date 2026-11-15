# Contrato HTTP — barbería de un único proveedor

Base local: `http://127.0.0.1:8000`, sin prefijo. El esquema completo y actualizado está en `/openapi.json` y `/docs`. Autenticación: `Authorization: Bearer <token>`.

## Rutas

| Método y ruta | Permiso | Respuesta correcta |
| --- | --- | --- |
| POST /auth/register | Público | 201: id, email, role=client |
| POST /auth/login | Público | 200: access_token, token_type=bearer |
| GET /me | Autenticado | 200: perfil |
| GET /availability/slots | Cliente | 200: lista de start_at/end_at |
| POST /appointments | Cliente | 200: cita pending |
| GET /me/appointments | Cliente | 200: sus citas |
| GET /me/appointments/{id} | Propietario | 200: cita |
| PATCH /me/appointments/{id}/cancel | Propietario, pending | 200: cita canceled |
| PATCH /me/appointments/{id}/reschedule | Propietario, pending | 200: cita actualizada |
| GET /barber/availability | Barbero | 200: bloques persistidos |
| POST /barber/availability/bulk | Barbero | 201: reemplazo completo de bloques |
| GET /barber/appointments | Barbero | 200: citas filtradas |
| PATCH /barber/appointments/{id}/confirm | Barbero, pending | 200: cita confirmed |
| PATCH /barber/appointments/{id}/cancel | Barbero, pending/confirmed | 200: cita canceled |

## Entradas

Registro/login: `{ "email": "client@example.com", "password": "StrongPass123!" }`. Contraseñas: mínimo 8 caracteres, máximo 72 bytes UTF-8. Email validado.

Crear: start_at y end_at en ISO 8601 con offset; description opcional, máximo 500 caracteres. Reprogramar: start_at y end_at con las mismas restricciones. Inicio futuro, orden temporal válido, mismo día en zona del proveedor y cobertura de un bloque semanal. La duración puede variar; slot_minutes controla las opciones ofrecidas, no fija la duración admitida por POST.

Slots: `date=YYYY-MM-DD` obligatorio, `slot_minutes=30` por defecto, rango 5–240. Excluye horas pasadas y citas pending/confirmed. `exclude_appointment_id` opcional permite reprogramar excluyendo únicamente la propia cita pending; nunca una cita ajena. Fechas sin disponibilidad devuelven [].

Horarios: array de `{ "weekday": 0, "start_time": "09:00", "end_time": "18:00" }`; 0=lunes, 6=domingo. Horas locales sin offset. Sin solapamiento de bloques del mismo día. Array vacío elimina todos los bloques. La lectura añade id e is_active. Cambiar horarios no modifica reservas ya creadas.

Filtro de barbero: `from` y `to`, opcionales, timestamps con offset; límites inclusivos sobre inicio y fin de la cita, respectivamente. `from <= to`. `status_` opcional: pending, confirmed o canceled. La interfaz convierte los días elegidos al inicio/final del día en la zona del barbero. El listado personal no acepta filtros.

Cancelación del barbero: body opcional `{ "reason": "Closed today" }`, máximo 500 caracteres. La respuesta de cita incluye cancel_reason, además de id, client_id, start_at, end_at, status, description, created_at y updated_at.

## Errores

Errores de negocio: `{ "detail": "CODIGO" }`. Errores de validación Pydantic: `{ "detail": [{ "loc": [...], "msg": "...", "type": "..." }] }`.

- 401: token ausente/inválido/expirado o credenciales incorrectas.
- 403: rol incorrecto, usuario inactivo o consulta individual de cita ajena.
- 404: cita inexistente; modificar una cita ajena también devuelve 404.
- 400 INVALID_STATUS_TRANSITION: operación no admitida en el estado actual.
- 409 EMAIL_ALREADY_EXISTS o APPOINTMENT_OVERLAP.
- 422: formato/límites de entrada, INVALID_DATE_FILTER, INVALID_STATUS_FILTER, APPOINTMENT_IN_PAST, CANNOT_CROSS_LOCAL_DAY, OUTSIDE_AVAILABILITY o bloques semanales superpuestos.

Dos reservas concurrentes para el mismo intervalo no pueden persistir ambas. El intervalo es semiabierto [inicio, fin), por lo que reservas contiguas son válidas. Los roles y la propiedad se verifican en el backend.
