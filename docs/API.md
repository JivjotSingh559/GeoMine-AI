# GeoMine AI — REST API Reference Specification

> **RESTful Web Services Documentation**  
> *Flask backend service running on default host `http://127.0.0.1:5000`.*

---

## 1. Overview & Conventions

The GeoMine AI API provides lightweight, high-performance read-only endpoints to query the in-memory geochemical exploration dataset. 

- **Data Protocol**: JSON over HTTP (`Content-Type: application/json; charset=utf-8`).
- **HTTP Methods**: All analytical endpoints accept `GET` requests.
- **Coordinate System**: All geographic coordinates are expressed in decimal degrees under the **WGS84 (EPSG:4326)** datum.
- **Error Format**: JSON response containing an `"error"` message key with appropriate HTTP status codes (e.g., `404 Not Found`).

---

## 2. Endpoints Summary

| Method | Endpoint | Description |
|---|---|---|
| `GET` | `/` | Web GIS Dashboard application interface (`text/html`). |
| `GET` | `/api/summary` | Global dataset statistics (record, site, commodity, and state counts). |
| `GET` | `/api/minerals` | Alphabetically sorted list of all unique target mineral commodities. |
| `GET` | `/api/sites` | Filtered list of exploration sites with median coordinates and metadata. |
| `GET` | `/api/site/<site_id>` | Detailed site dossier with aggregated assay distributions and source documents. |

---

## 3. Endpoint Reference

### 3.1 Get System Summary Metrics

```http
GET /api/summary
```

Returns aggregate dataset statistics computed across all valid records.

#### Response (200 OK)
```json
{
  "minerals": 10,
  "records": 32562,
  "sites": 18,
  "states": 7
}
```

#### Field Specifications
- `minerals` (*integer*): Count of unique target mineral categories represented.
- `records` (*integer*): Total count of non-null, spatially bounded sample assay records.
- `sites` (*integer*): Count of distinct exploration block groupings (`site_id`).
- `states` (*integer*): Number of unique Indian states covered.

---

### 3.2 List Mineral Commodities

```http
GET /api/minerals
```

Retrieves an alphabetically sorted array of all mineral categories present in the active dataset.

#### Response (200 OK)
```json
[
  "Base metal",
  "Bauxite",
  "Bauxite and rare earth elements",
  "Iron ore",
  "Iron ore and associated major oxides",
  "Limestone",
  "Manganese ore",
  "Molybdenite and associated elements",
  "Molybdenite and associated pathfinder elements",
  "Tungsten and tin"
]
```

---

### 3.3 Query Exploration Sites

```http
GET /api/sites?mineral={category}&q={searchQuery}
```

Retrieves exploration site clusters matching the specified mineral category and optional search term. Coordinates returned represent the **spatial median** of all borehole and sample coordinates associated with that `site_id`.

#### Query Parameters

| Parameter | Type | Required | Default | Description |
|---|---|:---:|---|---|
| `mineral` | String | No | `"all"` | Filter by exact `target_mineral` string, or `"all"` for unfiltered. |
| `q` | String | No | `""` | Case-insensitive substring match against `site_name`, `state`, or `district`. |

#### Example Request
```bash
curl -X GET "http://127.0.0.1:5000/api/sites?mineral=Bauxite&q=Chhattisgarh"
```

#### Response (200 OK)
```json
[
  {
    "district": "Surguja",
    "latitude": 23.362143055555557,
    "longitude": 83.47355138888888,
    "minerals": [
      "Bauxite"
    ],
    "record_count": 75,
    "site_id": "DUMARGUDA",
    "site_name": "Dumarguda Bauxite Block",
    "state": "Chhattisgarh"
  },
  {
    "district": "Surguja",
    "latitude": 23.47321527777778,
    "longitude": 83.33644444444444,
    "minerals": [
      "Bauxite"
    ],
    "record_count": 3342,
    "site_id": "PARPATIA",
    "site_name": "Parpatia Bauxite Block",
    "state": "Chhattisgarh"
  }
]
```

---

### 3.4 Get Detailed Site Dossier & Assay Distribution

```http
GET /api/site/<site_id>
```

Retrieves comprehensive geological metadata, aggregated geochemical assay summaries (mean, min, max, count per analyte and unit), and source document citations for a specified site.

#### URL Parameters

| Parameter | Type | Description |
|---|---|---|
| `site_id` | String | Unique machine-readable identifier of the exploration site (e.g. `PARPATIA`, `ALENGA-NENDWADI`). |

#### Example Request
```bash
curl -X GET "http://127.0.0.1:5000/api/site/PARPATIA"
```

#### Response (200 OK)
```json
{
  "site_id": "PARPATIA",
  "site_name": "Parpatia Bauxite Block",
  "state": "Chhattisgarh",
  "district": "Surguja",
  "record_count": 3552,
  "latitude": 23.47321527777778,
  "longitude": 83.33644444444444,
  "minerals": [
    "Bauxite",
    "Bauxite and rare earth elements"
  ],
  "assays": [
    {
      "analyte": "Al2O3",
      "count": 1114,
      "max": 59.84,
      "mean": 45.1824,
      "min": 24.12,
      "unit": "%"
    },
    {
      "analyte": "Ce",
      "count": 15,
      "max": 624.0,
      "mean": 218.4667,
      "min": 45.0,
      "unit": "ppm"
    },
    {
      "analyte": "Fe2O3",
      "count": 1114,
      "max": 38.65,
      "mean": 18.2391,
      "min": 4.12,
      "unit": "%"
    },
    {
      "analyte": "SiO2",
      "count": 1114,
      "max": 28.91,
      "mean": 6.8415,
      "min": 1.25,
      "unit": "%"
    }
  ],
  "sources": [
    "Parpatia-G3-Bauxite-Chhattisgarh.pdf"
  ]
}
```

#### Error Response (404 Not Found)
When an unknown or invalid `site_id` is supplied:
```json
{
  "error": "Site not found"
}
```


---

## 7. Spatial Affinity Engine API (Pathway A)

> **Added in Phase 4.** Integrates the Spatial Affinity / Similarity Index engine. All endpoints explicitly label results as spatial proximity scores, never as occurrence probabilities.

---

### 7.1 POST `/api/predict/affinity`

Computes the **Spatial Affinity Score** (0–100) for a given coordinate and target mineral using exponential Haversine distance decay over verified historical exploration reference blocks.

**Method:** `POST`  
**Content-Type:** `application/json`

#### Request Body

| Parameter | Type | Required | Description |
|---|---|---|---|
| `mineral` | `string` | ✅ Yes | Target mineral: `"Iron Ore"`, `"Limestone"`, `"Bauxite"`, `"Manganese"` |
| `latitude` | `float` or `lat` alias | ✅ Yes | WGS84 decimal latitude. Range: `[-90.0, 90.0]` |
| `longitude` | `float` or `lon` alias | ✅ Yes | WGS84 decimal longitude. Range: `[-180.0, 180.0]` |
| `bandwidth_km` | `float` | ⬜ Optional | Decay bandwidth in km (default: `50.0`) |

#### Successful Response (Iron Ore, Limestone, Bauxite)

**HTTP 200 OK**

```json
{
  "status": "success",
  "mineral": "Iron Ore",
  "affinity_score": 99.9,
  "score_tier": "Very High Spatial Proximity",
  "distance_km": 0.04,
  "bandwidth_km": 50.0,
  "coordinates": { "latitude": 19.524, "longitude": 80.418 },
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
  "site_proximity_breakdown": [
    { "site_id": "ALENGA-NENDWADI", "site_name": "...", "min_distance_km": 0.04, "point_count": 70 },
    "..."
  ],
  "evidence_confidence": "High (6 verified exploration blocks, 505 reference locations)",
  "scientific_interpretation": "This Spatial Affinity Score (99.9/100) measures mathematical proximity to known historical exploration locations for Iron Ore. It reflects geographic similarity to surveyed exploration ground, NOT an occurrence probability or confirmation of mineral presence.",
  "limitation_disclosure": "...",
  "data_caveat": "...",
  "methodology": "Pathway A: Spatial Affinity / Exponential Distance Decay (d0 = 50 km)"
}
```

#### Manganese Response (Insufficient Data)

**HTTP 200 OK** — Manganese is acknowledged but cannot be scored.

```json
{
  "status": "insufficient_data",
  "mineral": "Manganese",
  "affinity_score": null,
  "score_tier": "Insufficient Reference Sites",
  "distance_km": null,
  "coordinates": { "latitude": 19.5, "longitude": 78.5 },
  "reference_sites_count": 1,
  "reference_locations_count": 26,
  "message": "Insufficient independent historical reference sites to calculate a meaningful spatial affinity score.",
  "scientific_interpretation": "...",
  "limitation_disclosure": "...",
  "nearest_site": { "site_id": "PIMPERKUNTA-MN-G3", "site_name": "Pimperkunta Manganese Block", ... }
}
```

#### Error Responses

| Status | Trigger |
|---|---|
| `400` | Missing `mineral` parameter |
| `400` | Missing `latitude` or `longitude` |
| `400` | Non-numeric coordinate values |
| `400` | Latitude outside `[-90, 90]` or longitude outside `[-180, 180]` |
| `400` | Unsupported mineral name (Gold, Copper, Diamond, etc.) |
| `500` | Internal calculation error |

---

### 7.2 GET `/api/spatial-affinity`

Alias route that accepts the same parameters as `POST /api/predict/affinity` via query string.

**Method:** `GET` or `POST`

#### Query Parameters

```
GET /api/spatial-affinity?mineral=Iron+Ore&lat=19.524&lon=80.418
```

| Parameter | Aliases | Type |
|---|---|---|
| `mineral` | — | string |
| `latitude` | `lat` | float |
| `longitude` | `lon` | float |
| `bandwidth_km` | — | float (optional) |

---

### 7.3 GET `/api/predict/reference-summary`

Returns a metadata summary of the historical reference blocks used by the Spatial Affinity Engine.

**HTTP 200 OK**

```json
{
  "engine": "GeoMine Spatial Affinity Engine (Pathway A)",
  "methodology": "Exponential Distance Decay over Verified Historical Exploration Points",
  "default_bandwidth_km": 50.0,
  "minerals": {
    "Iron Ore":    { "status": "active", "site_count": 6, "location_count": 505, "geographic_focus": "Gadchiroli Iron Ore Belt, Maharashtra" },
    "Limestone":   { "status": "active", "site_count": 4, "location_count": 47, "geographic_focus": "Palnad / Kurnool Sub-basin, Andhra Pradesh & Telangana" },
    "Bauxite":     { "status": "active", "site_count": 3, "location_count": 196, "geographic_focus": "Lateritic Plateaus, Surguja & Koraput" },
    "Manganese":   { "status": "insufficient_data", "site_count": 1, "location_count": 26, "reason": "Single-site archive lacks geographic diversity" }
  }
}
```

---

### Score Tier Reference

| Score | Tier |
|---|---|
| 80–100 | Very High Spatial Proximity |
| 60–79 | High Spatial Proximity |
| 35–59 | Moderate Spatial Proximity |
| 10–34 | Low Spatial Proximity |
| 0–9 | Distal / Negligible Proximity |

### Methodology Formula

```
Score = 100 × exp(−d_min / d₀)
```

Where `d_min` = site-grouped minimum Haversine distance (km), `d₀` = 50 km bandwidth.
