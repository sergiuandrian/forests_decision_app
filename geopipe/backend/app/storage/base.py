from __future__ import annotations

from abc import ABC, abstractmethod
from dataclasses import dataclass
from typing import Any

import geopandas as gpd


@dataclass(frozen=True)
class StoredLayerRef:
    """Pointer to layer data inside a spatial backend."""

    backend: str
    uri: str
    table_name: str | None = None


class SpatialBackend(ABC):
    """Pluggable spatial database / file store."""

    name: str

    @abstractmethod
    def is_available(self) -> tuple[bool, str]:
        """Return whether this backend can be used and a status message."""

    @abstractmethod
    def write_layer(self, layer_id: str, gdf: gpd.GeoDataFrame, *, slug: str) -> StoredLayerRef:
        """Persist a GeoDataFrame and return a storage reference."""

    @abstractmethod
    def read_layer(self, ref: StoredLayerRef) -> gpd.GeoDataFrame:
        """Load a stored layer as a GeoDataFrame in EPSG:4326 when possible."""

    def describe(self) -> dict[str, Any]:
        """Return backend metadata for API/UI."""
        ok, message = self.is_available()
        return {"name": self.name, "available": ok, "message": message}
