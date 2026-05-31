"""Add calendar availability blocks

Revision ID: f8a9b0c1d2e3
Revises: e7f8a9b0c1d2
Create Date: 2026-05-31
"""

from typing import Sequence, Union

from alembic import op
import sqlalchemy as sa


revision: str = "f8a9b0c1d2e3"
down_revision: Union[str, None] = "e7f8a9b0c1d2"
branch_labels: Union[str, Sequence[str], None] = None
depends_on: Union[str, Sequence[str], None] = None


def upgrade() -> None:
    op.create_table(
        "calendar_availability",
        sa.Column("id", sa.Integer(), nullable=False),
        sa.Column("project_id", sa.Integer(), nullable=False),
        sa.Column("user_id", sa.Integer(), nullable=False),
        sa.Column("created_by_id", sa.Integer(), nullable=False),
        sa.Column("status", sa.String(), nullable=False, server_default="VACATION"),
        sa.Column("title", sa.String(), nullable=True),
        sa.Column("starts_at", sa.DateTime(), nullable=False),
        sa.Column("ends_at", sa.DateTime(), nullable=False),
        sa.Column("all_day", sa.Boolean(), nullable=False, server_default=sa.true()),
        sa.Column("note", sa.Text(), nullable=True),
        sa.Column("created_at", sa.DateTime(timezone=True), server_default=sa.text("now()"), nullable=True),
        sa.Column("updated_at", sa.DateTime(timezone=True), nullable=True),
        sa.ForeignKeyConstraint(["created_by_id"], ["users.id"]),
        sa.ForeignKeyConstraint(["project_id"], ["projects.id"]),
        sa.ForeignKeyConstraint(["user_id"], ["users.id"]),
        sa.PrimaryKeyConstraint("id"),
    )
    op.create_index(op.f("ix_calendar_availability_id"), "calendar_availability", ["id"], unique=False)
    op.create_index(op.f("ix_calendar_availability_project_id"), "calendar_availability", ["project_id"], unique=False)
    op.create_index(op.f("ix_calendar_availability_user_id"), "calendar_availability", ["user_id"], unique=False)
    op.create_index("ix_calendar_availability_project_time", "calendar_availability", ["project_id", "starts_at", "ends_at"], unique=False)


def downgrade() -> None:
    op.drop_index("ix_calendar_availability_project_time", table_name="calendar_availability")
    op.drop_index(op.f("ix_calendar_availability_user_id"), table_name="calendar_availability")
    op.drop_index(op.f("ix_calendar_availability_project_id"), table_name="calendar_availability")
    op.drop_index(op.f("ix_calendar_availability_id"), table_name="calendar_availability")
    op.drop_table("calendar_availability")
