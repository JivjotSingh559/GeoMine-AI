# GeoMine AI — Dataset Specification & Data Lineage Dictionary

> **Comprehensive Geochemical Assay Dataset Guide**  
> *Dataset file: `data/GeoMineAI_Final_Model_Training_Clean_v1.csv` (32,562 records · 22 features · 16.5 MB)*

---

## 1. Overview & Dataset Scope

The GeoMine AI dataset is a structured compilation of subsurface geological core samples, borehole assays, and geochemical petrochemical analysis tables transcribed from official Indian mineral exploration reports across **18 exploration blocks** in **7 Indian states**.

Each observation represents an assayed chemical or physical measurement from a documented geological sample, borehole collar, or bedrock outcrop, retaining complete audit lineage back to its source PDF document, page number, and original table structure.

### High-Level Summary Metrics

| Metric | Verified Value | Notes |
|---|---|---|
| **Total Assay Records** | `32,562` | 100% complete latitude/longitude records within bounds |
| **Unique Exploration Sites** | `18` | Spatially grouped exploration blocks |
| **Commodity Classes** | `10` | Limestone, Bauxite, Iron Ore, Molybdenite, Base Metals, etc. |
| **States Covered** | `7` | AP, Maharashtra, Chhattisgarh, Telangana, Odisha, Karnataka, MP |
| **Distinct Analytes** | `71` | Major oxides ($\text{Al}_2\text{O}_3, \text{SiO}_2, \text{CaO}$), trace elements ($\text{Li}, \text{Mo}$), LOI |
| **Primary Units** | `%` (30,112), `ppm` (1,723), `mg/kg` (716), `mg/L` (11) | Unit standardized per record |
| **Source Technical Reports** | `17` | Official G2, G3, and G4 exploration reports |
| **Audit Rule Compliance** | `32,492` Clean (`1.0`) / `70` Flagged (`0.5`) | Downweighted in training for audit review |

---

## 2. Complete Data Dictionary (22 Columns)

| Field Name | Type | Nullable | Example Value | Description & Business Rules |
|---|---|:---:|---|---|
| `record_id` | String | No | `MUTYALAMPADU_000001` | Unique surrogate identifier assigned to each assay record. |
| `record_category` | String | No | `sample_assay` | Category of observation (`sample_assay` across all 32,562 records). |
| `site_id` | String | No | `PARPATIA` | Machine-readable unique code identifying the exploration block/group. |
| `site_name` | String | No | `Parpatia Bauxite Block` | Human-readable geological name of the block. |
| `country` | String | No | `India` | Country of exploration (`India`). |
| `state` | String | No | `Chhattisgarh` | Indian administrative state. |
| `district` | String | Yes | `Surguja` | Administrative district. |
| `target_mineral` | String | No | `Bauxite` | Primary mineral target under investigation in the exploration report. |
| `ore_type` | String | Yes | `Bauxite / lateritic profile` | Host lithology or ore description (e.g., *limestone core sample*, *Monzogranite*). |
| `latitude` | Float64 | No | `23.0125` | Latitude in WGS84 decimal degrees (range: 15.0°N to 26.0°N). |
| `longitude` | Float64 | No | `83.1428` | Longitude in WGS84 decimal degrees (range: 75.0°E to 84.0°E). |
| `coordinate_type` | String | No | `sample_coordinates_from_source` | Derivation method (e.g. *PDF-derived candidate*, *borehole collar*, *UTM Zone 43P*). |
| `source_name` | String | No | `Parpatia-G3-Bauxite-Chhattisgarh.pdf` | Filename of the primary technical exploration report. |
| `source_reference` | String | Yes | `Annexure-III; Borehole PBH-12; p.142` | Specific section, borehole identifier, and PDF page citation. |
| `verification_status`| String | No | `source_table_transcribed` | Transcription audit state (e.g., transcribed from report table, not independently field-surveyed). |
| `audit_status` | String | No | `not_flagged_by_initial_rules` | Quality flag: `not_flagged_by_initial_rules` (32,492) or `review_required` (70). |
| `target_analyte` | String | No | `Al2O3` | Chemical compound, element, or physical parameter analyzed. |
| `target_value` | Float64 | Yes | `48.35` | Numeric assay result or concentration. |
| `target_unit` | String | No | `%` | Measurement unit (`%`, `ppm`, `mg/kg`, `mg/L`). |
| `target_source_column`| String | Yes | `Al2O3_%` | Original column header in the source table. |
| `target_value_method`| String | No | `source_value_unmodified` | Value transformation method (`source_value_unmodified` or arithmetic mean of duplicates). |
| `target_training_weight` | Float64 | No | `1.0` | Sample weight for ML loss functions (`1.0` for clean, `0.5` for flagged records). |

---

## 3. Comprehensive Site Inventory (18 Exploration Blocks)

The table below documents all 18 mapped exploration sites, ordered by total recorded assay observations:

| Site Identifier (`site_id`) | Site Name | State | District | Records | Target Commodity | Primary Source Technical Document |
|---|---|---|---|---:|---|---|
| `MUTYALAMPADU-TANGEDA` | Mutyalampadu-Tangeda Limestone | Andhra Pradesh | Guntur | 14,672 | Limestone | `Mutyalampadu-Tangeda_G2.pdf` |
| `RAMAPURAM` | Ramapuram Limestone Block | Andhra Pradesh | Guntur | 3,606 | Limestone | `Ramapuram_G2.pdf` |
| `PARPATIA` | Parpatia Bauxite Block | Chhattisgarh | Surguja | 3,552 | Bauxite / REE | `Parpatia-G3-Bauxite-Chhattisgarh.pdf` |
| `TARHAPANI-WEST` | Tarhapani (West) Bauxite Block | Odisha | Koraput | 1,767 | Bauxite / REE | `NMETGR_Tarhapni(W)_20231012.pdf` |
| `KARIMNAGAR-MOLYBDENITE`| Sporadic Molybdenite Occurrences | Telangana | Siddipet & Karimnagar | 1,259 | Molybdenite & Pathfinders | `Karimnagar_G4_TSMDC_G3.pdf` |
| `TANGEDA` | Tangeda Limestone Block | Andhra Pradesh | Guntur | 1,194 | Limestone | `Tangeda_G2_Block.pdf` |
| `ALENGA-NENDWADI` | Alenga-Nendwadi Block | Maharashtra | Gadchiroli | 1,158 | Iron Ore & Major Oxides | `Alenga_Nendwadi_Final_Report.pdf` |
| `TADGAON-WATELI-G4` | Tadgaon-Wateli Iron Ore Block | Maharashtra | Gadchiroli | 904 | Iron Ore | `254_Final_GR_of_Tadgaon_Wateli_Block.pdf` |
| `RAGHUNATHAPALEM-C3` | Raghunathapalem Cluster-3 Limestone | Telangana | Suryapet | 888 | Limestone | `Raghunathapalem_C3_Limestone.pdf` |
| `MARAMPALLI-JINJGAON` | Marampalli-Jinjgaon Block | Maharashtra | Gadchiroli | 712 | Iron Ore & Major Oxides | `Marampalli_Jinjgaon_Iron_Ore.pdf` |
| `MURWADA-TUMARIKODI` | Murwada-Tumarikodi Block | Maharashtra | Gadchiroli | 675 | Iron Ore & Major Oxides | `Murwada_Tumarikodi_Report.pdf` |
| `GILANGUDA-PADUR` | Gilanguda-Padur Block | Maharashtra | Gadchiroli | 646 | Iron Ore & Major Oxides | `Gilanguda_Padur_Iron_Ore.pdf` |
| `TADGAON-WATELI` | Tadgaon-Wateli Block | Maharashtra | Gadchiroli | 610 | Iron Ore & Major Oxides | `Tadgaon_Wateli_Composite.pdf` |
| `OBALAPURA-KIOCL-28` | Obalapura Base Metal Block | Karnataka | Chitradurga | 361 | Base Metal | `KIOCL_Block28_Obalapura.pdf` |
| `ANAJI-KIOCL-27` | Anaji Base Metal Block | Karnataka | Davangere | 281 | Base Metal | `KIOCL_Block27_Anaji.pdf` |
| `PIMPERKUNTA-MN-G3` | Pimperkunta Manganese Block | Telangana | Adilabad | 182 | Manganese Ore | `Pimperkunta_Manganese_G3.pdf` |
| `DUMARGUDA` | Dumarguda Bauxite Block | Chhattisgarh | Surguja | 75 | Bauxite | `Dumarguda_Bauxite_Report.pdf` |
| `GOVINDPUR-W-SN` | Govindpur Tungsten-Tin Block | Madhya Pradesh | Datia | 20 | Tungsten and Tin | `Govindpur_Tungsten_Tin_G4.pdf` |

---

## 4. Geochemical Analytes Distribution

The dataset encompasses 71 distinct chemical analytes and loss-on-ignition parameters. The top 10 most abundant analytes are summarized below:

| Analyte | Total Records | Primary Unit | Geological Importance |
|---|---:|:---:|---|
| $\text{Al}_2\text{O}_3$ | 5,532 | `%` | Principal economic indicator for bauxite and clay mineralogy |
| $\text{SiO}_2$ | 5,521 | `%` | Reactive silica contaminant in bauxite; major quartz silicate indicator |
| $\text{CaO}$ | 3,949 | `%` | Primary grade driver for cement/metallurgical grade limestone deposits |
| $\text{Fe}_2\text{O}_3$ | 3,735 | `%` | Iron oxide component in banded iron formations (BIF) and laterites |
| $\text{LOI}$ | 2,486 | `%` | Loss on ignition (volatile contents: carbonate carbon dioxide, structural water) |
| $\text{MgO}$ | 2,334 | `%` | Magnesium oxide; critical cutoff threshold for cement-grade limestone |
| $\text{P}_2\text{O}_5$ | 2,081 | `%` | Phosphorus pentoxide; critical impurity metric for steelmaking ores |
| $\text{SO}_3$ | 1,866 | `%` | Sulfur trioxide; indicator of sulfate minerals / evaporite sequences |
| $\text{Fe}$ | 600 | `%` | Total elemental iron grade |
| $\text{BaO}$ | 349 | `%` | Barium oxide in carbonatites and hydrothermal vein systems |

---

## 5. Data Cleaning & Normalization Pipeline

1. **Extraction & OCR Verification**:
   - Tabular chemical analysis annexures were extracted using semi-automated tabular parsing pipelines from PDF reports.
   - Headers with non-standard formatting (e.g. `Al2O3%`, `AL2O3_PCT`, `Alumina`) were canonicalized to standardized IUPAC chemical formulas (`Al2O3`, `SiO2`, `CaO`).
2. **Coordinate Normalization**:
   - Universal Transverse Mercator (UTM Zone 43P) coordinates were converted to WGS84 latitude/longitude using standard geodesy formulas.
   - Degrees-Minutes-Seconds (DMS) string representations were parsed to high-precision decimal degrees:
     $$\text{Decimal Degrees} = \text{Deg} + \frac{\text{Min}}{60} + \frac{\text{Sec}}{3600}$$
   - Where hemisphere indicators were omitted in original government tables, positive North and East designations were verified against the block's known district and state bounds.
3. **Audit Rules & Downweighting**:
   - `32,492` records passed automated range, stoichiometric, and duplicate checks without flags (`target_training_weight = 1.0`).
   - `70` records exhibited ambiguity (e.g. conflicting duplicate readings for the same sample interval) and were resolved via arithmetic mean with `audit_status = review_required` and downweighted (`target_training_weight = 0.5`).
4. **Provenance Transparency**:
   - `24,791` records are tagged with `PDF-derived candidate (verification pending)`. These reflect samples where geographic location is tied to report collar tables or section centroids rather than independent ground-truth DGPS surveys.
