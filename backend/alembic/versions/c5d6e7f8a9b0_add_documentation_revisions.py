"""Add documentation revisions

Revision ID: c5d6e7f8a9b0
Revises: b4c5d6e7f8a9
Create Date: 2026-05-30 00:00:00.000000

"""
from typing import Sequence, Union

from alembic import op
import sqlalchemy as sa


revision: str = "c5d6e7f8a9b0"
down_revision: Union[str, Sequence[str], None] = "b4c5d6e7f8a9"
branch_labels: Union[str, Sequence[str], None] = None
depends_on: Union[str, Sequence[str], None] = None


def upgrade() -> None:
    op.create_table(
        "documentation_revisions",
        sa.Column("id", sa.Integer(), nullable=False),
        sa.Column("page_id", sa.Integer(), nullable=False),
        sa.Column("project_id", sa.Integer(), nullable=False),
        sa.Column("task_id", sa.Integer(), nullable=True),
        sa.Column("title", sa.String(), nullable=False),
        sa.Column("content", sa.Text(), nullable=False),
        sa.Column("action", sa.String(), nullable=False),
        sa.Column("actor_id", sa.Integer(), nullable=True),
        sa.Column("created_at", sa.DateTime(timezone=True), server_default=sa.text("CURRENT_TIMESTAMP"), nullable=False),
        sa.ForeignKeyConstraint(["actor_id"], ["users.id"], ondelete="SET NULL"),
        sa.ForeignKeyConstraint(["page_id"], ["documentation_pages.id"], ondelete="CASCADE"),
        sa.ForeignKeyConstraint(["project_id"], ["projects.id"], ondelete="CASCADE"),
        sa.ForeignKeyConstraint(["task_id"], ["tasks.id"], ondelete="SET NULL"),
        sa.PrimaryKeyConstraint("id"),
    )
    op.create_index(op.f("ix_documentation_revisions_id"), "documentation_revisions", ["id"], unique=False)
    op.create_index("ix_documentation_revisions_page_id", "documentation_revisions", ["page_id"], unique=False)
    op.create_index("ix_documentation_revisions_project_id", "documentation_revisions", ["project_id"], unique=False)
    op.create_index("ix_documentation_revisions_task_id", "documentation_revisions", ["task_id"], unique=False)
    op.create_index("ix_documentation_revisions_actor_id", "documentation_revisions", ["actor_id"], unique=False)


def downgrade() -> None:
    op.drop_index("ix_documentation_revisions_actor_id", table_name="documentation_revisions")
    op.drop_index("ix_documentation_revisions_task_id", table_name="documentation_revisions")
    op.drop_index("ix_documentation_revisions_project_id", table_name="documentation_revisions")
    op.drop_index("ix_documentation_revisions_page_id", table_name="documentation_revisions")
    op.drop_index(op.f("ix_documentation_revisions_id"), table_name="documentation_revisions")
    op.drop_table("documentation_revisions")
