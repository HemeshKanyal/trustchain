import os
import pandas as pd
import numpy as np
from sklearn.preprocessing import LabelEncoder
from sklearn.linear_model import LinearRegression
import joblib

# Paths
BASE_DIR = r"C:\D Drive\Study Material\SIH"
MODELS_DIR = os.path.join(BASE_DIR, "ai", "models")  # new location
os.makedirs(MODELS_DIR, exist_ok=True)  # create folder if it doesn't exist

MODEL_PATH = os.path.join(MODELS_DIR, "all_drugs_model.pkl")
# Load data
df = pd.read_csv(DATA_PATH)
df["Time"] = pd.to_datetime(df["Time"], errors="coerce")
df["Year"] = df["Time"].dt.year
df["Month"] = df["Time"].dt.month

# Aggregate monthly sales
monthly_sales = (
    df.groupby(["DrugID", "DrugName", "Year", "Month"])["Quantity"]
    .sum()
    .reset_index()
)

# Encode categorical features
le_drug = LabelEncoder()
monthly_sales["DrugID_enc"] = le_drug.fit_transform(monthly_sales["DrugID"])

# Features and target
X = monthly_sales[["DrugID_enc", "Year", "Month"]]
y = monthly_sales["Quantity"]

# Train a single regression model
model = LinearRegression()
model.fit(X, y)

# Save model + encoder
joblib.dump({"model": model, "le_drug": le_drug}, MODEL_PATH)
print(f"✅ Model saved at {MODEL_PATH}")

# ---------------------------
# Function to get predicted sales ranking
# ---------------------------
def predict_sales_ranking(year, month, top_n=5):
    # Load model
    data = joblib.load(MODEL_PATH)
    model = data["model"]
    le_drug = data["le_drug"]

    # Prepare all drugs
    all_drugs = pd.DataFrame({"DrugID": le_drug.classes_})
    all_drugs["DrugID_enc"] = le_drug.transform(all_drugs["DrugID"])
    all_drugs["Year"] = year
    all_drugs["Month"] = month

    # Predict
    all_drugs["PredictedQuantity"] = model.predict(all_drugs[["DrugID_enc", "Year", "Month"]])

    # Sort
    highest = all_drugs.sort_values("PredictedQuantity", ascending=False).head(top_n)
    lowest = all_drugs.sort_values("PredictedQuantity", ascending=True).head(top_n)

    return highest, lowest

# Example usage
top, bottom = predict_sales_ranking(year=2025, month=9, top_n=3)
print("🏆 Predicted Top 3 Medicines:\n", top)
print("\n📉 Predicted Bottom 3 Medicines:\n", bottom)
