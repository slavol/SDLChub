"""Add project AI settings

Revision ID: a3b4c5d6e7f8
Revises: f2a3b4c5d6e7
Create Date: 2026-05-29 00:00:00.000000

"""
from typing import Sequence, Union

from alembic import context, op
import sqlalchemy as sa


revision: str = "a3b4c5d6e7f8"
down_revision: Union[str, Sequence[str], None] = "f2a3b4c5d6e7"
branch_labels: Union[str, Sequence[str], None] = None
depends_on: Union[str, Sequence[str], None] = None


def upgrade() -> None:
    op.add_column(
        "projects",
        sa.Column("ai_provider_mode", sa.String(), nullable=False, server_default="PLATFORM"),
    )
    op.add_column(
        "projects",
        sa.Column("ai_provider", sa.String(), nullable=False, server_default="GEMINI"),
    )
    op.add_column("projects", sa.Column("ai_api_key_encrypted", sa.Text(), nullable=True))
    if context.get_context().dialect.name != "sqlite":
        op.alter_column("projects", "ai_provider_mode", server_default=None)
        op.alter_column("projects", "ai_provider", server_default=None)


def downgrade() -> None:
    op.drop_column("projects", "ai_api_key_encrypted")
    op.drop_column("projects", "ai_provider")
    op.drop_column("projects", "ai_provider_mode")
