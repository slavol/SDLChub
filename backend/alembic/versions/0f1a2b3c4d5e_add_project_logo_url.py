"""Add project logo url

Revision ID: 0f1a2b3c4d5e
Revises: f9b0c1d2e3f4
Create Date: 2026-06-07
"""

from typing import Sequence, Union

from alembic import op
import sqlalchemy as sa


revision: str = "0f1a2b3c4d5e"
down_revision: Union[str, None] = "f9b0c1d2e3f4"
branch_labels: Union[str, Sequence[str], None] = None
depends_on: Union[str, Sequence[str], None] = None


def upgrade() -> None:
    op.add_column("projects", sa.Column("logo_url", sa.String(), nullable=True))


def downgrade() -> None:
    op.drop_column("projects", "logo_url")
