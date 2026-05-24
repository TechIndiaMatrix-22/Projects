from fastapi import FastAPI, UploadFile, File
from fastapi.middleware.cors import CORSMiddleware

import pandas as pd
import numpy as np
import joblib
import io

# =========================================================
# LOAD MODEL
# =========================================================

model = joblib.load(
    "models/fraud_model.pkl"
)

scaler = joblib.load(
    "models/scaler.pkl"
)

feature_columns = joblib.load(
    "models/feature_columns.pkl"
)

# =========================================================
# FASTAPI APP
# =========================================================

app = FastAPI(

    title="Enterprise AI Fraud Detection API",

    version="1.0.0"
)

# =========================================================
# ENABLE CORS
# =========================================================

app.add_middleware(

    CORSMiddleware,

    allow_origins=["*"],

    allow_credentials=True,

    allow_methods=["*"],

    allow_headers=["*"],
)

# =========================================================
# HOME
# =========================================================

@app.get("/")

def home():

    return {

        "message":
        "Fraud Detection API Running"
    }

# =========================================================
# CSV PREDICTION API
# =========================================================

@app.post("/predict_csv")

async def predict_csv(

    file: UploadFile = File(...)
):

    # =====================================================
    # READ CSV
    # =====================================================

    contents = await file.read()

    df = pd.read_csv(
        io.StringIO(
            contents.decode("utf-8")
        )
    )

    # =====================================================
    # DYNAMIC FEATURES
    # =====================================================

    dynamic_df = pd.DataFrame()

    # STEP

    if "step" in df.columns:

        dynamic_df["step"] = df["step"]

    else:

        dynamic_df["step"] = np.arange(
            len(df)
        )

    # TYPE

    if "type" in df.columns:

        if df["type"].dtype == "object":

            type_map = {

                val:i
                for i,val in enumerate(
                    df["type"].unique()
                )
            }

            dynamic_df["type"] = df[
                "type"
            ].map(type_map)

        else:

            dynamic_df["type"] = df["type"]

    else:

        dynamic_df["type"] = 0

    # AMOUNT

    if "amount" in df.columns:

        dynamic_df["amount"] = df[
            "amount"
        ]

    else:

        dynamic_df["amount"] = np.random.randint(
            100,
            50000,
            len(df)
        )

    # BALANCES

    if "oldbalanceOrg" in df.columns:

        dynamic_df["oldbalanceOrg"] = df[
            "oldbalanceOrg"
        ]

    else:

        dynamic_df["oldbalanceOrg"] = (
            dynamic_df["amount"] * 3
        )

    dynamic_df["newbalanceOrig"] = (

        dynamic_df["oldbalanceOrg"] -

        dynamic_df["amount"]
    )

    dynamic_df["oldbalanceDest"] = (

        dynamic_df["amount"] * 2
    )

    dynamic_df["newbalanceDest"] = (

        dynamic_df["oldbalanceDest"] +

        dynamic_df["amount"]
    )

    dynamic_df["nameOrig"] = 0
    dynamic_df["nameDest"] = 0
    dynamic_df["isFlaggedFraud"] = 0

    # =====================================================
    # MATCH FEATURES
    # =====================================================

    for col in feature_columns:

        if col not in dynamic_df.columns:

            dynamic_df[col] = 0

    dynamic_df = dynamic_df[
        feature_columns
    ]

    # =====================================================
    # SCALE
    # =====================================================

    X_scaled = scaler.transform(
        dynamic_df
    )

    # =====================================================
    # PREDICT
    # =====================================================

    probabilities = model.predict_proba(
        X_scaled
    )[:,1]

    # =====================================================
    # FRAUD BOOSTING
    # =====================================================

    probabilities += np.where(

        dynamic_df["amount"] > 200000,

        0.25,

        0
    )

    probabilities += np.where(

        dynamic_df["oldbalanceOrg"] > 1000000,

        0.15,

        0
    )

    probabilities = np.clip(
        probabilities,
        0,
        1
    )

    predictions = (
        probabilities > 0.35
    ).astype(int)

    risks = []

    for prob in probabilities:

        if prob < 0.3:

            risks.append(
                "LOW RISK"
            )

        elif prob < 0.7:

            risks.append(
                "MEDIUM RISK"
            )

        else:

            risks.append(
                "HIGH RISK"
            )
        # REAL-TIME FRAUD ALERTS
        # =====================================================

    alerts = np.where(

        probabilities > 0.9,

        "🚨 CRITICAL FRAUD ALERT",

        "NORMAL"
    )
    # =====================================================
    # RESULTS
    # =====================================================

    result_df = df.copy()

    result_df["Prediction"] = np.where(

        predictions == 1,

        "FRAUD",

        "GENUINE"
    )

    result_df["Fraud Probability"] = probabilities

    result_df["Risk Level"] = risks

    return result_df.to_dict(
        orient="records"
    )