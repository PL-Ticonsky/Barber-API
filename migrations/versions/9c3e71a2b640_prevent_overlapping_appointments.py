"""Reject overlapping active bookings, including concurrent direct database writes.

Revision ID: 9c3e71a2b640
Revises: 47712eb05cf0
"""

from alembic import op

revision = "9c3e71a2b640"
down_revision = "47712eb05cf0"
branch_labels = None
depends_on = None


def upgrade():
    # Existing conflicts cause a safe migration failure; never delete bookings implicitly.
    op.execute("""ALTER TABLE appointments ADD CONSTRAINT ex_appointments_no_overlap
        EXCLUDE USING gist (tstzrange(start_at, end_at, '[)') WITH &&)
        WHERE (status IN ('pending', 'confirmed'))""")


def downgrade():
    op.drop_constraint("ex_appointments_no_overlap", "appointments")
