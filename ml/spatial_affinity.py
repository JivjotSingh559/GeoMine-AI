"""
GeoMine AI — Spatial Affinity Engine (Pathway A)
================================================
Calculates spatial proximity / affinity index (0–100) based on Haversine
distance to historical mineral exploration reference sites.

Scientific Principles:
- Models spatial similarity to verified historical exploration blocks.
- Explicitly distinct from occurrence probability (no true absence data exists).
- Manganese is flagged with an explicit insufficient-data response (only 1 site).
- Iron Ore (6 sites, 505 locs), Limestone (4 sites, 47 locs), and Bauxite (3 sites, 196 locs)
  are supported with explicit confidence and evidence disclosure.
"""
from pathlib import Path
import math
import numpy as np
import pandas as pd

EARTH_RADIUS_KM = 6371.0
DEFAULT_BANDWIDTH_KM = 50.0  # Regional geological basin/craton scale

# Canonical exploration block names transcribed from Geological Survey of India reports
CANONICAL_SITE_NAMES = {
    "ALENGA-NENDWADI": "Alenga-Nendwadi Iron Ore Block",
    "ANAJI-KIOCL-27": "Anaji Base Metal Block",
    "DUMARGUDA": "Dumarguda Bauxite Block",
    "GILANGUDA-PADUR": "Gilanguda-Padur Iron Ore Block",
    "GOVINDPUR-W-SN": "Govindpur Tungsten-Tin Block",
    "KARIMNAGAR-MOLYBDENITE": "Sporadic Molybdenite Occurrences, Karimnagar",
    "MARAMPALLI-JINJGAON": "Marampalli-Jinjgaon Iron Ore Block",
    "MURWADA-TUMARIKODI": "Murwada-Tumarikodi Iron Ore Block",
    "MUTYALAMPADU-TANGEDA": "Mutyalampadu-Tangeda Limestone Block",
    "OBALAPURA-KIOCL-28": "Obalapura Base Metal Block",
    "PARPATIA": "Parpatia Bauxite Block",
    "PIMPERKUNTA-MN-G3": "Pimperkunta Manganese Block",
    "RAGHUNATHAPALEM-C3": "Raghunathapalem Cluster-3 Limestone Block",
    "RAMAPURAM": "Ramapuram Limestone Block",
    "TADGAON-WATELI": "Tadgaon-Wateli Iron Ore Block",
    "TADGAON-WATELI-G4": "Tadgaon-Wateli G4 Iron Ore Block",
    "TANGEDA": "Tangeda Limestone Block",
    "TARHAPANI-WEST": "Tarhapani (West) Bauxite Block",
}


def haversine_vectorized(lat1: float, lon1: float, lats: np.ndarray, lons: np.ndarray) -> np.ndarray:
    """
    Compute great-circle distances in kilometers between a query point (lat1, lon1)
    and an array of reference points (lats, lons).
    """
    phi1 = math.radians(lat1)
    lam1 = math.radians(lon1)
    phi2 = np.radians(lats)
    lam2 = np.radians(lons)

    dphi = phi2 - phi1
    dlam = lam2 - lam1

    a = np.sin(dphi / 2.0) ** 2 + np.cos(phi1) * np.cos(phi2) * (np.sin(dlam / 2.0) ** 2)
    # Clip to avoid float precision domain error with arcsin
    a = np.clip(a, 0.0, 1.0)
    c = 2.0 * np.arcsin(np.sqrt(a))
    return EARTH_RADIUS_KM * c


def categorize_mineral(mineral_str: str) -> str:
    """Standardize user input into one of the known mineral categories."""
    if not mineral_str or not isinstance(mineral_str, str):
        return "Unknown"
    m_clean = mineral_str.strip().lower().replace("_", " ").replace("-", " ")
    if "bauxite" in m_clean:
        return "Bauxite"
    elif "iron" in m_clean:
        return "Iron Ore"
    elif "manganese" in m_clean:
        return "Manganese"
    elif "limestone" in m_clean or "lime" in m_clean:
        return "Limestone"
    else:
        return "Other"


class SpatialAffinityEngine:
    """
    Spatial Affinity / Similarity Engine for GeoMine AI.
    Loads historical exploration locations and calculates spatial proximity scores.
    """

    def __init__(self, data_path: Path | str = None):
        if data_path is None:
            # Fallback priority: preprocessed file -> raw training clean file
            base = Path(__file__).resolve().parent.parent
            prep_file = base / "ml" / "data" / "geomine_location_occurrence_preprocessed.csv"
            raw_file = base / "data" / "GeoMineAI_Final_Model_Training_Clean_v1.csv"
            data_path = prep_file if prep_file.exists() else raw_file

        self.data_path = Path(data_path)
        if not self.data_path.exists():
            raise FileNotFoundError(f"Reference dataset not found at: {self.data_path}")

        self._load_and_index()

    def _load_and_index(self):
        """Index unique coordinate locations by mineral group and site_id."""
        df_raw = pd.read_csv(self.data_path, low_memory=False)

        # Ensure required columns
        for col in ["latitude", "longitude"]:
            df_raw[col] = pd.to_numeric(df_raw[col], errors="coerce")

        df_clean = df_raw.dropna(subset=["latitude", "longitude"]).copy()
        df_clean = df_clean[
            df_clean["latitude"].between(-90, 90) & df_clean["longitude"].between(-180, 180)
        ]

        if "mineral_group" not in df_clean.columns:
            df_clean["mineral_group"] = df_clean["target_mineral"].apply(categorize_mineral)

        # Group to distinct (site_id, latitude, longitude)
        cols_present = df_clean.columns.tolist()
        group_cols = ["mineral_group", "site_id", "latitude", "longitude"]
        agg_dict = {}
        for c in ["site_name", "state", "district"]:
            if c in cols_present:
                agg_dict[c] = "first"

        if agg_dict:
            loc_df = df_clean.groupby(group_cols, as_index=False).agg(agg_dict)
        else:
            loc_df = df_clean.drop_duplicates(subset=group_cols)[group_cols]

        if "site_name" not in loc_df.columns:
            loc_df["site_name"] = loc_df["site_id"].map(lambda sid: CANONICAL_SITE_NAMES.get(sid, sid))
        else:
            loc_df["site_name"] = loc_df.apply(
                lambda r: r["site_name"] if pd.notna(r.get("site_name")) and str(r.get("site_name")).strip() else CANONICAL_SITE_NAMES.get(r["site_id"], r["site_id"]),
                axis=1
            )

        self.locations_df = loc_df

        # Pre-cache arrays by mineral group for fast vector operations
        self.mineral_cache = {}
        self.site_metadata = {}

        for mg, group in loc_df.groupby("mineral_group"):
            sites_summary = []
            for site_id, s_grp in group.groupby("site_id"):
                first_row = s_grp.iloc[0]
                s_name = str(first_row.get("site_name") or CANONICAL_SITE_NAMES.get(site_id, site_id))
                s_state = str(first_row.get("state") or "Unknown")
                s_dist = str(first_row.get("district") or "Unknown")
                sites_summary.append({
                    "site_id": str(site_id),
                    "site_name": s_name,
                    "state": s_state,
                    "district": s_dist,
                    "point_count": int(len(s_grp)),
                    "center_lat": float(s_grp["latitude"].median()),
                    "center_lon": float(s_grp["longitude"].median()),
                })

            self.site_metadata[mg] = sites_summary
            self.mineral_cache[mg] = {
                "lats": group["latitude"].to_numpy(dtype=float),
                "lons": group["longitude"].to_numpy(dtype=float),
                "site_ids": group["site_id"].to_numpy(dtype=object),
                "site_names": group["site_name"].to_numpy(dtype=object),
                "states": group["state"].to_numpy(dtype=object) if "state" in group else np.array(["Unknown"] * len(group)),
                "districts": group["district"].to_numpy(dtype=object) if "district" in group else np.array(["Unknown"] * len(group)),
                "total_points": len(group),
                "total_sites": len(sites_summary),
            }

    def compute_affinity(
        self,
        mineral: str,
        latitude: float,
        longitude: float,
        bandwidth_km: float = DEFAULT_BANDWIDTH_KM,
    ) -> dict:
        """
        Calculate spatial affinity score (0–100) for a given mineral and coordinate.
        """
        # Validate coordinates
        try:
            lat = float(latitude)
            lon = float(longitude)
        except (ValueError, TypeError):
            raise ValueError("Latitude and longitude must be valid numeric floating-point values.")

        if not (-90.0 <= lat <= 90.0):
            raise ValueError(f"Latitude {lat} is out of bounds. Must be between -90.0 and 90.0.")
        if not (-180.0 <= lon <= 180.0):
            raise ValueError(f"Longitude {lon} is out of bounds. Must be between -180.0 and 180.0.")

        mineral_group = categorize_mineral(mineral)

        # ── Case 1: Manganese (Explicit Insufficient Data) ────────────────
        if mineral_group == "Manganese":
            cache = self.mineral_cache.get("Manganese", {})
            total_sites = cache.get("total_sites", 1)
            total_points = cache.get("total_points", 26)
            sites_meta = self.site_metadata.get("Manganese", [])
            site_info = sites_meta[0] if sites_meta else {
                "site_id": "PIMPERKUNTA-MN-G3",
                "site_name": "Pimperkunta Manganese Block",
                "state": "Telangana",
                "district": "Adilabad"
            }

            return {
                "status": "insufficient_data",
                "mineral": "Manganese",
                "affinity_score": None,
                "score_tier": "Insufficient Reference Sites",
                "distance_km": None,
                "coordinates": {"latitude": lat, "longitude": lon},
                "reference_sites_count": total_sites,
                "reference_locations_count": total_points,
                "message": (
                    "Insufficient independent historical reference sites to calculate a meaningful "
                    "spatial affinity score."
                ),
                "scientific_interpretation": (
                    f"The historical exploration archive contains only {total_sites} reference site "
                    f"({site_info.get('site_name', 'Pimperkunta')} in {site_info.get('district')}, {site_info.get('state')}; "
                    f"{total_points} coordinate records). Calculating spatial similarity from a single isolated deposit "
                    "lacks geographic diversity and would produce scientifically ungeneralizable predictions."
                ),
                "limitation_disclosure": (
                    "Single-site spatial interpolation is prone to false regional confidence. Additional independent "
                    "historical survey blocks are required before activating spatial affinity scoring for Manganese."
                ),
                "methodology": "Pathway A: Spatial Affinity / Similarity Index",
                "nearest_site": {
                    "site_id": site_info.get("site_id"),
                    "site_name": site_info.get("site_name"),
                    "state": site_info.get("state"),
                    "district": site_info.get("district"),
                }
            }

        # ── Case 2: Unsupported Mineral ──────────────────────────────────
        if mineral_group not in self.mineral_cache or mineral_group == "Other":
            supported = ["Iron Ore", "Limestone", "Bauxite", "Manganese"]
            raise ValueError(
                f"Mineral '{mineral}' is not supported for Spatial Affinity analysis. "
                f"Supported minerals: {', '.join(supported)}."
            )

        # ── Case 3: Supported Minerals (Iron Ore, Limestone, Bauxite) ────
        cache = self.mineral_cache[mineral_group]
        lats = cache["lats"]
        lons = cache["lons"]
        site_ids = cache["site_ids"]
        site_names = cache["site_names"]
        states = cache["states"]
        districts = cache["districts"]
        total_sites = cache["total_sites"]
        total_points = cache["total_points"]

        # Vectorized Haversine distance to all points of this mineral
        distances = haversine_vectorized(lat, lon, lats, lons)
        min_idx = int(np.argmin(distances))
        min_distance = float(distances[min_idx])

        nearest_site_id = str(site_ids[min_idx])
        nearest_site_name = str(site_names[min_idx])
        nearest_state = str(states[min_idx])
        nearest_district = str(districts[min_idx])
        nearest_lat = float(lats[min_idx])
        nearest_lon = float(lons[min_idx])

        # Exponential decay scoring formula: Score = 100 * exp(-d / bandwidth)
        score = 100.0 * math.exp(-min_distance / float(bandwidth_km))
        score_clamped = max(0.0, min(100.0, score))
        score_rounded = round(score_clamped, 1)

        # Tier classification
        if score_rounded >= 80.0:
            tier = "Very High Spatial Proximity"
        elif score_rounded >= 60.0:
            tier = "High Spatial Proximity"
        elif score_rounded >= 35.0:
            tier = "Moderate Spatial Proximity"
        elif score_rounded >= 10.0:
            tier = "Low Spatial Proximity"
        else:
            tier = "Distal / Negligible Proximity"

        # Evidence & confidence level based on site sample size
        if mineral_group == "Iron Ore":
            confidence = "High (6 verified exploration blocks, 505 reference locations)"
            data_caveat = (
                "Iron ore reference dataset has robust geographic representation across the "
                "Gadchiroli iron ore belt (Maharashtra)."
            )
        elif mineral_group == "Limestone":
            confidence = "Moderate (4 verified exploration blocks, 47 reference locations)"
            data_caveat = (
                "Limestone reference dataset covers the Palnad/Kurnool sub-basin (Andhra Pradesh & Telangana)."
            )
        else:  # Bauxite
            confidence = "Moderate-Low (3 verified exploration blocks, 196 reference locations)"
            data_caveat = (
                "Bauxite reference sites are geographically concentrated on specific lateritic plateaus in "
                "Surguja (Chhattisgarh) and Koraput (Odisha). High scores indicate spatial proximity to these "
                "known plateaus, not discovery in unexamined terrains."
            )

        # Per-site distance breakdown
        site_breakdown = []
        for site_info in self.site_metadata.get(mineral_group, []):
            s_id = site_info["site_id"]
            mask = (site_ids == s_id)
            if np.any(mask):
                s_min_dist = float(np.min(distances[mask]))
                site_breakdown.append({
                    "site_id": s_id,
                    "site_name": site_info["site_name"],
                    "state": site_info["state"],
                    "district": site_info["district"],
                    "point_count": site_info["point_count"],
                    "min_distance_km": round(s_min_dist, 2),
                })
        site_breakdown.sort(key=lambda x: x["min_distance_km"])

        return {
            "status": "success",
            "mineral": mineral_group,
            "affinity_score": score_rounded,
            "score_tier": tier,
            "distance_km": round(min_distance, 2),
            "bandwidth_km": float(bandwidth_km),
            "coordinates": {"latitude": lat, "longitude": lon},
            "reference_sites_count": total_sites,
            "reference_locations_count": total_points,
            "nearest_site": {
                "site_id": nearest_site_id,
                "site_name": nearest_site_name,
                "state": nearest_state,
                "district": nearest_district,
                "latitude": round(nearest_lat, 5),
                "longitude": round(nearest_lon, 5),
            },
            "site_proximity_breakdown": site_breakdown,
            "evidence_confidence": confidence,
            "scientific_interpretation": (
                f"This Spatial Affinity Score ({score_rounded}/100) measures mathematical proximity to "
                f"known historical exploration locations for {mineral_group}. It reflects geographic "
                "similarity to surveyed exploration ground, NOT an occurrence probability or confirmation "
                "of mineral presence."
            ),
            "limitation_disclosure": (
                "The underlying dataset transcribes positive historical exploration surveys. True geological "
                "absences were not recorded. Prospective mineralized formations outside historical survey "
                "polygons naturally yield low spatial affinity scores."
            ),
            "data_caveat": data_caveat,
            "methodology": "Pathway A: Spatial Affinity / Exponential Distance Decay (d0 = 50 km)",
        }
