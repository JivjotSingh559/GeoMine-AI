import sys
from pathlib import Path
sys.path.insert(0, str(Path(__file__).resolve().parent.parent))

from app import app
import json

c = app.test_client()

print("=== 1. PAGE LOAD ===")
r_page = c.get("/explore")
assert r_page.status_code == 200
assert "SPATIAL AFFINITY PROBE" in r_page.data.decode("utf-8")
print("Explore page loaded OK (Status 200)")

print("\n=== 2. IRON ORE PROBE ===")
r_iron = c.post("/api/predict/affinity", json={"mineral": "Iron Ore", "latitude": 19.524, "longitude": 80.418})
assert r_iron.status_code == 200
data_iron = r_iron.get_json()
print("Status:", data_iron["status"])
print(f"Score: {data_iron['affinity_score']} / 100 ({data_iron['score_tier']})")
print(f"Nearest Site: {data_iron['nearest_site']['site_name']} ({data_iron['distance_km']} km)")
print("Breakdown sites count:", len(data_iron["site_proximity_breakdown"]))

print("\n=== 3. MANGANESE INSUFFICIENT DATA PROBE ===")
r_mn = c.post("/api/predict/affinity", json={"mineral": "Manganese", "latitude": 19.5, "longitude": 78.5})
assert r_mn.status_code == 200
data_mn = r_mn.get_json()
print("Status:", data_mn["status"])
print("Message:", data_mn["message"])
print("Ref sites:", data_mn["reference_sites_count"], "Ref locs:", data_mn["reference_locations_count"])

print("\n=== 4. LIMESTONE PROBE ===")
r_ls = c.post("/api/predict/affinity", json={"mineral": "Limestone", "latitude": 16.5, "longitude": 80.0})
assert r_ls.status_code == 200
data_ls = r_ls.get_json()
print("Status:", data_ls["status"])
print(f"Score: {data_ls['affinity_score']} / 100 ({data_ls['score_tier']})")
print(f"Nearest Site: {data_ls['nearest_site']['site_name']} ({data_ls['distance_km']} km)")

print("\n=== 5. BAUXITE PROBE ===")
r_bx = c.post("/api/predict/affinity", json={"mineral": "Bauxite", "latitude": 23.0, "longitude": 83.2})
assert r_bx.status_code == 200
data_bx = r_bx.get_json()
print("Status:", data_bx["status"])
print(f"Score: {data_bx['affinity_score']} / 100 ({data_bx['score_tier']})")
print(f"Nearest Site: {data_bx['nearest_site']['site_name']} ({data_bx['distance_km']} km)")
print("Caveat:", data_bx["data_caveat"][:80], "...")

print("\n=== 6. BOUNDARY & ERROR VALIDATION ===")
r_err1 = c.post("/api/predict/affinity", json={"mineral": "Gold", "latitude": 19.5, "longitude": 80.0})
assert r_err1.status_code == 400
print("Unsupported mineral error (400):", r_err1.get_json()["message"])

r_err2 = c.post("/api/predict/affinity", json={"mineral": "Iron Ore", "latitude": 105.0, "longitude": 80.0})
assert r_err2.status_code == 400
print("Out-of-bounds latitude error (400):", r_err2.get_json()["message"])

print("\nALL SIMULATIONS PASSED PERFECTLY!")
