"""Add GitHub events table

Revision ID: 8b9c0d1e2f3a
Revises: 7a8b9c0d1e2f
Create Date: 2026-05-19 02:05:00
"""

from typing import Sequence, Union

import sqlalchemy as sa
from alembic import op


revision: str = "8b9c0d1e2f3a"
down_revision: Union[str, Sequence[str], None] = "7a8b9c0d1e2f"
branch_labels: Union[str, Sequence[str], None] = None
depends_on: Union[str, Sequence[str], None] = None


def upgrade() -> None:
    op.create_table(
        "github_events",
        sa.Column("id", sa.Integer(), nullable=False),
        sa.Column("delivery_id", sa.String(), nullable=True),
        sa.Column("project_id", sa.Integer(), nullable=True),
        sa.Column("task_id", sa.Integer(), nullable=True),
        sa.Column("event_type", sa.String(), nullable=False),
        sa.Column("action", sa.String(), nullable=True),
        sa.Column("repository", sa.String(), nullable=True),
        sa.Column("sender_login", sa.String(), nullable=True),
        sa.Column("task_key", sa.String(), nullable=True),
        sa.Column("commit_sha", sa.String(), nullable=True),
        sa.Column("pull_request_number", sa.Integer(), nullable=True),
        sa.Column("url", sa.String(), nullable=True),
        sa.Column("summary", sa.Text(), nullable=True),
        sa.Column("payload_json", sa.Text(), nullable=True),
        sa.Column("created_at", sa.DateTime(timezone=True), server_default=sa.func.now(), nullable=False),
        sa.ForeignKeyConstraint(["project_id"], ["projects.id"], ondelete="CASCADE"),
        sa.ForeignKeyConstraint(["task_id"], ["tasks.id"], ondelete="SET NULL"),
        sa.PrimaryKeyConstraint("id"),
        sa.UniqueConstraint("delivery_id"),
    )
    op.create_index(op.f("ix_github_events_id"), "github_events", ["id"], unique=False)
    op.create_index(op.f("ix_github_events_delivery_id"), "github_events", ["delivery_id"], unique=False)
    op.create_index(op.f("ix_github_events_project_id"), "github_events", ["project_id"], unique=False)
    op.create_index(op.f("ix_github_events_task_id"), "github_events", ["task_id"], unique=False)
    op.create_index(op.f("ix_github_events_event_type"), "github_events", ["event_type"], unique=False)
    op.create_index(op.f("ix_github_events_task_key"), "github_events", ["task_key"], unique=False)
    op.create_index(op.f("ix_github_events_created_at"), "github_events", ["created_at"], unique=False)


def downgrade() -> None:
    op.drop_index(op.f("ix_github_events_created_at"), table_name="github_events")
    op.drop_index(op.f("ix_github_events_task_key"), table_name="github_events")
    op.drop_index(op.f("ix_github_events_event_type"), table_name="github_events")
    op.drop_index(op.f("ix_github_events_task_id"), table_name="github_events")
    op.drop_index(op.f("ix_github_events_project_id"), table_name="github_events")
    op.drop_index(op.f("ix_github_events_delivery_id"), table_name="github_events")
    op.drop_index(op.f("ix_github_events_id"), table_name="github_events")
    op.drop_table("github_events")
