"""
GeoMine AI - Stage 3: Train and Evaluate Small XGBoost Models
=============================================================
Reproducible, rigorously audited mineral occurrence probability models.
Uses modest XGBoost parameters with GPU (CUDA) acceleration and site-grouped evaluation.
"""
from pathlib import Path
import json
import joblib
import numpy as np
import pandas as pd
import xgboost as xgb
from sklearn.model_selection import GroupKFold
from sklearn.metrics import (
    accuracy_score,
    precision_score,
    recall_score,
    f1_score,
    roc_auc_score,
    confusion_matrix,
    brier_score_loss,
)

BASE_DIR = Path(__file__).resolve().parent.parent
DATA_PATH = BASE_DIR / "data" / "geomine_location_occurrence_preprocessed.csv"
MODELS_DIR = BASE_DIR / "models"
REPORTS_DIR = BASE_DIR / "reports"

# Modest parameter specification from Stage 3 requirements
XGB_PARAMS = {
    "n_estimators": 100,
    "max_depth": 3,
    "learning_rate": 0.05,
    "subsample": 0.8,
    "colsample_bytree": 0.8,
    "random_state": 42,
    "eval_metric": "logloss",
}

FEATURES = ["latitude", "longitude"]

def train_and_eval_mineral(mineral_name: str, target_col: str, df: pd.DataFrame, device: str = "cuda"):
    print(f"\n=======================================================")
    print(f"TRAINING AUDIT & EVALUATION: {mineral_name.upper()}")
    print(f"=======================================================")

    y = df[target_col].values
    groups = df["site_id"].values
    X = df[FEATURES].values

    pos_sites = df[df[target_col] == 1]["site_id"].unique()
    neg_sites = df[df[target_col] == 0]["site_id"].unique()
    n_pos = sum(y)
    n_neg = len(y) - n_pos

    print(f"Total Locations: {len(df)}")
    print(f"Positive: {n_pos} locations across {len(pos_sites)} sites ({pos_sites.tolist()})")
    print(f"Negative: {n_neg} locations across {len(neg_sites)} sites")

    # Eligibility check: Must have at least 2 positive sites for grouped train/test evaluation
    if len(pos_sites) < 2:
        print(f"--> SKIPPING {mineral_name}: Insufficient site diversity ({len(pos_sites)} positive site).")
        return {
            "mineral": mineral_name,
            "trained": False,
            "reason": f"Only {len(pos_sites)} positive site in dataset. Independent grouped cross-validation is impossible without severe spatial data leakage."
        }

    # Determine GroupKFold splits
    n_splits = min(len(pos_sites), 3)
    gkf = GroupKFold(n_splits=n_splits)

    fold_metrics = []
    y_true_all, y_pred_all, y_prob_all = [], [], []

    print(f"\nRunning {n_splits}-Fold GroupKFold Cross-Validation (all records from a site kept together)...")
    for fold, (train_idx, val_idx) in enumerate(gkf.split(X, y, groups)):
        X_train, y_train = X[train_idx], y[train_idx]
        X_val, y_val = X[val_idx], y[val_idx]
        val_sites = list(np.unique(groups[val_idx]))

        # Train model
        model = xgb.XGBClassifier(
            **XGB_PARAMS,
            tree_method="hist",
            device=device
        )
        model.fit(X_train, y_train)

        # Predict
        preds = model.predict(X_val)
        probs = model.predict_proba(X_val)[:, 1]

        acc = accuracy_score(y_val, preds)
        prec = precision_score(y_val, preds, zero_division=0)
        rec = recall_score(y_val, preds, zero_division=0)
        f1 = f1_score(y_val, preds, zero_division=0)
        try:
            auc = roc_auc_score(y_val, probs) if len(np.unique(y_val)) > 1 else np.nan
        except Exception:
            auc = np.nan

        fold_metrics.append({
            "fold": fold + 1,
            "val_sites": val_sites,
            "n_val": len(y_val),
            "n_pos_val": int(sum(y_val)),
            "accuracy": float(acc),
            "precision": float(prec),
            "recall": float(rec),
            "f1": float(f1),
            "roc_auc": float(auc) if not np.isnan(auc) else None,
        })

        y_true_all.extend(y_val)
        y_pred_all.extend(preds)
        y_prob_all.extend(probs)

        print(f"  Fold {fold + 1}: Held-out sites={val_sites} | Pos: {sum(y_val)}/{len(y_val)} | Acc: {acc:.3f} | F1: {f1:.3f} | AUC: {auc:.3f}")

    # Aggregate Evaluation Metrics
    overall_acc = accuracy_score(y_true_all, y_pred_all)
    overall_prec = precision_score(y_true_all, y_pred_all, zero_division=0)
    overall_rec = recall_score(y_true_all, y_pred_all, zero_division=0)
    overall_f1 = f1_score(y_true_all, y_pred_all, zero_division=0)
    overall_auc = roc_auc_score(y_true_all, y_prob_all)
    overall_brier = brier_score_loss(y_true_all, y_prob_all)
    cm = confusion_matrix(y_true_all, y_pred_all).tolist()

    # Simple Majority-Class Baseline
    majority_class = int(n_pos > n_neg)
    baseline_acc = float(accuracy_score(y_true_all, [majority_class] * len(y_true_all)))
    baseline_brier = float(brier_score_loss(y_true_all, [n_pos / len(df)] * len(y_true_all)))

    print("\n--- Overall Cross-Validated Performance ---")
    print(f"Accuracy:  {overall_acc:.4f} (Baseline: {baseline_acc:.4f})")
    print(f"Precision: {overall_prec:.4f}")
    print(f"Recall:    {overall_rec:.4f}")
    print(f"F1-Score:  {overall_f1:.4f}")
    print(f"ROC-AUC:   {overall_auc:.4f}")
    print(f"Brier:     {overall_brier:.4f} (Baseline: {baseline_brier:.4f})")
    print(f"Confusion Matrix (TN, FP / FN, TP):\n{np.array(cm)}")

    # Train Final Production Model on Full Dataset
    final_model = xgb.XGBClassifier(
        **XGB_PARAMS,
        tree_method="hist",
        device=device
    )
    final_model.fit(X, y)

    # Save Model Artifacts
    slug = mineral_name.lower().replace(" ", "_")
    model_file = MODELS_DIR / f"xgboost_{slug}_occurrence.joblib"
    json_model_file = MODELS_DIR / f"xgboost_{slug}_occurrence.json"
    features_file = MODELS_DIR / f"features_{slug}.json"
    report_file = REPORTS_DIR / f"evaluation_{slug}.json"

    joblib.dump(final_model, model_file)
    final_model.save_model(json_model_file)

    with open(features_file, "w") as f:
        json.dump({
            "mineral": mineral_name,
            "target_column": target_col,
            "features": FEATURES,
            "n_training_samples": len(df),
            "positive_sites": list(pos_sites),
            "negative_sites": list(neg_sites),
            "device": device,
            "parameters": XGB_PARAMS
        }, f, indent=2)

    eval_report = {
        "mineral": mineral_name,
        "target_column": target_col,
        "features": FEATURES,
        "trained": True,
        "device_used": device,
        "parameters": XGB_PARAMS,
        "dataset_summary": {
            "total_locations": len(df),
            "positive_locations": int(n_pos),
            "negative_locations": int(n_neg),
            "positive_sites": list(pos_sites),
            "negative_sites": list(neg_sites)
        },
        "evaluation_strategy": f"GroupKFold ({n_splits} folds grouped by site_id)",
        "cross_validation_folds": fold_metrics,
        "aggregate_metrics": {
            "accuracy": float(overall_acc),
            "majority_baseline_accuracy": baseline_acc,
            "precision": float(overall_prec),
            "recall": float(overall_rec),
            "f1_score": float(overall_f1),
            "roc_auc": float(overall_auc),
            "brier_score": float(overall_brier),
            "baseline_brier_score": baseline_brier,
            "confusion_matrix": cm
        },
        "scientific_caveats": [
            "Probabilities are empirical statistical estimations based solely on spatial coordinates.",
            "Predictions should not be interpreted as geological certainty or definitive proof of commercial mineralization.",
            "Site-to-site geological variation, overburden, weathering depth, and unobserved lithologies constrain generalizability to unseen exploration provinces."
        ]
    }

    with open(report_file, "w") as f:
        json.dump(eval_report, f, indent=2)

    print(f"Artifacts saved:")
    print(f"  Model:   {model_file}")
    print(f"  Config:  {features_file}")
    print(f"  Report:  {report_file}")

    return eval_report

def main():
    MODELS_DIR.mkdir(parents=True, exist_ok=True)
    REPORTS_DIR.mkdir(parents=True, exist_ok=True)

    print(f"Loading preprocessed location data: {DATA_PATH}")
    df = pd.read_csv(DATA_PATH)
    print(f"Loaded {len(df)} locations across {df['site_id'].nunique()} sites.")

    # Check CUDA
    device = "cuda"
    try:
        test_clf = xgb.XGBClassifier(n_estimators=5, tree_method="hist", device="cuda")
        test_clf.fit(np.zeros((10, 2)), np.array([0, 1] * 5))
        print("CUDA acceleration verified on NVIDIA RTX 3050.")
    except Exception as e:
        print(f"CUDA check failed ({e}), falling back to CPU.")
        device = "cpu"

    minerals_to_audit = [
        ("Iron Ore", "target_iron_ore"),
        ("Limestone", "target_limestone"),
        ("Bauxite", "target_bauxite"),
        ("Manganese", "target_manganese"),
    ]

    all_results = {}
    for mineral_name, target_col in minerals_to_audit:
        result = train_and_eval_mineral(mineral_name, target_col, df, device=device)
        all_results[mineral_name] = result

    # Save summary report across all minerals
    summary_report_file = REPORTS_DIR / "overall_ml_audit_summary.json"
    with open(summary_report_file, "w") as f:
        json.dump(all_results, f, indent=2)
    print(f"\nSaved overall multi-mineral audit summary to: {summary_report_file}")

if __name__ == "__main__":
    main()
