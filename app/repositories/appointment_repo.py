"""Persistence for appointments. Services own transactions and state transitions."""

from datetime import datetime
from uuid import UUID
from sqlalchemy import select, text
from sqlalchemy.orm import Session
from app.models.appointment import Appointment, AppointmentStatus


def lock_schedule(db: Session) -> None:
    # One provider: serialize schedule changes and status transitions until commit.
    db.execute(text("SELECT pg_advisory_xact_lock(74201926)"))


def create_appointment(
    db: Session,
    *,
    client_id: UUID,
    start_at: datetime,
    end_at: datetime,
    description: str | None = None,
) -> Appointment:
    appt = Appointment(
        client_id=client_id,
        start_at=start_at,
        end_at=end_at,
        description=description,
        status=AppointmentStatus.pending,
    )
    db.add(appt)
    return appt


def get_appointment_by_id(db: Session, appointment_id: UUID) -> Appointment | None:
    return db.scalar(
        select(Appointment)
        .where(Appointment.id == appointment_id)
        .execution_options(populate_existing=True)
    )


def get_appointment_by_id_for_client(
    db: Session, appointment_id: UUID, client_id: UUID
) -> Appointment | None:
    return db.scalar(
        select(Appointment)
        .where(Appointment.id == appointment_id, Appointment.client_id == client_id)
        .execution_options(populate_existing=True)
    )


def list_appointments(
    db: Session,
    *,
    dt_from: datetime | None = None,
    dt_to: datetime | None = None,
    status: AppointmentStatus | None = None,
) -> list[Appointment]:
    stmt = select(Appointment)
    if dt_from is not None:
        stmt = stmt.where(Appointment.start_at >= dt_from)
    if dt_to is not None:
        stmt = stmt.where(Appointment.end_at <= dt_to)
    if status is not None:
        stmt = stmt.where(Appointment.status == status)
    return list(db.scalars(stmt.order_by(Appointment.start_at, Appointment.id)))


def list_appointments_for_client(db: Session, *, client_id: UUID) -> list[Appointment]:
    return list(
        db.scalars(
            select(Appointment)
            .where(Appointment.client_id == client_id)
            .order_by(Appointment.start_at, Appointment.id)
        )
    )


def find_overlapping_appointments(
    db: Session,
    *,
    start_at: datetime,
    end_at: datetime,
    exclude_appointment_id: UUID | None = None,
) -> list[Appointment]:
    stmt = select(Appointment).where(
        Appointment.status.in_(
            [AppointmentStatus.pending, AppointmentStatus.confirmed]
        ),
        Appointment.start_at < end_at,
        start_at < Appointment.end_at,
    )
    if exclude_appointment_id is not None:
        stmt = stmt.where(Appointment.id != exclude_appointment_id)
    return list(db.scalars(stmt))
