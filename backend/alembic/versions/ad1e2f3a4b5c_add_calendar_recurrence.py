"""Add calendar recurrence metadata

Revision ID: ad1e2f3a4b5c
Revises: 9c0d1e2f3a4b
Create Date: 2026-05-29 00:00:00.000000

"""
from typing import Sequence, Union

from alembic import op
import sqlalchemy as sa


revision: str = "ad1e2f3a4b5c"
down_revision: Union[str, Sequence[str], None] = "9c0d1e2f3a4b"
branch_labels: Union[str, Sequence[str], None] = None
depends_on: Union[str, Sequence[str], None] = None


def upgrade() -> None:
    op.add_column("calendar_events", sa.Column("recurrence_series_id", sa.String(), nullable=True))
    op.add_column("calendar_events", sa.Column("recurrence_mode", sa.String(), nullable=True, server_default="none"))
    op.add_column("calendar_events", sa.Column("recurrence_until", sa.DateTime(), nullable=True))
    op.create_index("ix_calendar_events_recurrence_series_id", "calendar_events", ["recurrence_series_id"], unique=False)


def downgrade() -> None:
    op.drop_index("ix_calendar_events_recurrence_series_id", table_name="calendar_events")
    op.drop_column("calendar_events", "recurrence_until")
    op.drop_column("calendar_events", "recurrence_mode")
    op.drop_column("calendar_events", "recurrence_series_id")
