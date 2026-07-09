"""Switch AI defaults to local Ollama

Revision ID: 1b2c3d4e5f6a
Revises: 0f1a2b3c4d5e
Create Date: 2026-07-09
"""

from typing import Sequence, Union

from alembic import op


revision: str = "1b2c3d4e5f6a"
down_revision: Union[str, Sequence[str], None] = "0f1a2b3c4d5e"
branch_labels: Union[str, Sequence[str], None] = None
depends_on: Union[str, Sequence[str], None] = None


def upgrade() -> None:
    op.execute("ALTER TABLE projects ALTER COLUMN ai_provider SET DEFAULT 'OLLAMA'")
    op.execute("ALTER TABLE ai_usage_logs ALTER COLUMN provider SET DEFAULT 'local_ollama'")
    op.execute(
        """
        UPDATE projects
        SET
            ai_provider = 'OLLAMA',
            ai_provider_name = COALESCE(ai_provider_name, 'Qwen local (Ollama)'),
            ai_model = COALESCE(ai_model, 'qwen2.5-coder:7b'),
            ai_base_url = COALESCE(ai_base_url, 'http://100.121.227.11:11434'),
            ai_api_key_encrypted = NULL
        WHERE ai_provider = 'GEMINI'
        """
    )
    op.execute(
        """
        UPDATE ai_usage_logs
        SET provider = 'local_ollama'
        WHERE provider = 'gemini'
        """
    )


def downgrade() -> None:
    op.execute("ALTER TABLE projects ALTER COLUMN ai_provider SET DEFAULT 'GEMINI'")
    op.execute("ALTER TABLE ai_usage_logs ALTER COLUMN provider SET DEFAULT 'gemini'")
