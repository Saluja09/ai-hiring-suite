"""Test isolation: force a temp on-disk SQLite DB before any app module is imported.

This module MUST NOT import app.db / app.main (or anything that transitively
imports them) at module scope before the environment variable below is set,
because app.db creates its SQLAlchemy engine at import time from settings.
"""

import os
import tempfile
import uuid

# Unique temp file per test session so parallel/interleaved runs never collide
# and nothing ever touches the real ./app.db used by the running application.
_tmp_db_path = os.path.join(
    tempfile.gettempdir(), f"ai_hiring_suite_test_{uuid.uuid4().hex}.db"
)
os.environ["DATABASE_URL"] = f"sqlite:///{_tmp_db_path}"

# Now it's safe to import app modules that read settings at import time.
from app.config import get_settings  # noqa: E402

get_settings.cache_clear()

import atexit  # noqa: E402

import pytest  # noqa: E402


@atexit.register
def _cleanup_tmp_db() -> None:
    try:
        os.remove(_tmp_db_path)
    except OSError:
        pass


@pytest.fixture(autouse=True)
def _isolated_db():
    """Reset schema before/after every test so rows never leak across tests."""
    from app.db import engine, init_db
    from sqlmodel import SQLModel

    SQLModel.metadata.drop_all(engine)
    init_db()
    yield
    SQLModel.metadata.drop_all(engine)
