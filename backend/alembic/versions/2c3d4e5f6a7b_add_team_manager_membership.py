"""Add explicit team manager membership

Revision ID: 2c3d4e5f6a7b
Revises: 1b2c3d4e5f6a
Create Date: 2026-07-09
"""

from typing import Sequence, Union

from alembic import op
import sqlalchemy as sa


revision: str = "2c3d4e5f6a7b"
down_revision: Union[str, Sequence[str], None] = "1b2c3d4e5f6a"
branch_labels: Union[str, Sequence[str], None] = None
depends_on: Union[str, Sequence[str], None] = None


def upgrade() -> None:
    op.add_column(
        "project_teams",
        sa.Column("manager_membership_id", sa.Integer(), nullable=True),
    )
    op.create_foreign_key(
        "fk_project_teams_manager_membership_id_project_members",
        "project_teams",
        "project_members",
        ["manager_membership_id"],
        ["id"],
        ondelete="SET NULL",
    )


def downgrade() -> None:
    op.drop_constraint(
        "fk_project_teams_manager_membership_id_project_members",
        "project_teams",
        type_="foreignkey",
    )
    op.drop_column("project_teams", "manager_membership_id")
