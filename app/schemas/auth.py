"""

Purpose:
- Pydantic schemas for authentication endpoints.
- Define request/response shapes for /auth/register and /auth/login.

Why schemas exist:
- They validate user input (types, constraints).
- They control what fields are exposed in API responses.
- They decouple API contract from database models.
"""

from __future__ import annotations

from pydantic import BaseModel, EmailStr, Field, field_validator


class Credentials(BaseModel):
    email: EmailStr
    password: str = Field(min_length=8, max_length=72)

    @field_validator("password")
    @classmethod
    def password_bytes(cls, value: str) -> str:
        if len(value.encode("utf-8")) > 72:
            raise ValueError("Password must not exceed 72 UTF-8 bytes")
        return value


# ---------------------------
# Register
# ---------------------------


class RegisterRequest(Credentials):
    """
    Body for POST /auth/register

    Notes:
    - Email is validated using EmailStr.
    - Password constraints here are basic; we enforce stronger rules in services if needed.
    """

    email: EmailStr
    password: str = Field(min_length=8, max_length=72)


class RegisterResponse(BaseModel):
    """
    Response for POST /auth/register
    """

    id: str
    email: EmailStr
    role: str


# ---------------------------
# Login
# ---------------------------


class LoginRequest(Credentials):
    """
    Body for POST /auth/login
    """

    email: EmailStr
    password: str = Field(min_length=8, max_length=72)


class TokenResponse(BaseModel):
    """
    Response for POST /auth/login
    """

    access_token: str
    token_type: str = "bearer"
