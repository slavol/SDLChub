"""Merge notifications branch with main migration branch

Revision ID: 6f7a8b9c0d1e
Revises: 4d5e6f7a8b9c, 5e6f7a8b9c0d
Create Date: 2026-05-19 01:20:00
"""

from typing import Sequence, Union

revision: str = "6f7a8b9c0d1e"
down_revision: Union[str, Sequence[str], None] = ("4d5e6f7a8b9c", "5e6f7a8b9c0d")
branch_labels: Union[str, Sequence[str], None] = None
depends_on: Union[str, Sequence[str], None] = None


def upgrade() -> None:
    pass


def downgrade() -> None:
    pass
