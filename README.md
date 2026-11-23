# GeoMine AI Website Prototype v1

A Flask + Leaflet prototype that browses the cleaned GeoMine AI assay dataset.

## Features
- Mineral category filter
- Search by site, state or district
- India-focused interactive map
- One map marker per grouped exploration site
- Site detail drawer with assay summaries and source documents
- API endpoints for summary, minerals, sites and site details

## Run locally (Windows / VS Code)

1. Extract this ZIP.
2. Open the extracted `GeoMineAI_Website_v1` folder in VS Code.
3. Open Terminal in VS Code.
4. Create and activate a virtual environment:

   ```powershell
   py -m venv .venv
   .venv\Scripts\activate
   ```

5. Install dependencies:

   ```powershell
   pip install -r requirements.txt
   ```

6. Start the app:

   ```powershell
   python app.py
   ```

7. Open http://127.0.0.1:5000 in your browser.

## Notes
- Internet is required for the OpenStreetMap tiles, Leaflet and Google Fonts CDN.
- The CSV is included under `data/`.
- The map groups records by `site_id` and displays the median recorded coordinate for each site.
- Site assay summaries are descriptive statistics of recorded samples.
- This v1 does NOT present model-generated deposit predictions. The first Bauxite Al2O3 model did not outperform a mean baseline under leave-one-site-out testing, so it is retained as experimental only.
- Some coordinate provenance values are marked as pending verification in the source dataset. Treat map locations accordingly.
- The API and UI expose source names, but do not imply independent validation of the source documents.
