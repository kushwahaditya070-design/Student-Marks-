<<<<<<< HEAD
# Student-Marks-
Student_Marks_Prediction
=======
# PREDICT / Student Potential Studio

A creative, responsive student marks prediction experience powered by the supplied Lasso Regression model and dataset.

## Run locally

Python 3.10–3.12 is recommended.

```bash
# Windows PowerShell (run from this folder)
py -3.11 -m venv .venv
.venv\Scripts\Activate.ps1
python -m pip install --upgrade pip
pip install -r requirements.txt
python app.py
```

Open http://127.0.0.1:5000

On macOS/Linux, create/activate the virtual environment with `python3 -m venv .venv` and `source .venv/bin/activate`.

## What's included

- `app.py`: Flask app, dataset-backed analytics endpoints, validated prediction API.
- `models/student_marks_prediction_model.pkl`: original supplied model bundle.
- `dataset/StudentPerformanceFactors-selected-columns.csv`: supplied CSV.
- `Student_Marks.ipynb`: supplied training notebook.
- `templates/index.html`, `static/`: frontend.

## Model and input handling

The uploaded pickle contains a Lasso Regression estimator, a fitted `StandardScaler`, and the exact 10 encoded feature names. The form exposes the 8 original inputs used in the notebook. Flask performs the same `pandas.get_dummies(..., drop_first=True, dtype=int)` transformation, reindexes to the artifact's stored feature order, and applies the supplied scaler before prediction. The model is not retrained.

Numeric input limits follow the observed min/max ranges in the supplied CSV:
- Hours studied: 1–44
- Attendance: 60–100
- Sleep hours: 4–10
- Previous scores: 50–100
- Tutoring sessions: 0–8

Categorical options follow the source data categories. These ranges are validation guardrails based on the dataset, not claims about universal student limits.

## Evaluation metrics

The notebook's selected model is Lasso Regression. Reported held-out metrics in the supplied notebook:
- MAE: 0.9374556
- RMSE: 2.0282034
- R²: 0.7089786

Metrics are reproduced from the supplied notebook, not recalculated during a live request.

## Notes

- Analytics are generated from the supplied CSV at server startup.
- The dataset contains 6,607 records and 12 columns including `Exam_Score`; the API reports 11 input features.
- `Teacher_Quality` has 78 missing values, but it is not one of the model's selected inputs.
- The source dataset's `Exam_Score` maximum is 101; values are displayed as recorded rather than silently clipped.
- Audio is an optional synthesized ambient tone and starts only after the user enables it.
>>>>>>> a2b2598 (Initial commit)
