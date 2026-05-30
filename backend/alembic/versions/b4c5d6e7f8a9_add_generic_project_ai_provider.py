"""Add generic project AI provider fields

Revision ID: b4c5d6e7f8a9
Revises: a3b4c5d6e7f8
Create Date: 2026-05-29 00:00:00.000000

"""
from typing import Sequence, Union

from alembic import op
import sqlalchemy as sa


revision: str = "b4c5d6e7f8a9"
down_revision: Union[str, Sequence[str], None] = "a3b4c5d6e7f8"
branch_labels: Union[str, Sequence[str], None] = None
depends_on: Union[str, Sequence[str], None] = None


def upgrade() -> None:
    op.add_column("projects", sa.Column("ai_provider_name", sa.String(), nullable=True))
    op.add_column("projects", sa.Column("ai_base_url", sa.String(), nullable=True))
    op.add_column("projects", sa.Column("ai_model", sa.String(), nullable=True))


def downgrade() -> None:
    op.drop_column("projects", "ai_model")
    op.drop_column("projects", "ai_base_url")
    op.drop_column("projects", "ai_provider_name")
