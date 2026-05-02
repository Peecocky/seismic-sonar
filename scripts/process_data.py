#!/usr/bin/env python3
"""
Downloads fresh USGS earthquake data and processes it into a compact JSON
that the Next.js app consumes. Run this to refresh the dataset.

Usage:
    python scripts/process_data.py
"""

import json
import urllib.request
import os

USGS_URL = "https://earthquake.usgs.gov/earthquakes/feed/v1.0/summary/4.5_month.geojson"
OUTPUT = "public/data/earthquakes.json"


def main():
    print(f"Fetching {USGS_URL} ...")
    with urllib.request.urlopen(USGS_URL) as response:
        raw = json.loads(response.read().decode())

    features = raw.get("features", [])
    quakes = []
    seen_ids = set()
    for f in features:
        quake_id = f.get("id")
        if quake_id in seen_ids:
            continue
        seen_ids.add(quake_id)

        p = f.get("properties", {})
        geom = f.get("geometry", {}).get("coordinates", [None, None, None])
        lon, lat, depth = geom[0], geom[1], geom[2]
        if lon is None or lat is None:
            continue
        quakes.append({
            "id": quake_id,
            "mag": p.get("mag"),
            "place": p.get("place"),
            "time": p.get("time"),
            "lon": lon,
            "lat": lat,
            "depth": depth if depth is not None else 0,
            "tsunami": p.get("tsunami", 0),
            "felt": p.get("felt"),
            "sig": p.get("sig"),
        })

    # Sort by time ascending for the timeline view
    quakes.sort(key=lambda q: q["time"] or 0)

    os.makedirs(os.path.dirname(OUTPUT), exist_ok=True)
    with open(OUTPUT, "w") as fh:
        json.dump({
            "generated": raw.get("metadata", {}).get("generated"),
            "title": raw.get("metadata", {}).get("title"),
            "count": len(quakes),
            "quakes": quakes,
        }, fh, separators=(",", ":"))
    print(f"Wrote {len(quakes)} quakes to {OUTPUT}")


if __name__ == "__main__":
    main()
