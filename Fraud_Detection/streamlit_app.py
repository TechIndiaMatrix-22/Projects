import streamlit as st
import pandas as pd
import requests
import plotly.express as px

# =========================================================
# PAGE CONFIG
# =========================================================

st.set_page_config(

    page_title="FRAUD INSPECTOR/ANALYZER",

    layout="wide"
)

# =========================================================
# CACHE PREDICTIONS
# =========================================================

@st.cache_data(show_spinner=False)

def get_predictions(file_bytes, file_name):

    files = {

        "file": (

            file_name,

            file_bytes,

            "text/csv"
        )
    }

    response = requests.post(

        "http://127.0.0.1:8000/predict_csv",

        files=files
    )

    return response.json()

# =========================================================
# TITLE
# =========================================================

c1, c2 = st.columns([1, 6])

with c1:

    st.image(

        r"C:\Users\DELL\Downloads\Inspector.jpg",

        width=100
    )

with c2:

    st.title(
        "Fraud Inspector/Analyzer"
    )

st.markdown("---")

# =========================================================
# SIDEBAR VARIATIONS
# =========================================================

st.sidebar.header(
    "⚙ Fraud Detection Variations"
)

threshold = st.sidebar.slider(

    "Fraud Threshold",

    min_value=0.0,

    max_value=1.0,

    value=0.5,

    step=0.01
)

max_rows = st.sidebar.slider(

    "Maximum Rows to Analyze",

    min_value=10,

    max_value=10000,

    value=1000,

    step=10
)

chart_bins = st.sidebar.slider(

    "Histogram Bins",

    min_value=5,

    max_value=100,

    value=30,

    step=5
)

show_only_fraud = st.sidebar.checkbox(

    "Show Only Fraud Transactions"
)

show_high_risk = st.sidebar.checkbox(

    "Show High Risk Transactions Only"
)

# =========================================================
# FILE UPLOAD
# =========================================================

uploaded_file = st.file_uploader(

    "Upload CSV File",

    type=["csv"]
)

# =========================================================
# SIDEBAR ANALYZE BUTTON
# =========================================================

st.sidebar.markdown("---")

analyze_button = st.sidebar.button(

    "🚀 Analyze",

    use_container_width=True
)

# =========================================================
# PROCESS FILE
# =========================================================

if uploaded_file is not None:

    st.success(
        "CSV Uploaded Successfully!"
    )

    if analyze_button:

        # =====================================================
        # RUN MODEL
        # =====================================================

        with st.spinner(

            "Running AI Fraud Detection..."
        ):

            results = get_predictions(

                uploaded_file.getvalue(),

                uploaded_file.name
            )

        # =====================================================
        # CREATE DATAFRAME
        # =====================================================

        result_df = pd.DataFrame(
            results
        )

        st.success(
            "Fraud Detection Completed!"
        )

        # =================================================
        # APPLY VARIATIONS
        # =================================================

        result_df = result_df.head(
            max_rows
        )

        if show_only_fraud:

            result_df = result_df[
                result_df["Prediction"] == "FRAUD"
            ]

        if show_high_risk:

            result_df = result_df[
                result_df["Fraud Probability"] >= threshold
            ]

        # =================================================
        # METRICS
        # =================================================

        st.markdown("---")

        st.header(
            "📊 Fraud Analytics"
        )

        fraud_count = (

            result_df["Prediction"]

            == "FRAUD"

        ).sum()

        genuine_count = (

            result_df["Prediction"]

            == "GENUINE"

        ).sum()

        avg_probability = result_df[
            "Fraud Probability"
        ].mean()

        max_probability = result_df[
            "Fraud Probability"
        ].max()

        c1, c2, c3, c4 = st.columns(4)

        c1.metric(
            "Fraud Transactions",
            fraud_count
        )

        c2.metric(
            "Genuine Transactions",
            genuine_count
        )

        c3.metric(
            "Average Fraud Risk",
            f"{avg_probability:.2%}"
        )

        c4.metric(
            "Maximum Fraud Risk",
            f"{max_probability:.2%}"
        )

        # =================================================
        # PIE CHART
        # =================================================

        st.markdown("---")

        st.header(
            "🥧 Fraud Distribution"
        )

        pie_df = pd.DataFrame({

            "Type": [
                "Fraud",
                "Genuine"
            ],

            "Count": [
                fraud_count,
                genuine_count
            ]
        })

        fig = px.pie(

            pie_df,

            names="Type",

            values="Count",

            title="Fraud vs Genuine Transactions"
        )

        st.plotly_chart(
            fig,
            use_container_width=True
        )

        # =================================================
        # HISTOGRAM
        # =================================================

        st.markdown("---")

        st.header(
            "📈 Fraud Probability Distribution"
        )

        hist_fig = px.histogram(

            result_df,

            x="Fraud Probability",

            nbins=chart_bins,

            title="Fraud Probability Histogram",

            color="Prediction"
        )

        hist_fig.update_layout(

            xaxis_title="Fraud Probability",

            yaxis_title="Number of Transactions"
        )

        st.plotly_chart(

            hist_fig,

            use_container_width=True
        )

        # =================================================
        # SCATTER PLOT
        # =================================================

        st.markdown("---")

        st.header(
            "📍 Fraud Risk Scatter Plot"
        )

        scatter_fig = px.scatter(

            result_df,

            x=result_df.index,

            y="Fraud Probability",

            color="Prediction",

            title="Transaction Fraud Risk Analysis"
        )

        scatter_fig.update_layout(

            xaxis_title="Transaction Index",

            yaxis_title="Fraud Probability"
        )

        st.plotly_chart(

            scatter_fig,

            use_container_width=True
        )

        # =================================================
        # RESULT TABLE
        # =================================================

        st.markdown("---")

        st.header(
            "📄 Prediction Results"
        )

        st.dataframe(

            result_df,

            use_container_width=True
        )

        # =================================================
        # DOWNLOAD
        # =================================================

        st.markdown("---")

        csv = result_df.to_csv(
            index=False
        )

        st.download_button(

            label="⬇ Download Results",

            data=csv,

            file_name="fraud_predictions.csv",

            mime="text/csv"
        )

else:

    st.info(
        "Please upload a CSV file to begin analysis."
    )