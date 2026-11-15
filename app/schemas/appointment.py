"""Timezone-aware request contracts and appointment responses."""

from datetime import datetime
from typing import Self
from uuid import UUID
from pydantic import AwareDatetime, BaseModel, ConfigDict, Field, model_validator
from app.models.appointment import AppointmentStatus


class AppointmentRescheduleIn(BaseModel):
    start_at: AwareDatetime
    end_at: AwareDatetime

    @model_validator(mode="after")
    def validate_time_order(self) -> Self:
        if self.start_at >= self.end_at:
            raise ValueError("start_at must be < end_at")
        return self


class AppointmentCreateIn(AppointmentRescheduleIn):
    description: str | None = Field(default=None, max_length=500)


class AppointmentOut(BaseModel):
    id: UUID
    client_id: UUID
    start_at: datetime
    end_at: datetime
    status: AppointmentStatus
    description: str | None = None
    cancel_reason: str | None = None
    created_at: datetime
    updated_at: datetime
    model_config = ConfigDict(from_attributes=True)


class AppointmentCancelIn(BaseModel):
    reason: str | None = Field(default=None, max_length=500)
