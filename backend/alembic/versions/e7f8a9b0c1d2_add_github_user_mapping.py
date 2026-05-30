"""Add GitHub user mapping

Revision ID: e7f8a9b0c1d2
Revises: d6e7f8a9b0c1
Create Date: 2026-05-30 23:12:00.000000
"""

from typing import Sequence, Union

import sqlalchemy as sa
from alembic import op


revision: str = "e7f8a9b0c1d2"
down_revision: Union[str, None] = "d6e7f8a9b0c1"
branch_labels: Union[str, Sequence[str], None] = None
depends_on: Union[str, Sequence[str], None] = None


def upgrade() -> None:
    bind = op.get_bind()

    op.add_column("users", sa.Column("github_username", sa.String(), nullable=True))
    op.create_index(op.f("ix_users_github_username"), "users", ["github_username"], unique=False)

    op.add_column("github_events", sa.Column("mapped_user_id", sa.Integer(), nullable=True))
    op.create_index(op.f("ix_github_events_mapped_user_id"), "github_events", ["mapped_user_id"], unique=False)
    if bind.dialect.name != "sqlite":
        op.create_foreign_key(
            "fk_github_events_mapped_user_id_users",
            "github_events",
            "users",
            ["mapped_user_id"],
            ["id"],
            ondelete="SET NULL",
        )


def downgrade() -> None:
    bind = op.get_bind()

    if bind.dialect.name != "sqlite":
        op.drop_constraint("fk_github_events_mapped_user_id_users", "github_events", type_="foreignkey")
    op.drop_index(op.f("ix_github_events_mapped_user_id"), table_name="github_events")
    op.drop_column("github_events", "mapped_user_id")

    op.drop_index(op.f("ix_users_github_username"), table_name="users")
    op.drop_column("users", "github_username")
