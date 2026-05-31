"""Add user sessions and security logs

Revision ID: f9a0b1c2d3e4
Revises: f8a9b0c1d2e3
Create Date: 2026-05-31
"""

from typing import Sequence, Union

from alembic import op
import sqlalchemy as sa


revision: str = "f9a0b1c2d3e4"
down_revision: Union[str, None] = "f8a9b0c1d2e3"
branch_labels: Union[str, Sequence[str], None] = None
depends_on: Union[str, Sequence[str], None] = None


def upgrade() -> None:
    op.create_table(
        "user_sessions",
        sa.Column("id", sa.Integer(), nullable=False),
        sa.Column("user_id", sa.Integer(), nullable=False),
        sa.Column("token_family", sa.String(), nullable=True),
        sa.Column("ip_address", sa.String(), nullable=True),
        sa.Column("user_agent", sa.Text(), nullable=True),
        sa.Column("device_label", sa.String(), nullable=True),
        sa.Column("location_hint", sa.String(), nullable=True),
        sa.Column("created_at", sa.DateTime(timezone=True), server_default=sa.text("now()"), nullable=False),
        sa.Column("last_seen_at", sa.DateTime(timezone=True), server_default=sa.text("now()"), nullable=False),
        sa.Column("revoked_at", sa.DateTime(timezone=True), nullable=True),
        sa.Column("revoke_reason", sa.String(), nullable=True),
        sa.ForeignKeyConstraint(["user_id"], ["users.id"]),
        sa.PrimaryKeyConstraint("id"),
    )
    op.create_index(op.f("ix_user_sessions_id"), "user_sessions", ["id"], unique=False)
    op.create_index(op.f("ix_user_sessions_user_id"), "user_sessions", ["user_id"], unique=False)
    op.create_index(op.f("ix_user_sessions_token_family"), "user_sessions", ["token_family"], unique=False)

    op.create_table(
        "user_security_logs",
        sa.Column("id", sa.Integer(), nullable=False),
        sa.Column("user_id", sa.Integer(), nullable=False),
        sa.Column("session_id", sa.Integer(), nullable=True),
        sa.Column("event_type", sa.String(), nullable=False),
        sa.Column("title", sa.String(), nullable=False),
        sa.Column("detail", sa.Text(), nullable=True),
        sa.Column("ip_address", sa.String(), nullable=True),
        sa.Column("user_agent", sa.Text(), nullable=True),
        sa.Column("created_at", sa.DateTime(timezone=True), server_default=sa.text("now()"), nullable=False),
        sa.ForeignKeyConstraint(["session_id"], ["user_sessions.id"]),
        sa.ForeignKeyConstraint(["user_id"], ["users.id"]),
        sa.PrimaryKeyConstraint("id"),
    )
    op.create_index(op.f("ix_user_security_logs_id"), "user_security_logs", ["id"], unique=False)
    op.create_index(op.f("ix_user_security_logs_user_id"), "user_security_logs", ["user_id"], unique=False)
    op.create_index(op.f("ix_user_security_logs_session_id"), "user_security_logs", ["session_id"], unique=False)
    op.create_index(op.f("ix_user_security_logs_event_type"), "user_security_logs", ["event_type"], unique=False)
    op.create_index(op.f("ix_user_security_logs_created_at"), "user_security_logs", ["created_at"], unique=False)


def downgrade() -> None:
    op.drop_index(op.f("ix_user_security_logs_created_at"), table_name="user_security_logs")
    op.drop_index(op.f("ix_user_security_logs_event_type"), table_name="user_security_logs")
    op.drop_index(op.f("ix_user_security_logs_session_id"), table_name="user_security_logs")
    op.drop_index(op.f("ix_user_security_logs_user_id"), table_name="user_security_logs")
    op.drop_index(op.f("ix_user_security_logs_id"), table_name="user_security_logs")
    op.drop_table("user_security_logs")

    op.drop_index(op.f("ix_user_sessions_token_family"), table_name="user_sessions")
    op.drop_index(op.f("ix_user_sessions_user_id"), table_name="user_sessions")
    op.drop_index(op.f("ix_user_sessions_id"), table_name="user_sessions")
    op.drop_table("user_sessions")
