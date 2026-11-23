"""
GeoMine AI - Stage 2: Data Audit and Preprocessing
==================================================
Creates clean, location-aggregated datasets without data leakage
from the raw historical exploration CSV.
"""
from pathlib import Path
import pandas as pd

PROJECT_ROOT = Path(__file__).resolve().parent.parent.parent
RAW_CSV_PATH = PROJECT_ROOT / "data" / "GeoMineAI_Final_Model_Training_Clean_v1.csv"
OUTPUT_DIR = Path(__file__).resolve().parent.parent / "data"

def categorize_mineral(m: str) -> str:
    m_lower = str(m).lower()
    if "bauxite" in m_lower:
        return "Bauxite"
    elif "iron ore" in m_lower:
        return "Iron Ore"
    elif "manganese" in m_lower:
        return "Manganese"
    elif "limestone" in m_lower:
        return "Limestone"
    else:
        return "Other"

def main():
    print(f"Reading raw data from: {RAW_CSV_PATH}")
    df = pd.read_csv(RAW_CSV_PATH, low_memory=False)
    print(f"Loaded {len(df)} rows across {df['site_id'].nunique()} sites.")

    df["mineral_group"] = df["target_mineral"].apply(categorize_mineral)

    # Aggregate to unique location (latitude, longitude, site_id) level
    loc_df = df.groupby(["site_id", "latitude", "longitude"]).agg(
        mineral_group=("mineral_group", "first"),
        target_mineral=("target_mineral", "first"),
        state=("state", "first"),
        district=("district", "first"),
        assay_record_count=("record_id", "count")
    ).reset_index()

    # Binary occurrence labels for each target mineral
    for mineral in ["Iron Ore", "Limestone", "Bauxite", "Manganese"]:
        col_name = f"target_{mineral.lower().replace(' ', '_')}"
        loc_df[col_name] = (loc_df["mineral_group"] == mineral).astype(int)

    OUTPUT_DIR.mkdir(parents=True, exist_ok=True)
    out_csv = OUTPUT_DIR / "geomine_location_occurrence_preprocessed.csv"
    loc_df.to_csv(out_csv, index=False)
    print(f"Saved preprocessed location dataset ({len(loc_df)} rows) to: {out_csv}")

    # Summary table
    print("\n--- Summary by Mineral Group ---")
    summary = loc_df.groupby("mineral_group").agg(
        sites=("site_id", "nunique"),
        locations=("latitude", "count"),
        total_assay_rows=("assay_record_count", "sum")
    ).reset_index()
    print(summary.to_string(index=False))

if __name__ == "__main__":
    main()
