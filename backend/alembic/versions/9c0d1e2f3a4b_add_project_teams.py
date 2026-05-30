"""Add project teams

Revision ID: 9c0d1e2f3a4b
Revises: 8b9c0d1e2f3a
Create Date: 2026-05-28 00:00:00.000000

"""
from typing import Sequence, Union

from alembic import op
import sqlalchemy as sa


revision: str = "9c0d1e2f3a4b"
down_revision: Union[str, Sequence[str], None] = "8b9c0d1e2f3a"
branch_labels: Union[str, Sequence[str], None] = None
depends_on: Union[str, Sequence[str], None] = None


def upgrade() -> None:
    op.create_table(
        "project_teams",
        sa.Column("id", sa.Integer(), nullable=False),
        sa.Column("project_id", sa.Integer(), nullable=True),
        sa.Column("parent_id", sa.Integer(), nullable=True),
        sa.Column("name", sa.String(), nullable=True),
        sa.Column("description", sa.Text(), nullable=True),
        sa.Column("created_at", sa.DateTime(timezone=True), server_default=sa.text("now()"), nullable=True),
        sa.Column("updated_at", sa.DateTime(timezone=True), nullable=True),
        sa.ForeignKeyConstraint(["parent_id"], ["project_teams.id"], ondelete="SET NULL"),
        sa.ForeignKeyConstraint(["project_id"], ["projects.id"], ondelete="CASCADE"),
        sa.PrimaryKeyConstraint("id"),
    )
    op.create_index(op.f("ix_project_teams_id"), "project_teams", ["id"], unique=False)
    op.create_index("ix_project_teams_project_id", "project_teams", ["project_id"], unique=False)

    with op.batch_alter_table("project_members") as batch_op:
        batch_op.add_column(sa.Column("team_id", sa.Integer(), nullable=True))
        batch_op.create_foreign_key(
            "fk_project_members_team_id_project_teams",
            "project_teams",
            ["team_id"],
            ["id"],
            ondelete="SET NULL",
        )

    with op.batch_alter_table("tasks") as batch_op:
        batch_op.add_column(sa.Column("team_id", sa.Integer(), nullable=True))
        batch_op.create_foreign_key(
            "fk_tasks_team_id_project_teams",
            "project_teams",
            ["team_id"],
            ["id"],
            ondelete="SET NULL",
        )


def downgrade() -> None:
    with op.batch_alter_table("tasks") as batch_op:
        batch_op.drop_constraint("fk_tasks_team_id_project_teams", type_="foreignkey")
        batch_op.drop_column("team_id")

    with op.batch_alter_table("project_members") as batch_op:
        batch_op.drop_constraint("fk_project_members_team_id_project_teams", type_="foreignkey")
        batch_op.drop_column("team_id")

    op.drop_index("ix_project_teams_project_id", table_name="project_teams")
    op.drop_index(op.f("ix_project_teams_id"), table_name="project_teams")
    op.drop_table("project_teams")
