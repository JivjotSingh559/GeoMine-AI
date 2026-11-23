"""
GeoMine AI — Test Suite for Spatial Affinity Engine (Pathway A) & API Routes
===========================================================================
Executes validation tests across:
1. SpatialAffinityEngine math & domain logic
2. Flask API routes (/api/predict/affinity, /api/spatial-affinity)
3. Input validation & error edge cases
4. System regression across existing 15+ routes
"""
import unittest
import math
import sys
from pathlib import Path

ROOT_DIR = Path(__file__).resolve().parent.parent
if str(ROOT_DIR) not in sys.path:
    sys.path.insert(0, str(ROOT_DIR))

from app import app
from ml.spatial_affinity import SpatialAffinityEngine, haversine_vectorized


class TestSpatialAffinityEngine(unittest.TestCase):
    @classmethod
    def setUpClass(cls):
        cls.engine = SpatialAffinityEngine()

    def test_engine_initialization(self):
        """Engine should load reference locations and index supported minerals."""
        self.assertGreater(len(self.engine.locations_df), 1000)
        self.assertIn("Iron Ore", self.engine.mineral_cache)
        self.assertIn("Limestone", self.engine.mineral_cache)
        self.assertIn("Bauxite", self.engine.mineral_cache)
        self.assertIn("Manganese", self.engine.mineral_cache)

        # Check reference site counts
        self.assertEqual(self.engine.mineral_cache["Iron Ore"]["total_sites"], 6)
        self.assertEqual(self.engine.mineral_cache["Iron Ore"]["total_points"], 505)
        self.assertEqual(self.engine.mineral_cache["Limestone"]["total_sites"], 4)
        self.assertEqual(self.engine.mineral_cache["Limestone"]["total_points"], 47)
        self.assertEqual(self.engine.mineral_cache["Bauxite"]["total_sites"], 3)
        self.assertEqual(self.engine.mineral_cache["Bauxite"]["total_points"], 196)
        self.assertEqual(self.engine.mineral_cache["Manganese"]["total_sites"], 1)
        self.assertEqual(self.engine.mineral_cache["Manganese"]["total_points"], 26)

    def test_iron_ore_exact_hit(self):
        """Querying at an exact reference coordinate should give affinity score near 100."""
        # Pick first Iron Ore coordinate: Alenga-Nendwadi
        cache = self.engine.mineral_cache["Iron Ore"]
        ref_lat = float(cache["lats"][0])
        ref_lon = float(cache["lons"][0])

        res = self.engine.compute_affinity("Iron Ore", ref_lat, ref_lon)
        self.assertEqual(res["status"], "success")
        self.assertEqual(res["mineral"], "Iron Ore")
        self.assertAlmostEqual(res["distance_km"], 0.0, places=1)
        self.assertGreaterEqual(res["affinity_score"], 99.0)
        self.assertEqual(res["score_tier"], "Very High Spatial Proximity")
        self.assertEqual(res["reference_sites_count"], 6)
        self.assertIn("nearest_site", res)
        self.assertIn("scientific_interpretation", res)
        self.assertIn("limitation_disclosure", res)

    def test_distance_decay_monotonicity(self):
        """Affinity score must decrease strictly as distance increases."""
        cache = self.engine.mineral_cache["Iron Ore"]
        base_lat = float(cache["lats"][0])
        base_lon = float(cache["lons"][0])

        score_0 = self.engine.compute_affinity("Iron Ore", base_lat, base_lon)["affinity_score"]
        score_10km = self.engine.compute_affinity("Iron Ore", base_lat + 0.1, base_lon)["affinity_score"]
        score_50km = self.engine.compute_affinity("Iron Ore", base_lat + 0.5, base_lon)["affinity_score"]
        score_200km = self.engine.compute_affinity("Iron Ore", base_lat + 2.0, base_lon)["affinity_score"]

        self.assertGreater(score_0, score_10km)
        self.assertGreater(score_10km, score_50km)
        self.assertGreater(score_50km, score_200km)
        self.assertGreaterEqual(score_200km, 0.0)

    def test_distal_coordinates_near_zero(self):
        """Locations thousands of km away (e.g., London or Pacific Ocean) must yield score < 0.1."""
        res = self.engine.compute_affinity("Iron Ore", 51.5074, -0.1278)  # London
        self.assertEqual(res["status"], "success")
        self.assertLess(res["affinity_score"], 0.1)
        self.assertEqual(res["score_tier"], "Distal / Negligible Proximity")
        self.assertGreater(res["distance_km"], 6000.0)

    def test_manganese_insufficient_data(self):
        """Manganese must strictly return status='insufficient_data' with explanation."""
        res = self.engine.compute_affinity("Manganese", 19.5, 78.5)
        self.assertEqual(res["status"], "insufficient_data")
        self.assertEqual(res["mineral"], "Manganese")
        self.assertIsNone(res["affinity_score"])
        self.assertIn("Insufficient independent historical reference sites", res["message"])
        self.assertEqual(res["reference_sites_count"], 1)
        self.assertEqual(res["reference_locations_count"], 26)
        self.assertIn("scientific_interpretation", res)
        self.assertIn("limitation_disclosure", res)

    def test_unsupported_mineral_rejection(self):
        """Unsupported minerals must raise a descriptive ValueError."""
        for unsupported in ["Copper", "Gold", "Diamond", "Uranium", "Zinc"]:
            with self.assertRaises(ValueError) as ctx:
                self.engine.compute_affinity(unsupported, 20.0, 80.0)
            self.assertIn("not supported", str(ctx.exception).lower())

    def test_coordinate_bounds_validation(self):
        """Invalid latitudes and longitudes must raise ValueError."""
        invalid_coords = [
            (91.0, 80.0),
            (-91.0, 80.0),
            (20.0, 181.0),
            (20.0, -181.0),
            ("invalid", 80.0),
            (20.0, "invalid")
        ]
        for lat, lon in invalid_coords:
            with self.assertRaises(ValueError):
                self.engine.compute_affinity("Iron Ore", lat, lon)

    def test_boundary_coordinate_edge_values(self):
        """Exact extreme boundaries (-90, 90, -180, 180) must be accepted without error."""
        valid_extremes = [
            (90.0, 0.0),
            (-90.0, 0.0),
            (0.0, 180.0),
            (0.0, -180.0),
        ]
        for lat, lon in valid_extremes:
            res = self.engine.compute_affinity("Iron Ore", lat, lon)
            self.assertEqual(res["status"], "success")
            self.assertGreaterEqual(res["affinity_score"], 0.0)
            self.assertLessEqual(res["affinity_score"], 100.0)

    def test_mineral_name_case_insensitivity(self):
        """Engine must handle mixed case, hyphens, and whitespace variations."""
        variants = ["iron ore", "IRON ORE", "Iron-Ore", "iron_ore", "Iron ore and associated major oxides"]
        for var in variants:
            res = self.engine.compute_affinity(var, 19.5, 80.0)
            self.assertEqual(res["status"], "success")
            self.assertEqual(res["mineral"], "Iron Ore")

    def test_bandwidth_scaling(self):
        """Smaller bandwidth must decay faster than larger bandwidth."""
        res_narrow = self.engine.compute_affinity("Iron Ore", 19.5, 80.0, bandwidth_km=25.0)
        res_default = self.engine.compute_affinity("Iron Ore", 19.5, 80.0, bandwidth_km=50.0)
        res_wide = self.engine.compute_affinity("Iron Ore", 19.5, 80.0, bandwidth_km=100.0)

        self.assertLess(res_narrow["affinity_score"], res_default["affinity_score"])
        self.assertLess(res_default["affinity_score"], res_wide["affinity_score"])

    def test_determinism_and_stability(self):
        """Running the calculation repeatedly must produce identical scores."""
        scores = [
            self.engine.compute_affinity("Limestone", 16.5, 80.0)["affinity_score"]
            for _ in range(50)
        ]
        self.assertEqual(len(set(scores)), 1)


class TestFlaskSpatialAffinityRoutes(unittest.TestCase):
    @classmethod
    def setUpClass(cls):
        cls.client = app.test_client()

    def test_post_affinity_iron_ore_success(self):
        """POST /api/predict/affinity with Iron Ore should return HTTP 200 with score."""
        payload = {
            "mineral": "Iron Ore",
            "latitude": 19.524,
            "longitude": 80.418
        }
        res = self.client.post("/api/predict/affinity", json=payload)
        self.assertEqual(res.status_code, 200)
        data = res.get_json()
        self.assertEqual(data["status"], "success")
        self.assertEqual(data["mineral"], "Iron Ore")
        self.assertIsInstance(data["affinity_score"], (int, float))
        self.assertGreater(data["affinity_score"], 80.0)
        self.assertIn("nearest_site", data)
        self.assertIn("site_proximity_breakdown", data)
        self.assertEqual(len(data["site_proximity_breakdown"]), 6)

    def test_post_affinity_limestone_success(self):
        """POST /api/predict/affinity with Limestone should return HTTP 200."""
        payload = {
            "mineral": "Limestone",
            "latitude": 16.5,
            "longitude": 80.0
        }
        res = self.client.post("/api/predict/affinity", json=payload)
        self.assertEqual(res.status_code, 200)
        data = res.get_json()
        self.assertEqual(data["status"], "success")
        self.assertEqual(data["mineral"], "Limestone")
        self.assertEqual(data["reference_sites_count"], 4)

    def test_post_affinity_bauxite_success(self):
        """POST /api/predict/affinity with Bauxite should return HTTP 200."""
        payload = {
            "mineral": "Bauxite",
            "latitude": 23.0,
            "longitude": 83.2
        }
        res = self.client.post("/api/predict/affinity", json=payload)
        self.assertEqual(res.status_code, 200)
        data = res.get_json()
        self.assertEqual(data["status"], "success")
        self.assertEqual(data["mineral"], "Bauxite")
        self.assertEqual(data["reference_sites_count"], 3)
        self.assertIn("data_caveat", data)

    def test_post_affinity_manganese_insufficient(self):
        """POST /api/predict/affinity with Manganese should return HTTP 200 with insufficient_data."""
        payload = {
            "mineral": "Manganese",
            "latitude": 19.5,
            "longitude": 78.5
        }
        res = self.client.post("/api/predict/affinity", json=payload)
        self.assertEqual(res.status_code, 200)
        data = res.get_json()
        self.assertEqual(data["status"], "insufficient_data")
        self.assertIsNone(data["affinity_score"])
        self.assertIn("Insufficient independent historical reference sites", data["message"])

    def test_spatial_affinity_alias_routes(self):
        """Route /api/spatial-affinity should work on both POST and GET, accepting lat/lon or latitude/longitude."""
        # POST test with lat/lon
        r_post1 = self.client.post("/api/spatial-affinity", json={
            "mineral": "Iron Ore",
            "lat": 19.5,
            "lon": 80.0
        })
        self.assertEqual(r_post1.status_code, 200)

        # POST test with latitude/longitude
        r_post2 = self.client.post("/api/spatial-affinity", json={
            "mineral": "Iron Ore",
            "latitude": 19.5,
            "longitude": 80.0
        })
        self.assertEqual(r_post2.status_code, 200)
        self.assertEqual(r_post1.get_json()["affinity_score"], r_post2.get_json()["affinity_score"])

        # GET test
        r_get = self.client.get("/api/spatial-affinity?mineral=Iron+Ore&lat=19.5&lon=80.0")
        self.assertEqual(r_get.status_code, 200)
        self.assertEqual(r_get.get_json()["mineral"], "Iron Ore")

    def test_validation_errors(self):
        """Missing parameters, out-of-range, and bad minerals must return HTTP 400."""
        # Missing mineral
        r1 = self.client.post("/api/predict/affinity", json={"latitude": 19.5, "longitude": 80.0})
        self.assertEqual(r1.status_code, 400)
        self.assertIn("mineral", r1.get_json()["message"].lower())

        # Missing latitude
        r2 = self.client.post("/api/predict/affinity", json={"mineral": "Iron Ore", "longitude": 80.0})
        self.assertEqual(r2.status_code, 400)

        # Latitude out of range
        r3 = self.client.post("/api/predict/affinity", json={"mineral": "Iron Ore", "latitude": 120.0, "longitude": 80.0})
        self.assertEqual(r3.status_code, 400)
        self.assertIn("out of valid range", r3.get_json()["message"])

        # Non-numeric coordinate
        r4 = self.client.post("/api/predict/affinity", json={"mineral": "Iron Ore", "latitude": "xyz", "longitude": 80.0})
        self.assertEqual(r4.status_code, 400)

        # Unsupported mineral
        r5 = self.client.post("/api/predict/affinity", json={"mineral": "Silver", "latitude": 20.0, "longitude": 80.0})
        self.assertEqual(r5.status_code, 400)
        self.assertIn("not supported", r5.get_json()["message"].lower())

    def test_reference_summary_endpoint(self):
        """GET /api/predict/reference-summary should describe all 4 minerals."""
        res = self.client.get("/api/predict/reference-summary")
        self.assertEqual(res.status_code, 200)
        data = res.get_json()
        minerals = data["minerals"]
        self.assertEqual(minerals["Iron Ore"]["status"], "active")
        self.assertEqual(minerals["Limestone"]["status"], "active")
        self.assertEqual(minerals["Bauxite"]["status"], "active")
        self.assertEqual(minerals["Manganese"]["status"], "insufficient_data")


class TestSystemRegression(unittest.TestCase):
    @classmethod
    def setUpClass(cls):
        cls.client = app.test_client()

    def test_all_page_routes_render(self):
        """Verify all HTML template pages render without 500 error."""
        pages = ["/", "/dashboard", "/explore", "/analytics", "/reports"]
        for p in pages:
            res = self.client.get(p)
            self.assertEqual(res.status_code, 200, f"Page {p} returned {res.status_code}")
            content = res.data.decode("utf-8")
            self.assertTrue("GeoMine" in content or "geomine" in content.lower())

    def test_existing_core_apis(self):
        """Verify existing core APIs continue returning valid data."""
        apis = [
            "/api/summary",
            "/api/minerals",
            "/api/mineral-counts",
            "/api/filter-options",
            "/api/sites",
            "/api/site/ALENGA-NENDWADI",
            "/api/external/sources",
            "/api/external/geology?lat=19.5&lon=80.5",
        ]
        for endpoint in apis:
            res = self.client.get(endpoint)
            self.assertEqual(res.status_code, 200, f"Endpoint {endpoint} failed: {res.status_code}")


if __name__ == "__main__":
    unittest.main()
