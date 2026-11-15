from concurrent.futures import ThreadPoolExecutor
from datetime import timedelta, datetime, timezone
from threading import Barrier
from uuid import uuid4

import pytest
from sqlalchemy import text
from sqlalchemy.exc import IntegrityError
from app.db.session import engine
from app.schemas.appointment import AppointmentCreateIn
from app.schemas.auth import RegisterRequest
from app.core.security import create_access_token


def payload(s, offset=0):
    start = s["start"] + timedelta(minutes=offset)
    return {
        "start_at": start.isoformat(),
        "end_at": (start + timedelta(minutes=30)).isoformat(),
        "description": "Test booking",
    }


def create(s, offset=0, headers=None):
    return s["api"].post(
        "/appointments", json=payload(s, offset), headers=headers or s["client"]
    )


def slots(s, **extra):
    return s["api"].get(
        "/availability/slots", params={"date": s["day"], **extra}, headers=s["client"]
    )


def test_complete_client_provider_flow(setup):
    s = setup
    api = s["api"]
    initial = len(slots(s).json())
    created = create(s)
    assert created.status_code == 200
    id = created.json()["id"]
    assert len(slots(s).json()) == initial - 1
    assert create(s).status_code == 409
    assert len(slots(s, exclude_appointment_id=id).json()) == initial
    moved = api.patch(
        f"/me/appointments/{id}/reschedule", json=payload(s, 30), headers=s["client"]
    )
    assert moved.status_code == 200
    assert (
        api.patch(f"/barber/appointments/{id}/confirm", headers=s["provider"]).json()[
            "status"
        ]
        == "confirmed"
    )
    assert (
        api.patch(f"/me/appointments/{id}/cancel", headers=s["client"]).status_code
        == 400
    )
    assert (
        api.patch(
            f"/me/appointments/{id}/reschedule",
            json=payload(s, 60),
            headers=s["client"],
        ).status_code
        == 400
    )
    canceled = api.patch(
        f"/barber/appointments/{id}/cancel",
        json={"reason": "Closed today"},
        headers=s["provider"],
    )
    assert canceled.json()["cancel_reason"] == "Closed today"
    assert (
        api.get(f"/me/appointments/{id}", headers=s["client"]).json()["cancel_reason"]
        == "Closed today"
    )
    assert len(slots(s).json()) == initial


def test_client_can_cancel_pending_only(setup):
    s = setup
    id = create(s).json()["id"]
    response = s["api"].patch(f"/me/appointments/{id}/cancel", headers=s["client"])
    assert response.status_code == 200 and response.json()["status"] == "canceled"
    assert (
        s["api"].patch(f"/me/appointments/{id}/cancel", headers=s["client"]).status_code
        == 400
    )
    assert create(s).status_code == 200


def test_access_control(setup):
    s = setup
    api = s["api"]
    id = create(s).json()["id"]
    assert api.get("/me/appointments").status_code == 401
    assert api.get("/barber/availability", headers=s["client"]).status_code == 403
    assert (
        api.get(
            "/availability/slots", params={"date": s["day"]}, headers=s["provider"]
        ).status_code
        == 403
    )
    assert (
        api.patch(f"/me/appointments/{id}/cancel", headers=s["other"]).status_code
        == 404
    )
    assert (
        api.get(
            "/availability/slots",
            params={"date": s["day"], "exclude_appointment_id": id},
            headers=s["other"],
        ).status_code
        == 404
    )
    assert api.get("/me/appointments", headers=s["other"]).json() == []


@pytest.mark.parametrize(
    "start,end",
    [
        ("2030-01-01T09:00:00", "2030-01-01T10:00:00-05:00"),
        ("2030-01-01T09:00:00-05:00", "2030-01-01T10:00:00"),
        ("2030-01-01T09:00:00", "2030-01-01T10:00:00"),
        ("2030-01-01T10:00:00-05:00", "2030-01-01T09:00:00-05:00"),
    ],
)
def test_invalid_datetimes_are_422(setup, start, end):
    s = setup
    assert (
        s["api"]
        .post(
            "/appointments",
            json={"start_at": start, "end_at": end},
            headers=s["client"],
        )
        .status_code
        == 422
    )
    id = create(s).json()["id"]
    assert (
        s["api"]
        .patch(
            f"/me/appointments/{id}/reschedule",
            json={"start_at": start, "end_at": end},
            headers=s["client"],
        )
        .status_code
        == 422
    )


def test_past_cross_day_and_outside_hours(setup):
    s = setup
    api = s["api"]
    past = s["start"] - timedelta(days=10)
    for start, end, code in [
        (past, past + timedelta(minutes=30), "APPOINTMENT_IN_PAST"),
        (s["start"], s["start"] + timedelta(days=1), "CANNOT_CROSS_LOCAL_DAY"),
        (s["start"] - timedelta(hours=1), s["start"], "OUTSIDE_AVAILABILITY"),
    ]:
        r = api.post(
            "/appointments",
            json={"start_at": start.isoformat(), "end_at": end.isoformat()},
            headers=s["client"],
        )
        assert r.status_code == 422 and r.json()["detail"] == code
    assert (
        api.get(
            "/availability/slots",
            params={"date": past.date().isoformat()},
            headers=s["client"],
        ).json()
        == []
    )
    today = datetime.now(timezone.utc)
    result = api.get(
        "/availability/slots",
        params={"date": today.date().isoformat()},
        headers=s["client"],
    ).json()
    assert all(datetime.fromisoformat(slot["start_at"]) > today for slot in result)


def test_availability_round_trip_and_validation(setup):
    s = setup
    api = s["api"]
    blocks = [{"weekday": 0, "start_time": "10:00", "end_time": "12:00"}]
    assert (
        api.post(
            "/barber/availability/bulk", json=blocks, headers=s["provider"]
        ).status_code
        == 201
    )
    result = api.get("/barber/availability", headers=s["provider"]).json()
    assert len(result) == 1 and result[0]["start_time"] == "10:00:00"
    assert (
        api.post(
            "/barber/availability/bulk", json=blocks * 2, headers=s["provider"]
        ).status_code
        == 422
    )
    assert len(api.get("/barber/availability", headers=s["provider"]).json()) == 1
    blocks[0]["end_time"] = "12:00:00+00:00"
    assert (
        api.post(
            "/barber/availability/bulk", json=blocks, headers=s["provider"]
        ).status_code
        == 422
    )
    assert (
        api.post(
            "/barber/availability/bulk", json=[], headers=s["provider"]
        ).status_code
        == 201
    )
    assert slots(s).json() == []


def test_date_filters(setup):
    s = setup
    api = s["api"]
    create(s)
    create(s, 60)
    r = api.get(
        "/barber/appointments",
        headers=s["provider"],
        params={"from": (s["start"] + timedelta(minutes=30)).isoformat()},
    )
    assert r.status_code == 200 and len(r.json()) == 1
    r = api.get(
        "/barber/appointments",
        headers=s["provider"],
        params={"to": (s["start"] + timedelta(minutes=30)).isoformat()},
    )
    assert len(r.json()) == 1
    assert (
        api.get(
            "/barber/appointments", headers=s["provider"], params={"from": s["day"]}
        ).status_code
        == 422
    )
    assert (
        api.get(
            "/barber/appointments",
            headers=s["provider"],
            params={
                "from": (s["start"] + timedelta(days=1)).isoformat(),
                "to": s["start"].isoformat(),
            },
        ).status_code
        == 422
    )
    assert (
        api.get(
            "/barber/appointments", headers=s["provider"], params={"status_": "bad"}
        ).status_code
        == 422
    )


def test_simultaneous_api_booking(setup):
    s = setup
    barrier = Barrier(2)

    def book(_):
        barrier.wait()
        return create(s).status_code

    with ThreadPoolExecutor(max_workers=2) as pool:
        results = list(pool.map(book, range(2)))
    assert sorted(results) == [200, 409]
    assert len(s["api"].get("/me/appointments", headers=s["client"]).json()) == 1


def test_database_alone_prevents_concurrent_overlap(setup):
    s = setup
    barrier = Barrier(2)

    def insert(_):
        barrier.wait()
        try:
            with engine.begin() as conn:
                conn.execute(
                    text(
                        "INSERT INTO appointments (id,client_id,start_at,end_at) VALUES (:id,:client,:start,:end)"
                    ),
                    {
                        "id": uuid4(),
                        "client": s["client_id"],
                        "start": s["start"],
                        "end": s["start"] + timedelta(minutes=30),
                    },
                )
            return "saved"
        except IntegrityError as exc:
            return exc.orig.sqlstate

    with ThreadPoolExecutor(max_workers=2) as pool:
        result = list(pool.map(insert, range(2)))
    assert sorted(result) == ["23P01", "saved"]
    assert create(s, 30).status_code == 200  # Adjacent slots do not overlap.


def test_reschedule_conflict_keeps_original(setup):
    s = setup
    first = create(s).json()
    create(s, 60)
    response = s["api"].patch(
        f"/me/appointments/{first['id']}/reschedule",
        json=payload(s, 60),
        headers=s["client"],
    )
    assert response.status_code == 409
    assert (
        s["api"]
        .get(f"/me/appointments/{first['id']}", headers=s["client"])
        .json()["start_at"]
        == first["start_at"]
    )


@pytest.mark.parametrize("password", ["a" * 73, "á" * 37, "short"])
def test_password_limits_are_422(api, password):
    for path in ["/auth/register", "/auth/login"]:
        assert (
            api.post(
                path, json={"email": "test@example.com", "password": password}
            ).status_code
            == 422
        )


def test_register_login_and_duplicate(api):
    credentials = {"email": "new@example.com", "password": "á" * 36}
    assert api.post("/auth/register", json=credentials).status_code == 201
    assert api.post("/auth/register", json=credentials).status_code == 409
    response = api.post("/auth/login", json=credentials)
    assert response.status_code == 200
    assert (
        api.get(
            "/me",
            headers={"Authorization": "Bearer " + response.json()["access_token"]},
        ).json()["role"]
        == "client"
    )
    assert (
        api.post(
            "/auth/login", json={**credentials, "password": "Incorrect123!"}
        ).status_code
        == 401
    )


def test_simultaneous_status_changes(setup):
    s = setup
    id = create(s).json()["id"]
    barrier = Barrier(2)

    def change(action):
        barrier.wait()
        path, headers = (
            (f"/me/appointments/{id}/cancel", s["client"])
            if action == "cancel"
            else (f"/barber/appointments/{id}/confirm", s["provider"])
        )
        return s["api"].patch(path, headers=headers).status_code

    with ThreadPoolExecutor(max_workers=2) as pool:
        result = list(pool.map(change, ["cancel", "confirm"]))
    assert sorted(result) == [200, 400]
