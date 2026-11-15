"""Weekly availability and future, unoccupied booking slots."""

from collections import defaultdict
from datetime import date as Date, datetime, timedelta, timezone
from uuid import UUID
from zoneinfo import ZoneInfo
from sqlalchemy.orm import Session
from app.models.availability import Availability
from app.repositories.availability_repo import (
    delete_all_availability,
    bulk_create_availability,
    list_availability,
)
from app.repositories.appointment_repo import (
    find_overlapping_appointments,
    lock_schedule,
)


class AvailabilityOverlapError(ValueError):
    pass


def replace_availability(db: Session, *, blocks_in: list[dict]) -> list[Availability]:
    by_day = defaultdict(list)
    for b in blocks_in:
        by_day[b["weekday"]].append((b["start_time"], b["end_time"]))
    for weekday, blocks in by_day.items():
        blocks.sort()
        if any(a[1] > b[0] for a, b in zip(blocks, blocks[1:])):
            raise AvailabilityOverlapError(f"OVERLAP_IN_WEEKDAY_{weekday}")
    lock_schedule(db)
    rows = [Availability(**b, is_active=True) for b in blocks_in]
    delete_all_availability(db)
    bulk_create_availability(db, rows)
    db.commit()
    return rows


def generate_slots_for_date(
    db: Session,
    *,
    date: Date,
    slot_minutes: int = 30,
    tz_name: str = "America/Bogota",
    exclude_appointment_id: UUID | None = None,
) -> list[dict]:
    if not 5 <= slot_minutes <= 240:
        raise ValueError("INVALID_SLOT_MINUTES")
    zone = ZoneInfo(tz_name)
    start_day = datetime.combine(date, datetime.min.time(), zone)
    end_day = datetime.combine(date + timedelta(days=1), datetime.min.time(), zone)
    now = datetime.now(timezone.utc)
    if end_day <= now:
        return []
    occupied = find_overlapping_appointments(
        db,
        start_at=start_day,
        end_at=end_day,
        exclude_appointment_id=exclude_appointment_id,
    )
    blocks = [
        b for b in list_availability(db) if b.is_active and b.weekday == date.weekday()
    ]
    delta = timedelta(minutes=slot_minutes)
    results = []
    for b in blocks:
        current = datetime.combine(date, b.start_time, zone).astimezone(timezone.utc)
        stop = datetime.combine(date, b.end_time, zone).astimezone(timezone.utc)
        while current + delta <= stop:
            end = current + delta
            if current > now and not any(
                a.start_at < end and current < a.end_at for a in occupied
            ):
                results.append(
                    {
                        "start_at": current.isoformat().replace("+00:00", "Z"),
                        "end_at": end.isoformat().replace("+00:00", "Z"),
                    }
                )
            current = end
    return sorted(results, key=lambda s: s["start_at"])
