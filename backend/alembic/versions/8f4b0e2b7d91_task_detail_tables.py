"""Task detail tables

Revision ID: 8f4b0e2b7d91
Revises: 0c2366c00941
Create Date: 2026-05-15 12:00:00.000000

"""
from typing import Sequence, Union

from alembic import op
import sqlalchemy as sa


revision: str = "8f4b0e2b7d91"
down_revision: Union[str, Sequence[str], None] = "0c2366c00941"
branch_labels: Union[str, Sequence[str], None] = None
depends_on: Union[str, Sequence[str], None] = None


def upgrade() -> None:
    op.create_table(
        "subtasks",
        sa.Column("id", sa.Integer(), nullable=False),
        sa.Column("task_id", sa.Integer(), nullable=True),
        sa.Column("title", sa.String(), nullable=True),
        sa.Column("is_done", sa.Boolean(), nullable=True),
        sa.Column("created_by_id", sa.Integer(), nullable=True),
        sa.Column("created_at", sa.DateTime(timezone=True), server_default=sa.text("now()"), nullable=True),
        sa.Column("updated_at", sa.DateTime(timezone=True), nullable=True),
        sa.ForeignKeyConstraint(["created_by_id"], ["users.id"]),
        sa.ForeignKeyConstraint(["task_id"], ["tasks.id"]),
        sa.PrimaryKeyConstraint("id"),
    )
    op.create_index(op.f("ix_subtasks_id"), "subtasks", ["id"], unique=False)

    op.create_table(
        "task_comments",
        sa.Column("id", sa.Integer(), nullable=False),
        sa.Column("task_id", sa.Integer(), nullable=True),
        sa.Column("author_id", sa.Integer(), nullable=True),
        sa.Column("body", sa.Text(), nullable=True),
        sa.Column("created_at", sa.DateTime(timezone=True), server_default=sa.text("now()"), nullable=True),
        sa.Column("updated_at", sa.DateTime(timezone=True), nullable=True),
        sa.ForeignKeyConstraint(["author_id"], ["users.id"]),
        sa.ForeignKeyConstraint(["task_id"], ["tasks.id"]),
        sa.PrimaryKeyConstraint("id"),
    )
    op.create_index(op.f("ix_task_comments_id"), "task_comments", ["id"], unique=False)

    op.create_table(
        "task_audit_logs",
        sa.Column("id", sa.Integer(), nullable=False),
        sa.Column("task_id", sa.Integer(), nullable=True),
        sa.Column("actor_id", sa.Integer(), nullable=True),
        sa.Column("action", sa.String(), nullable=True),
        sa.Column("field", sa.String(), nullable=True),
        sa.Column("old_value", sa.Text(), nullable=True),
        sa.Column("new_value", sa.Text(), nullable=True),
        sa.Column("created_at", sa.DateTime(timezone=True), server_default=sa.text("now()"), nullable=True),
        sa.ForeignKeyConstraint(["actor_id"], ["users.id"]),
        sa.ForeignKeyConstraint(["task_id"], ["tasks.id"]),
        sa.PrimaryKeyConstraint("id"),
    )
    op.create_index(op.f("ix_task_audit_logs_id"), "task_audit_logs", ["id"], unique=False)


def downgrade() -> None:
    op.drop_index(op.f("ix_task_audit_logs_id"), table_name="task_audit_logs")
    op.drop_table("task_audit_logs")
    op.drop_index(op.f("ix_task_comments_id"), table_name="task_comments")
    op.drop_table("task_comments")
    op.drop_index(op.f("ix_subtasks_id"), table_name="subtasks")
    op.drop_table("subtasks")
