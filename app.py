from pathlib import Path
import warnings
import joblib
import numpy as np
import pandas as pd
from flask import Flask, jsonify, render_template, request

BASE_DIR = Path(__file__).resolve().parent
MODEL_PATH = BASE_DIR / "models" / "student_marks_prediction_model.pkl"
DATA_PATH = BASE_DIR / "dataset" / "StudentPerformanceFactors-selected-columns.csv"

app = Flask(__name__)
warnings.filterwarnings("ignore", category=UserWarning, module="sklearn")

# The supplied artifact is a bundle: Lasso estimator + StandardScaler + ordered
# post-one-hot feature names. Keep the original trained estimator unchanged.
bundle = joblib.load(MODEL_PATH)
model = bundle["model"]
scaler = bundle["scaler"]
FEATURES = list(bundle["features"])
MODEL_NAME = bundle.get("model_name", type(model).__name__)
df = pd.read_csv(DATA_PATH)

NUMERIC_RULES = {
    "Hours_Studied": (1, 44),
    "Attendance": (60, 100),
    "Sleep_Hours": (4, 10),
    "Previous_Scores": (50, 100),
    "Tutoring_Sessions": (0, 8),
}
CATEGORIES = {
    "Parental_Involvement": ["Low", "Medium", "High"],
    "Access_to_Resources": ["Low", "Medium", "High"],
    "Extracurricular_Activities": ["No", "Yes"],
}
BASE_INPUTS = list(NUMERIC_RULES) + list(CATEGORIES)

def encode_input(payload):
    clean = {}
    for name, (low, high) in NUMERIC_RULES.items():
        value = payload.get(name)
        if value is None or isinstance(value, bool):
            raise ValueError(f"{name.replace('_', ' ')} is required.")
        try:
            number = float(value)
        except (TypeError, ValueError):
            raise ValueError(f"{name.replace('_', ' ')} must be numeric.")
        if not np.isfinite(number) or not low <= number <= high:
            raise ValueError(f"{name.replace('_', ' ')} must be between {low} and {high}.")
        clean[name] = number
    for name, choices in CATEGORIES.items():
        value = payload.get(name)
        if value not in choices:
            raise ValueError(f"Choose a valid {name.replace('_', ' ').lower()} value.")
        clean[name] = value

    frame = pd.DataFrame([clean])
    categorical = list(CATEGORIES)
    encoded = pd.get_dummies(frame, columns=categorical, drop_first=True, dtype=int)
    # Exact artifact feature order, with absent one-hot levels set to zero.
    encoded = encoded.reindex(columns=FEATURES, fill_value=0)
    return encoded

@app.get("/")
def index():
    return render_template("index.html")

@app.get("/api/overview")
def overview():
    numeric = df.select_dtypes(include="number")
    score = df["Exam_Score"]
    correlations = numeric.corr(numeric_only=True)["Exam_Score"].drop("Exam_Score").sort_values(ascending=False)
    valid = df.dropna(subset=["Exam_Score"])
    hist_counts, hist_edges = np.histogram(valid["Exam_Score"], bins=12)
    hist = [{"range": f"{hist_edges[i]:.0f}–{hist_edges[i+1]:.0f}", "count": int(hist_counts[i])} for i in range(len(hist_counts))]
    study_bins = pd.cut(df["Hours_Studied"], bins=[0, 10, 15, 20, 25, 30, 50], include_lowest=True)
    study = df.groupby(study_bins, observed=False)["Exam_Score"].mean().dropna()
    attendance_bins = pd.cut(df["Attendance"], bins=[59, 65, 70, 75, 80, 85, 90, 95, 100], include_lowest=True)
    attendance = df.groupby(attendance_bins, observed=False)["Exam_Score"].mean().dropna()
    category = df.groupby("Parental_Involvement", observed=True)["Exam_Score"].mean().dropna()
    return jsonify({
        "records": int(len(df)),
        "features": int(df.shape[1]-1),
        "average": round(float(score.mean()), 2),
        "median": round(float(score.median()), 2),
        "minimum": int(score.min()),
        "maximum": int(score.max()),
        "missing": int(df.isna().sum().sum()),
        "score_histogram": hist,
        "study_hours": {"labels": [str(x) for x in study.index], "values": [round(float(x),2) for x in study.values]},
        "attendance": {"labels": [str(x) for x in attendance.index], "values": [round(float(x),2) for x in attendance.values]},
        "parental": {"labels": category.index.tolist(), "values": [round(float(x),2) for x in category.values]},
        "correlations": {"labels": correlations.index.tolist(), "values": [round(float(x),3) for x in correlations.values]},
        "model": {"name": MODEL_NAME, "features": len(FEATURES), "mae": 0.9374555633600327, "rmse": 2.0282034469337766, "r2": 0.7089785545850293}
    })

@app.post("/api/predict")
def predict():
    payload = request.get_json(silent=True) or {}
    try:
        encoded = encode_input(payload)
        scaled = scaler.transform(encoded)
        result = float(model.predict(scaled)[0])
        if not np.isfinite(result):
            raise ValueError("The model returned an invalid result.")
        return jsonify({
            "prediction": round(result, 2),
            "model": MODEL_NAME,
            "input_features": len(FEATURES),
            "note": "This is a model estimate, not a guaranteed exam result."
        })
    except ValueError as exc:
        return jsonify({"error": str(exc)}), 400
    except Exception:
        app.logger.exception("Prediction failed")
        return jsonify({"error": "Prediction could not be completed. Check the server logs."}), 500

@app.get("/api/health")
def health():
    return jsonify({"status": "ok", "model_loaded": True, "model": MODEL_NAME})

if __name__ == "__main__":
    app.run(host="127.0.0.1", port=5000, debug=True)
