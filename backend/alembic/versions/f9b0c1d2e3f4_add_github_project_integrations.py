"""Add GitHub project integrations

Revision ID: f9b0c1d2e3f4
Revises: f9a0b1c2d3e4
Create Date: 2026-05-31
"""

from typing import Sequence, Union

from alembic import op
import sqlalchemy as sa


revision: str = "f9b0c1d2e3f4"
down_revision: Union[str, None] = "f9a0b1c2d3e4"
branch_labels: Union[str, Sequence[str], None] = None
depends_on: Union[str, Sequence[str], None] = None


def upgrade() -> None:
    op.create_table(
        "github_project_integrations",
        sa.Column("id", sa.Integer(), nullable=False),
        sa.Column("project_id", sa.Integer(), nullable=False),
        sa.Column("created_by_id", sa.Integer(), nullable=True),
        sa.Column("repository_full_name", sa.String(), nullable=False),
        sa.Column("repository_url", sa.String(), nullable=True),
        sa.Column("default_branch", sa.String(), nullable=True, server_default="main"),
        sa.Column("webhook_url", sa.String(), nullable=True),
        sa.Column("webhook_secret_hint", sa.String(), nullable=True),
        sa.Column("setup_status", sa.String(), nullable=False, server_default="CONFIGURED"),
        sa.Column("auto_link_commits", sa.Boolean(), nullable=False, server_default=sa.true()),
        sa.Column("auto_transition_prs", sa.Boolean(), nullable=False, server_default=sa.true()),
        sa.Column("last_ping_at", sa.DateTime(timezone=True), nullable=True),
        sa.Column("last_delivery_at", sa.DateTime(timezone=True), nullable=True),
        sa.Column("last_error", sa.Text(), nullable=True),
        sa.Column("created_at", sa.DateTime(timezone=True), server_default=sa.text("now()"), nullable=False),
        sa.Column("updated_at", sa.DateTime(timezone=True), nullable=True),
        sa.ForeignKeyConstraint(["created_by_id"], ["users.id"], ondelete="SET NULL"),
        sa.ForeignKeyConstraint(["project_id"], ["projects.id"], ondelete="CASCADE"),
        sa.PrimaryKeyConstraint("id"),
        sa.UniqueConstraint("project_id"),
    )
    op.create_index(op.f("ix_github_project_integrations_id"), "github_project_integrations", ["id"], unique=False)
    op.create_index(op.f("ix_github_project_integrations_project_id"), "github_project_integrations", ["project_id"], unique=False)
    op.create_index(op.f("ix_github_project_integrations_created_by_id"), "github_project_integrations", ["created_by_id"], unique=False)
    op.create_index(op.f("ix_github_project_integrations_repository_full_name"), "github_project_integrations", ["repository_full_name"], unique=False)


def downgrade() -> None:
    op.drop_index(op.f("ix_github_project_integrations_repository_full_name"), table_name="github_project_integrations")
    op.drop_index(op.f("ix_github_project_integrations_created_by_id"), table_name="github_project_integrations")
    op.drop_index(op.f("ix_github_project_integrations_project_id"), table_name="github_project_integrations")
    op.drop_index(op.f("ix_github_project_integrations_id"), table_name="github_project_integrations")
    op.drop_table("github_project_integrations")
