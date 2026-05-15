"""Add task due date

Revision ID: 1a2b3c4d5e6f
Revises: 8f4b0e2b7d91
Create Date: 2026-05-15 18:40:00.000000

"""
from typing import Sequence, Union

from alembic import op
import sqlalchemy as sa


revision: str = "1a2b3c4d5e6f"
down_revision: Union[str, Sequence[str], None] = "8f4b0e2b7d91"
branch_labels: Union[str, Sequence[str], None] = None
depends_on: Union[str, Sequence[str], None] = None


def upgrade() -> None:
    op.add_column("tasks", sa.Column("due_date", sa.DateTime(), nullable=True))


def downgrade() -> None:
    op.drop_column("tasks", "due_date")
