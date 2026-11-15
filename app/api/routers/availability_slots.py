"""Available future slots; rescheduling may exclude only the client's own pending booking."""

from datetime import date as Date
from uuid import UUID
from fastapi import APIRouter, Depends, HTTPException, Query
from sqlalchemy.orm import Session
from app.api.deps import require_client
from app.db.session import get_db
from app.core.config import settings
from app.models.appointment import AppointmentStatus
from app.repositories.appointment_repo import get_appointment_by_id_for_client
from app.services.availability_service import generate_slots_for_date

router = APIRouter(prefix="/availability", tags=["availability"])


@router.get("/slots")
def get_availability_slots(
    date: Date,
    slot_minutes: int = Query(30, ge=5, le=240),
    exclude_appointment_id: UUID | None = None,
    db: Session = Depends(get_db),
    client=Depends(require_client),
):
    if exclude_appointment_id is not None:
        appt = get_appointment_by_id_for_client(db, exclude_appointment_id, client.id)
        if appt is None:
            raise HTTPException(404, "APPOINTMENT_NOT_FOUND")
        if appt.status != AppointmentStatus.pending:
            raise HTTPException(400, "INVALID_STATUS_TRANSITION")
    return generate_slots_for_date(
        db,
        date=date,
        slot_minutes=slot_minutes,
        tz_name=settings.provider_timezone,
        exclude_appointment_id=exclude_appointment_id,
    )
