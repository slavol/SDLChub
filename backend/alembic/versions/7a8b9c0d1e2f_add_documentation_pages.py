"""Add documentation pages table

Revision ID: 7a8b9c0d1e2f
Revises: 6f7a8b9c0d1e
Create Date: 2026-05-19 01:45:00
"""

from typing import Sequence, Union

import sqlalchemy as sa
from alembic import op


revision: str = "7a8b9c0d1e2f"
down_revision: Union[str, Sequence[str], None] = "6f7a8b9c0d1e"
branch_labels: Union[str, Sequence[str], None] = None
depends_on: Union[str, Sequence[str], None] = None


def upgrade() -> None:
    op.create_table(
        "documentation_pages",
        sa.Column("id", sa.Integer(), nullable=False),
        sa.Column("project_id", sa.Integer(), nullable=False),
        sa.Column("task_id", sa.Integer(), nullable=True),
        sa.Column("title", sa.String(), nullable=False),
        sa.Column("content", sa.Text(), nullable=False),
        sa.Column("created_by_id", sa.Integer(), nullable=True),
        sa.Column("created_at", sa.DateTime(timezone=True), server_default=sa.func.now(), nullable=False),
        sa.Column("updated_at", sa.DateTime(timezone=True), server_default=sa.func.now(), nullable=False),
        sa.ForeignKeyConstraint(["created_by_id"], ["users.id"], ondelete="SET NULL"),
        sa.ForeignKeyConstraint(["project_id"], ["projects.id"], ondelete="CASCADE"),
        sa.ForeignKeyConstraint(["task_id"], ["tasks.id"], ondelete="SET NULL"),
        sa.PrimaryKeyConstraint("id"),
    )
    op.create_index(op.f("ix_documentation_pages_id"), "documentation_pages", ["id"], unique=False)
    op.create_index(op.f("ix_documentation_pages_project_id"), "documentation_pages", ["project_id"], unique=False)
    op.create_index(op.f("ix_documentation_pages_task_id"), "documentation_pages", ["task_id"], unique=False)
    op.create_index(op.f("ix_documentation_pages_created_by_id"), "documentation_pages", ["created_by_id"], unique=False)


def downgrade() -> None:
    op.drop_index(op.f("ix_documentation_pages_created_by_id"), table_name="documentation_pages")
    op.drop_index(op.f("ix_documentation_pages_task_id"), table_name="documentation_pages")
    op.drop_index(op.f("ix_documentation_pages_project_id"), table_name="documentation_pages")
    op.drop_index(op.f("ix_documentation_pages_id"), table_name="documentation_pages")
    op.drop_table("documentation_pages")
