from __future__ import annotations

import secrets
from datetime import datetime

from sqlalchemy import DateTime, ForeignKey, Integer, String, func
from sqlalchemy.orm import Mapped, mapped_column, relationship

from app.core.database import Base


class Project(Base):
    """A tenant workspace owning layers and API keys."""

    __tablename__ = "projects"

    id: Mapped[str] = mapped_column(String(32), primary_key=True, default=lambda: secrets.token_hex(8))
    name: Mapped[str] = mapped_column(String(120), default="Default Project")
    plan: Mapped[str] = mapped_column(String(32), default="free")
    created_at: Mapped[datetime] = mapped_column(DateTime(timezone=True), server_default=func.now())

    layers: Mapped[list[Layer]] = relationship(back_populates="project", cascade="all, delete-orphan")
    api_keys: Mapped[list[ApiKey]] = relationship(back_populates="project", cascade="all, delete-orphan")


class Layer(Base):
    """A published spatial dataset stored in a pluggable spatial backend."""

    __tablename__ = "layers"

    id: Mapped[str] = mapped_column(String(32), primary_key=True, default=lambda: secrets.token_hex(8))
    project_id: Mapped[str] = mapped_column(ForeignKey("projects.id", ondelete="CASCADE"), index=True)
    name: Mapped[str] = mapped_column(String(200))
    slug: Mapped[str] = mapped_column(String(200), index=True)
    source_filename: Mapped[str] = mapped_column(String(255))
    backend: Mapped[str] = mapped_column(String(32), default="geopackage")
    storage_uri: Mapped[str] = mapped_column(String(500))
    table_name: Mapped[str | None] = mapped_column(String(120), nullable=True)
    # Legacy alias kept for older rows / local smoke artifacts.
    gpkg_path: Mapped[str | None] = mapped_column(String(500), nullable=True)
    crs: Mapped[str] = mapped_column(String(64), default="EPSG:4326")
    geometry_type: Mapped[str] = mapped_column(String(64), default="Unknown")
    feature_count: Mapped[int] = mapped_column(Integer, default=0)
    bbox_west: Mapped[float | None] = mapped_column(nullable=True)
    bbox_south: Mapped[float | None] = mapped_column(nullable=True)
    bbox_east: Mapped[float | None] = mapped_column(nullable=True)
    bbox_north: Mapped[float | None] = mapped_column(nullable=True)
    created_at: Mapped[datetime] = mapped_column(DateTime(timezone=True), server_default=func.now())

    project: Mapped[Project] = relationship(back_populates="layers")


class ApiKey(Base):
    """Project API key used for Feature/MVT/MCP access."""

    __tablename__ = "api_keys"

    id: Mapped[str] = mapped_column(String(32), primary_key=True, default=lambda: secrets.token_hex(8))
    project_id: Mapped[str] = mapped_column(ForeignKey("projects.id", ondelete="CASCADE"), index=True)
    name: Mapped[str] = mapped_column(String(120), default="default")
    key_prefix: Mapped[str] = mapped_column(String(12), index=True)
    key_hash: Mapped[str] = mapped_column(String(128), unique=True)
    created_at: Mapped[datetime] = mapped_column(DateTime(timezone=True), server_default=func.now())
    revoked_at: Mapped[datetime | None] = mapped_column(DateTime(timezone=True), nullable=True)

    project: Mapped[Project] = relationship(back_populates="api_keys")


class UsageEvent(Base):
    """Metered request for billing and plan limits."""

    __tablename__ = "usage_events"

    id: Mapped[int] = mapped_column(Integer, primary_key=True, autoincrement=True)
    project_id: Mapped[str] = mapped_column(String(32), index=True)
    api_key_id: Mapped[str | None] = mapped_column(String(32), nullable=True)
    endpoint: Mapped[str] = mapped_column(String(64))
    units: Mapped[int] = mapped_column(Integer, default=1)
    created_at: Mapped[datetime] = mapped_column(DateTime(timezone=True), server_default=func.now())
