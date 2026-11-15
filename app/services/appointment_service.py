"""Booking rules for a single provider; all writes are serialized and committed here."""

from datetime import datetime, timezone
from uuid import UUID
from zoneinfo import ZoneInfo
from sqlalchemy.exc import IntegrityError
from sqlalchemy.orm import Session
from app.core.config import settings
from app.models.appointment import Appointment, AppointmentStatus
from app.repositories import appointment_repo as repo
from app.repositories.availability_repo import list_availability


class AppointmentNotFoundError(Exception):
    pass


class InvalidStatusTransitionError(Exception):
    pass


class OutsideAvailabilityError(ValueError):
    pass


class AppointmentOverlapError(ValueError):
    pass


class InvalidTimeRangeError(ValueError):
    pass


def _save(db: Session, appt: Appointment) -> Appointment:
    try:
        db.commit()
    except IntegrityError as exc:
        db.rollback()
        if getattr(exc.orig, "sqlstate", None) == "23P01":
            raise AppointmentOverlapError("APPOINTMENT_OVERLAP") from exc
        raise
    db.refresh(appt)
    return appt


def _validate_booking(
    db: Session, start_at: datetime, end_at: datetime, exclude_id: UUID | None = None
) -> None:
    if start_at.utcoffset() is None or end_at.utcoffset() is None:
        raise InvalidTimeRangeError("DATETIME_MUST_HAVE_TIMEZONE")
    if start_at >= end_at:
        raise InvalidTimeRangeError("INVALID_TIME_RANGE")
    if start_at <= datetime.now(timezone.utc):
        raise InvalidTimeRangeError("APPOINTMENT_IN_PAST")
    zone = ZoneInfo(settings.provider_timezone)
    start, end = start_at.astimezone(zone), end_at.astimezone(zone)
    if start.date() != end.date():
        raise InvalidTimeRangeError("CANNOT_CROSS_LOCAL_DAY")
    if not any(
        b.is_active
        and b.weekday == start.weekday()
        and b.start_time <= start.time()
        and end.time() <= b.end_time
        for b in list_availability(db)
    ):
        raise OutsideAvailabilityError("OUTSIDE_AVAILABILITY")
    if repo.find_overlapping_appointments(
        db, start_at=start_at, end_at=end_at, exclude_appointment_id=exclude_id
    ):
        raise AppointmentOverlapError("APPOINTMENT_OVERLAP")


def create_client_appointment(
    db: Session,
    *,
    client_id: UUID,
    start_at: datetime,
    end_at: datetime,
    description: str | None = None,
) -> Appointment:
    repo.lock_schedule(db)
    _validate_booking(db, start_at, end_at)
    return _save(
        db,
        repo.create_appointment(
            db,
            client_id=client_id,
            start_at=start_at,
            end_at=end_at,
            description=description,
        ),
    )


def _owned_pending(db: Session, client_id: UUID, appointment_id: UUID) -> Appointment:
    appt = repo.get_appointment_by_id_for_client(db, appointment_id, client_id)
    if appt is None:
        raise AppointmentNotFoundError()
    if appt.status != AppointmentStatus.pending:
        raise InvalidStatusTransitionError()
    return appt


def cancel_client_appointment(
    db: Session, client_id: UUID, appointment_id: UUID
) -> Appointment:
    repo.lock_schedule(db)
    appt = _owned_pending(db, client_id, appointment_id)
    appt.status = AppointmentStatus.canceled
    return _save(db, appt)


def reschedule_client_appointment(
    db: Session,
    *,
    client_id: UUID,
    appointment_id: UUID,
    start_at: datetime,
    end_at: datetime,
) -> Appointment:
    repo.lock_schedule(db)
    appt = _owned_pending(db, client_id, appointment_id)
    _validate_booking(db, start_at, end_at, appt.id)
    appt.start_at, appt.end_at = start_at, end_at
    return _save(db, appt)


def list_barber_appointments(
    db: Session, *, dt_from: datetime | None, dt_to: datetime | None, status: str | None
):
    if dt_from is not None and dt_to is not None and dt_from > dt_to:
        raise ValueError("INVALID_DATE_FILTER")
    try:
        status_enum = AppointmentStatus(status) if status is not None else None
    except ValueError as exc:
        raise ValueError("INVALID_STATUS_FILTER") from exc
    return repo.list_appointments(db, dt_from=dt_from, dt_to=dt_to, status=status_enum)


def confirm_appointment_as_provider(
    db: Session, *, appointment_id: UUID
) -> Appointment:
    repo.lock_schedule(db)
    appt = repo.get_appointment_by_id(db, appointment_id)
    if appt is None:
        raise AppointmentNotFoundError()
    if appt.status != AppointmentStatus.pending:
        raise InvalidStatusTransitionError()
    appt.status = AppointmentStatus.confirmed
    return _save(db, appt)


def cancel_appointment_as_provider(
    db: Session, *, appointment_id: UUID, reason: str | None
) -> Appointment:
    repo.lock_schedule(db)
    appt = repo.get_appointment_by_id(db, appointment_id)
    if appt is None:
        raise AppointmentNotFoundError()
    if appt.status == AppointmentStatus.canceled:
        raise InvalidStatusTransitionError()
    appt.status, appt.cancel_reason = AppointmentStatus.canceled, reason
    return _save(db, appt)
