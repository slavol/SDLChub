"""Add project workflow config

Revision ID: d0e1f2a3b4c5
Revises: cf3a4b5c6d7e
Create Date: 2026-05-29 00:00:00.000000

"""
from typing import Sequence, Union

from alembic import op
import sqlalchemy as sa


revision: str = "d0e1f2a3b4c5"
down_revision: Union[str, Sequence[str], None] = "cf3a4b5c6d7e"
branch_labels: Union[str, Sequence[str], None] = None
depends_on: Union[str, Sequence[str], None] = None


def upgrade() -> None:
    op.add_column("projects", sa.Column("workflow_config", sa.Text(), nullable=True))


def downgrade() -> None:
    op.drop_column("projects", "workflow_config")
