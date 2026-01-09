from logging.config import fileConfig
import sys
import os
from sqlalchemy import engine_from_config
from sqlalchemy import pool
from alembic import context
from dotenv import load_dotenv

# 1. Adăugăm directorul curent în Path pentru a putea importa modulele
sys.path.append(os.getcwd())

# 2. Încărcăm variabilele de mediu din .env
load_dotenv()

# 3. Importăm Base și Modelele noastre
# Este CRITIC să importăm toate modelele aici, altfel Alembic nu le va vedea!
from database.session import Base
from models.user import User
from models.workspace import Workspace, WorkspaceMember, Role, Invitation
from models.project import Project, Sprint, Task
# (Vom adăuga Project/Task aici mai târziu)

# this is the Alembic Config object
config = context.config

# 4. Suprascriem URL-ul bazei de date cu cel din .env
# Asta asigură că nu hardcodăm parola în alembic.ini
db_url = os.getenv("DATABASE_URL")
if db_url:
    config.set_main_option("sqlalchemy.url", db_url)

# Interpret the config file for Python logging.
if config.config_file_name is not None:
    fileConfig(config.config_file_name)

# 5. Setăm target_metadata la Base.metadata
target_metadata = Base.metadata

def run_migrations_offline() -> None:
    """Run migrations in 'offline' mode."""
    url = config.get_main_option("sqlalchemy.url")
    context.configure(
        url=url,
        target_metadata=target_metadata,
        literal_binds=True,
        dialect_opts={"paramstyle": "named"},
    )

    with context.begin_transaction():
        context.run_migrations()

def run_migrations_online() -> None:
    """Run migrations in 'online' mode."""
    connectable = engine_from_config(
        config.get_section(config.config_ini_section, {}),
        prefix="sqlalchemy.",
        poolclass=pool.NullPool,
    )

    with connectable.connect() as connection:
        context.configure(
            connection=connection, target_metadata=target_metadata
        )

        with context.begin_transaction():
            context.run_migrations()

if context.is_offline_mode():
    run_migrations_offline()
else:
    run_migrations_online()