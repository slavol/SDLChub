"""Add calendar events

Revision ID: 2b7c8d9e0f1a
Revises: 1a2b3c4d5e6f
Create Date: 2026-05-15 19:20:00.000000

"""
from typing import Sequence, Union

from alembic import op
import sqlalchemy as sa


revision: str = "2b7c8d9e0f1a"
down_revision: Union[str, Sequence[str], None] = "1a2b3c4d5e6f"
branch_labels: Union[str, Sequence[str], None] = None
depends_on: Union[str, Sequence[str], None] = None


def upgrade() -> None:
    op.create_table(
        "calendar_events",
        sa.Column("id", sa.Integer(), nullable=False),
        sa.Column("project_id", sa.Integer(), nullable=True),
        sa.Column("title", sa.String(), nullable=False),
        sa.Column("description", sa.Text(), nullable=True),
        sa.Column("event_type", sa.String(), nullable=True),
        sa.Column("starts_at", sa.DateTime(), nullable=False),
        sa.Column("ends_at", sa.DateTime(), nullable=False),
        sa.Column("location", sa.String(), nullable=True),
        sa.Column("meeting_url", sa.String(), nullable=True),
        sa.Column("attendee_ids", sa.Text(), nullable=True),
        sa.Column("created_by_id", sa.Integer(), nullable=True),
        sa.Column("created_at", sa.DateTime(timezone=True), server_default=sa.text("now()"), nullable=True),
        sa.Column("updated_at", sa.DateTime(timezone=True), nullable=True),
        sa.ForeignKeyConstraint(["created_by_id"], ["users.id"]),
        sa.ForeignKeyConstraint(["project_id"], ["projects.id"]),
        sa.PrimaryKeyConstraint("id"),
    )
    op.create_index(op.f("ix_calendar_events_id"), "calendar_events", ["id"], unique=False)


def downgrade() -> None:
    op.drop_index(op.f("ix_calendar_events_id"), table_name="calendar_events")
    op.drop_table("calendar_events")
