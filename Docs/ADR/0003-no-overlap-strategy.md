# ADR 0003 — Prevención de reservas superpuestas

Estado: implementado para un único proveedor.

El servicio valida los intervalos para devolver errores claros. PostgreSQL añade la garantía final con `ex_appointments_no_overlap`: exclusión GiST sobre `tstzrange(start_at, end_at, '[)')` para estados pending/confirmed. No requiere btree_gist porque solo compara rangos temporales.

Los cambios de agenda adquieren `pg_advisory_xact_lock(74201926)` antes de leer/validar/escribir, y lo liberan al terminar la transacción. Esto serializa transiciones de estado y cambios de disponibilidad para el MVP de un único proveedor. Las colisiones de la restricción se traducen a 409 y se revierte la transacción. La restricción también protege escrituras directas que no usen ese bloqueo.

La migración no elimina conflictos históricos: si existen, debe revisarlos una persona antes de aplicar la restricción. La suite prueba solicitudes HTTP simultáneas y escrituras concurrentes directas. Si se agrega soporte para varios proveedores, tanto el bloqueo como la exclusión deberán incluir su identidad.
