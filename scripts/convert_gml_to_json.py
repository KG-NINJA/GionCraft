#!/usr/bin/env python3
"""Convert a subset of CityGML building solids into a lightweight JSON mesh."""

from __future__ import annotations

import argparse
import json
import math
from pathlib import Path
from typing import Iterable, List, Sequence, Tuple
import xml.etree.ElementTree as ET

GML_NS = "http://www.opengis.net/gml"
BLDG_NS = "http://www.opengis.net/citygml/building/2.0"
NS = {
    "gml": GML_NS,
    "bldg": BLDG_NS,
}


def chunked(seq: Sequence[float], size: int) -> Iterable[Tuple[float, ...]]:
    for idx in range(0, len(seq), size):
        yield tuple(seq[idx : idx + size])


def parse_linear_ring(ring: ET.Element) -> List[Tuple[float, float, float]]:
    pos_list = ring.find("gml:posList", NS)
    if pos_list is None or not pos_list.text:
        return []
    raw_values = [float(v) for v in pos_list.text.split()]
    coords = list(chunked(raw_values, 3))
    if len(coords) > 1 and coords[0] == coords[-1]:
        coords.pop()
    return list(coords)


def polygon_to_triangles(coords: Sequence[Tuple[float, float, float]]) -> List[List[Tuple[float, float, float]]]:
    if len(coords) < 3:
        return []
    anchor = coords[0]
    triangles: List[List[Tuple[float, float, float]]] = []
    for i in range(1, len(coords) - 1):
        triangles.append([anchor, coords[i], coords[i + 1]])
    return triangles


def extract_triangles(gml_path: Path) -> List[List[Tuple[float, float, float]]]:
    tree = ET.parse(gml_path)
    root = tree.getroot()
    triangles: List[List[Tuple[float, float, float]]] = []
    # Focus on LoD1 solids for watertight building shells.
    for solid in root.findall(".//bldg:lod1Solid", NS):
        for ring in solid.findall(".//gml:LinearRing", NS):
            coords = parse_linear_ring(ring)
            triangles.extend(polygon_to_triangles(coords))
    if not triangles:
        # Fallback: capture any polygon we can find.
        for ring in root.findall(".//gml:LinearRing", NS):
            coords = parse_linear_ring(ring)
            triangles.extend(polygon_to_triangles(coords))
    return triangles


def degrees_to_meters_converter(lat_deg: float) -> Tuple[float, float]:
    lat_rad = math.radians(lat_deg)
    meters_per_degree_lat = 111_132.92 - 559.82 * math.cos(2 * lat_rad) + 1.175 * math.cos(4 * lat_rad)
    meters_per_degree_lon = 111_412.84 * math.cos(lat_rad) - 93.5 * math.cos(3 * lat_rad)
    return meters_per_degree_lat, meters_per_degree_lon


def convert_coordinates(
    triangles: Sequence[Sequence[Tuple[float, float, float]]],
    lat0: float,
    lon0: float,
) -> Tuple[List[List[float]], dict]:
    lat_scale, lon_scale = degrees_to_meters_converter(lat0)
    converted: List[List[float]] = []
    min_x = min_y = min_z = float("inf")
    max_x = max_y = max_z = float("-inf")

    for tri in triangles:
        flat: List[float] = []
        for lat, lon, height in tri:
            x = (lon - lon0) * lon_scale
            z = -(lat - lat0) * lat_scale
            y = height
            min_x = min(min_x, x)
            max_x = max(max_x, x)
            min_y = min(min_y, y)
            max_y = max(max_y, y)
            min_z = min(min_z, z)
            max_z = max(max_z, z)
            flat.extend((x, y, z))
        converted.append(flat)

    bounds = {
        "min": [min_x, min_y, min_z],
        "max": [max_x, max_y, max_z],
    }
    return converted, bounds


def main() -> None:
    parser = argparse.ArgumentParser(description=__doc__)
    parser.add_argument("src", type=Path, help="Directory that contains CityGML files")
    parser.add_argument("dest", type=Path, help="Output JSON path")
    parser.add_argument("--limit", type=int, default=12, help="Maximum number of GML files to include")
    args = parser.parse_args()

    gml_files = sorted(Path(args.src).glob("*.gml"))
    if args.limit:
        gml_files = gml_files[: args.limit]

    all_triangles: List[List[Tuple[float, float, float]]] = []
    lats: List[float] = []
    lons: List[float] = []
    for gml_file in gml_files:
        triangles = extract_triangles(gml_file)
        if not triangles:
            continue
        for tri in triangles:
            for lat, lon, _ in tri:
                lats.append(lat)
                lons.append(lon)
        all_triangles.extend(triangles)

    if not all_triangles:
        raise SystemExit("No triangles could be extracted from the provided GML files")

    lat0 = sum(lats) / len(lats)
    lon0 = sum(lons) / len(lons)

    converted, bounds = convert_coordinates(all_triangles, lat0, lon0)

    args.dest.parent.mkdir(parents=True, exist_ok=True)
    with args.dest.open("w", encoding="utf-8") as fh:
        json.dump(
            {
                "origin": {"lat": lat0, "lon": lon0},
                "triangles": converted,
                "bounds": bounds,
                "metadata": {
                    "source_files": [f.name for f in gml_files],
                    "lat_scale_m_per_deg": degrees_to_meters_converter(lat0)[0],
                    "lon_scale_m_per_deg": degrees_to_meters_converter(lat0)[1],
                },
            },
            fh,
            ensure_ascii=False,
            indent=2,
        )


if __name__ == "__main__":
    main()
