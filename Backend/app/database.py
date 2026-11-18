from collections.abc import Iterator

from sqlalchemy import create_engine, inspect, text
from sqlalchemy.orm import DeclarativeBase, Session, sessionmaker

from app.config import get_settings

_url = get_settings().database_url
engine = create_engine(
    _url,
    connect_args={"check_same_thread": False} if _url.startswith("sqlite") else {},
    pool_pre_ping=True,  # Neon/PostgreSQL drops idle connections; check before use.
)
SessionLocal = sessionmaker(bind=engine, autoflush=False, expire_on_commit=False)

# Columns added after the first release. create_all() only creates missing tables,
# so existing databases need these added explicitly.
_ADDED_COLUMNS: list[tuple[str, str, str]] = [
    ("roadmaps", "progress", "JSON"),
]


class Base(DeclarativeBase):
    pass


def ensure_schema() -> None:
    Base.metadata.create_all(engine)
    inspector = inspect(engine)
    tables = set(inspector.get_table_names())
    for table, column, ddl_type in _ADDED_COLUMNS:
        if table not in tables:
            continue
        if column in {c["name"] for c in inspector.get_columns(table)}:
            continue
        with engine.begin() as conn:
            conn.execute(text(f"ALTER TABLE {table} ADD COLUMN {column} {ddl_type}"))


def get_db() -> Iterator[Session]:
    db = SessionLocal()
    try:
        yield db
    finally:
        db.close()
