"""Integration tests require an explicit, disposable PostgreSQL database ending in _test."""

import os
from datetime import datetime, timedelta
from zoneinfo import ZoneInfo

import pytest
from sqlalchemy.engine import make_url

url = os.environ.get("TEST_DATABASE_URL")
if not url or not (make_url(url).database or "").endswith("_test"):
    raise RuntimeError("Set TEST_DATABASE_URL to a disposable database ending in _test")
os.environ["DATABASE_URL"] = url
os.environ["JWT_SECRET"] = "integration-test-secret-with-at-least-32-bytes"
os.environ["PROVIDER_TIMEZONE"] = "America/Bogota"

from alembic import command
from alembic.config import Config
from fastapi.testclient import TestClient
from sqlalchemy import text
from app.main import app
from app.db.session import engine, SessionLocal
from app.models.user import User, UserRole
from app.models.availability import Availability
from app.core.security import hash_password, create_access_token


@pytest.fixture(scope="session", autouse=True)
def migrated_database():
    command.upgrade(Config("alembic.ini"), "head")
    yield
    engine.dispose()


@pytest.fixture
def api():
    with engine.begin() as c:
        c.execute(text("TRUNCATE appointments, provider_availability, users CASCADE"))
    with TestClient(app) as client:
        yield client


@pytest.fixture
def setup(api):
    day = (datetime.now(ZoneInfo("America/Bogota")) + timedelta(days=7)).date()
    start = datetime.combine(
        day, datetime.min.time(), ZoneInfo("America/Bogota")
    ).replace(hour=9)
    with SessionLocal() as db:
        users = [
            User(
                email=f"{role}{i}@example.com",
                password_hash=hash_password("TestPass123!"),
                role=role,
            )
            for i, role in enumerate(
                [UserRole.provider, UserRole.client, UserRole.client]
            )
        ]
        db.add_all(users)
        for weekday in range(7):
            db.add(
                Availability(
                    weekday=weekday,
                    start_time=datetime.min.time().replace(hour=9),
                    end_time=datetime.min.time().replace(hour=18),
                    is_active=True,
                )
            )
        db.commit()
        ids = [str(u.id) for u in users]
        headers = [
            {
                "Authorization": "Bearer "
                + create_access_token(user_id=str(u.id), role=u.role.value)
            }
            for u in users
        ]
    return {
        "api": api,
        "provider": headers[0],
        "client": headers[1],
        "other": headers[2],
        "client_id": ids[1],
        "start": start,
        "day": day.isoformat(),
    }
