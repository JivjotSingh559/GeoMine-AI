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
