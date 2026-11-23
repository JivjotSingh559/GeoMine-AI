# GeoMine AI — README

<p align="center">
  <img src="docs/assets/geomine-logo.svg" alt="GeoMine AI Logo" width="80"/>
</p>

<h2 align="center">GeoMine AI</h2>
<p align="center"><strong>AI-Powered Mineral Exploration Intelligence Platform</strong></p>
<p align="center">
  Flask + Leaflet + XGBoost (Experimental) · Spatial Affinity Engine (Pathway A) · GSI Dataset
</p>

---

## Overview

GeoMine AI is an intelligent geological exploration platform built over verified Indian mineral survey data from the Geological Survey of India (GSI). It transforms raw assay records into an interactive intelligence portal with 4 fully-designed professional pages, a Leaflet-based geospatial map, analytical dashboards, report generation, and a scientifically-grounded Spatial Affinity Engine.

---

## Features

### Pages
| Page | Description |
|---|---|
| **Dashboard** | Platform overview: live statistics, mineral distribution charts, mineral coverage map, regional summary, data timeline |
| **Explore Sites** | Interactive site browser: grid/map/split views, mineral chip filters, advanced sidebar filters, site detail drawer with assay tabs, **Spatial Affinity Probe** |
| **Analytics** | Deep data analysis: analyte distributions, site comparisons, state summaries, heatmaps, top analytes |
| **Reports** | Configurable exploration dossier generator: multi-section PDF-ready reports, CSV export, source citation |

### Spatial Affinity Engine (Pathway A)
The core ML feature is a **Spatial Affinity / Similarity Index** that:
- Computes Haversine distance from any query coordinate to 1,069 historical exploration point records
- Groups by site_id to prevent spatial dominance by high-density blocks
- Applies exponential decay: `Score = 100 × exp(-d_min / 50 km)`
- Returns a **0–100 Spatial Affinity Score** (never called "occurrence probability")
- Integrates directly into the Explore Sites page via map click or manual input

#### Supported Minerals

| Mineral | Status | Sites | Reference Locations | Evidence Level |
|---|---|---|---|---|
| **Iron Ore** | ✅ Active | 6 | 505 | High |
| **Limestone** | ✅ Active | 4 | 47 | Moderate |
| **Bauxite** | ✅ Active | 3 | 196 | Moderate-Low (Clustered) |
| **Manganese** | ⚠️ Insufficient Data | 1 | 26 | Refrains from scoring |

> **Scientific Disclosure:** The Spatial Affinity Score measures mathematical proximity to known historical exploration locations. It is NOT an occurrence probability, discovery confirmation, or deposit prediction. The underlying dataset contains only positive exploration surveys; true geological absences were not recorded.

---

## Project Structure

```
GeoMineAI_Website_v1/
├── app.py                              # Flask application entry point
├── requirements.txt
├── README.md
│
├── data/
│   └── GeoMineAI_Final_Model_Training_Clean_v1.csv   # 32,562 rows, 18 exploration sites
│
├── ml/
│   ├── spatial_affinity.py             # Spatial Affinity Engine (Pathway A) ← MAIN ML MODULE
│   ├── data/
│   │   └── geomine_location_occurrence_preprocessed.csv   # 1,069 unique locations
│   ├── models/                         # Experimental XGBoost artifacts (not integrated)
│   │   ├── xgboost_bauxite_occurrence.joblib
│   │   ├── xgboost_iron_ore_occurrence.joblib
│   │   └── xgboost_limestone_occurrence.joblib
│   ├── reports/                        # XGBoost evaluation reports (audit only)
│   └── scripts/
│       ├── preprocess.py
│       └── train.py
│
├── templates/
│   ├── base.html
│   ├── dashboard.html
│   ├── explore.html                    # Spatial Affinity Probe integrated
│   ├── analytics.html
│   └── reports.html
│
├── static/
│   ├── css/
│   │   ├── design-system.css
│   │   ├── nav.css
│   │   ├── dashboard.css
│   │   ├── explore.css                 # Probe pin animations and affinity card styles
│   │   ├── analytics.css
│   │   └── reports.css
│   └── js/
│       ├── shared.js
│       ├── dashboard.js
│       ├── explore.js                  # Map click handler + Spatial Affinity UI
│       ├── analytics.js
│       └── reports.js
│
├── tests/
│   ├── test_spatial_affinity.py        # 20-test automated test suite (all passing ✅)
│   └── simulate_flow.py               # End-to-end flow simulation
│
└── docs/
    ├── API.md
    ├── ARCHITECTURE.md
    ├── DATASET.md
    └── assets/
        ├── geomine-logo.svg
        ├── geomine-banner.svg
        ├── geomine-overview.svg
        ├── geomine-site-detail.svg
        └── geomine-bauxite-filter.svg
```

---

## Run Locally (Windows)

> **Important:** Two virtual environments exist. Flask runs under `.venv-1`.

```powershell
# 1. Activate the Flask environment
.\.venv-1\Scripts\activate

# 2. Install dependencies (if not already done)
pip install -r requirements.txt

# 3. Start the application
python app.py
```

Open **http://127.0.0.1:5000** in your browser.

> Internet required for Leaflet tiles (CartoDB Voyager) and Google Fonts CDN.

---

## API Quick Reference

| Method | Endpoint | Description |
|---|---|---|
| `GET` | `/api/summary` | Global dataset statistics |
| `GET` | `/api/minerals` | List of unique mineral commodities |
| `GET` | `/api/mineral-counts` | Site count per mineral category |
| `GET` | `/api/sites` | Filtered site list with coordinates and metadata |
| `GET` | `/api/site/<site_id>` | Full site dossier with assay distributions |
| `GET` | `/api/filter-options` | Available filter values for dropdowns |
| `POST` | `/api/predict/affinity` | **Spatial Affinity Score** for a coordinate+mineral |
| `GET` | `/api/spatial-affinity` | Spatial Affinity Score (GET alias, same params) |
| `GET` | `/api/predict/reference-summary` | Reference block metadata for all 4 minerals |
| `GET` | `/api/external/sources` | Geoscience data authority registry |
| `GET` | `/api/external/geology` | Regional geological context for coordinates |

### Spatial Affinity API — Example

**Request:**
```http
POST /api/predict/affinity
Content-Type: application/json

{
  "mineral": "Iron Ore",
  "latitude": 19.524,
  "longitude": 80.418
}
```

**Response (success):**
```json
{
  "status": "success",
  "mineral": "Iron Ore",
  "affinity_score": 99.9,
  "score_tier": "Very High Spatial Proximity",
  "distance_km": 0.04,
  "reference_sites_count": 6,
  "reference_locations_count": 505,
  "nearest_site": {
    "site_id": "ALENGA-NENDWADI",
    "site_name": "Alenga-Nendwadi Iron Ore Block",
    "state": "Maharashtra",
    "district": "Gadchiroli",
    "latitude": 19.52409,
    "longitude": 80.41841
  },
  "scientific_interpretation": "...",
  "limitation_disclosure": "..."
}
```

**Response (Manganese — Insufficient Data):**
```json
{
  "status": "insufficient_data",
  "mineral": "Manganese",
  "affinity_score": null,
  "message": "Insufficient independent historical reference sites to calculate a meaningful spatial affinity score.",
  "reference_sites_count": 1,
  "reference_locations_count": 26
}
```

---

## Design System

The platform uses a custom warm copper geological palette:

| Token | Hex | Usage |
|---|---|---|
| `--bg-primary` | `#171513` | Page background |
| `--bg-secondary` | `#211D19` | Section backgrounds |
| `--bg-card` | `#29231F` | Card surfaces |
| `--bg-elevated` | `#332922` | Elevated cards |
| `--accent` | `#E98245` | Primary accent (copper) |
| `--accent-bright` | `#FF9557` | Hover states |
| `--text-primary` | `#F5EEE7` | Main text |
| `--text-secondary` | `#B9AAA0` | Secondary text |
| `--border` | `#493A30` | Card borders |

---

## Dataset

| Property | Value |
|---|---|
| Source | Geological Survey of India (GSI) Exploration Bulletins |
| File | `GeoMineAI_Final_Model_Training_Clean_v1.csv` |
| Rows | 32,562 |
| Unique Sites | 18 |
| Unique Locations | 1,069 |
| Minerals | Bauxite, Iron Ore, Limestone, Manganese, Base metal, Molybdenite, Tungsten/Tin |
| States | Maharashtra, Chhattisgarh, Andhra Pradesh, Telangana, Odisha, Karnataka, Madhya Pradesh |

> All records are transcribed directly from official government exploration reports and chemical laboratory tables. Coordinate provenance values marked as "pending verification" in the source dataset should be treated accordingly.

---

## Spatial Affinity — Scientific Methodology

### Formula
$$\text{Score} = 100 \times \exp\left(-\frac{d_{\min}}{d_0}\right)$$

Where:
- $d_{\min}$ = Minimum Haversine distance (km) from query point to any reference coordinate of the target mineral, computed per-site and then minimized across sites
- $d_0 = 50 \text{ km}$ (exponential decay bandwidth, calibrated at regional geological basin/craton scale)

### Score Interpretation

| Score Range | Tier | Meaning |
|---|---|---|
| 80–100 | Very High Spatial Proximity | Very close to known historical exploration blocks |
| 60–79 | High Spatial Proximity | Within regional geological domain |
| 35–59 | Moderate Spatial Proximity | Geologically proximal but not within block vicinity |
| 10–34 | Low Spatial Proximity | Distal to known historical survey zones |
| 0–9 | Distal / Negligible Proximity | Outside any geologically proximate reference zone |

### What the Score Is NOT
- **Not an occurrence probability** — the dataset records only surveyed positives, no verified absences exist
- **Not a discovery prediction** — unexplored ground in high-affinity zones has not been prospected
- **Not a resource estimate** — no JORC/NI 43-101 compliant classification

---

## Tests

```powershell
.\.venv-1\Scripts\python.exe -m unittest tests/test_spatial_affinity.py
```

**20 automated tests — all passing ✅**

| Test Class | Tests | Coverage |
|---|---|---|
| `TestSpatialAffinityEngine` | 10 | Engine init, exact hits, decay monotonicity, distal coords, Manganese, unsupported minerals, boundary edge values, case insensitivity, bandwidth scaling, determinism |
| `TestFlaskSpatialAffinityRoutes` | 7 | POST/GET routes for all 4 minerals, alias routes, validation errors (5 cases), reference summary |
| `TestSystemRegression` | 3 | All 5 HTML pages, all 8+ existing core API endpoints |

---

## Notes

- The `.venv` environment contains XGBoost/scikit-learn (for the experimental Stage 1–3 models); Flask runs under `.venv-1`.
- XGBoost models in `ml/models/` are retained as audit artifacts but are **not integrated** into the API — they were trained without validated true-negative labels and cannot reliably serve as occurrence classifiers.
- The Spatial Affinity Engine uses only standard Python math, NumPy, and Pandas — it runs fully inside `.venv-1` with no extra dependencies.
- Some coordinate values in the source dataset carry "pending verification" provenance notes from the original GSI bulletins.
