import pandas as pd
import joblib
from sklearn.ensemble import RandomForestRegressor
from sklearn.model_selection import train_test_split
from sklearn.metrics import mean_squared_error
import numpy as np

print("Start")

# Step 1: Load and clean dataset fully (no nrows limit)
df = pd.read_csv('medicines.csv')

# Clean and convert price to numeric, coerce invalid or missing to NaN
df['product_price'] = pd.to_numeric(
    df['product_price'].str.replace('₹', '').str.replace(',', ''),
    errors='coerce'
)

# Lowercase and strip strings for consistency
for col in ['product_name', 'salt_composition', 'product_manufactured']:
    df[col] = df[col].astype(str).str.lower().str.strip()

# Drop rows missing product_name or product_price (price essential for ML)
df = df.dropna(subset=['product_name', 'product_price'])

# Step 2: Prepare features for ML model (one-hot encoding)
X = pd.get_dummies(df[['salt_composition', 'product_manufactured']])
y = df['product_price']

# Step 3: Split data for training/testing
X_train, X_test, y_train, y_test = train_test_split(
    X, y, test_size=0.2, random_state=42
)

# Step 4: Train Random Forest Regressor
model = RandomForestRegressor(
    n_estimators=50, max_depth=15, random_state=42, n_jobs=-1
)
model.fit(X_train, y_train)

# Step 5: Evaluate model
y_pred = model.predict(X_test)
rmse = mean_squared_error(y_test, y_pred) ** 0.5
print(f"Model RMSE: {rmse:.2f}")

# Step 6: Save trained model
joblib.dump(model, 'medicine_price_model.pkl')
print("Model saved to medicine_price_model.pkl")

# AI agent functions

def parse_salt(salt_str):
    # Parse salt compositions (e.g., split by '+') into set for easy comparison
    return set(salt_str.replace(" ", "").split('+'))

def find_alternatives_by_medicine_name(prescribed_medicine_name, df, max_results=5, show_expensive=False):
    # Use substring matching to find medicine rows (more flexible matching)
    matches = df[df['product_name'].str.contains(prescribed_medicine_name.lower().strip(), na=False)]

    if matches.empty:
        return f"Medicine '{prescribed_medicine_name}' not found."

    # Use the first matching medicine
    medicine_row = matches.iloc[0:1]

    prescribed_salts = parse_salt(medicine_row.iloc[0]['salt_composition'])
    prescribed_price = medicine_row.iloc[0]['product_price']

    candidates = df[df['salt_composition'].apply(lambda x: parse_salt(x) == prescribed_salts)]
    candidates = candidates[candidates['product_name'] != medicine_row.iloc[0]['product_name']]

    if not show_expensive:
        alternatives = candidates[candidates['product_price'] < prescribed_price]
        alternatives = alternatives.sort_values('product_price').head(max_results)
    else:
        alternatives = candidates[candidates['product_price'] >= prescribed_price]
        alternatives = alternatives.sort_values('product_price').head(max_results)

    if not alternatives.empty:
        return alternatives[['product_name', 'salt_composition', 'product_price']].to_dict(orient='records')

    # fallback on partial salt intersection (>1 salt)
    def salt_similarity(salts):
        candidate_salts = parse_salt(salts)
        common = prescribed_salts.intersection(candidate_salts)
        missing = prescribed_salts.difference(candidate_salts)
        extra = candidate_salts.difference(prescribed_salts)
        return len(common), missing, extra

    df['similarity'] = df['salt_composition'].apply(lambda x: salt_similarity(x)[0])
    df['missing'] = df['salt_composition'].apply(lambda x: salt_similarity(x)[1])
    df['extra'] = df['salt_composition'].apply(lambda x: salt_similarity(x)[2])

    search_df = df[df['product_name'] != medicine_row.iloc[0]['product_name']]
    search_df = search_df[search_df['similarity'] > 1]
    search_df = search_df.sort_values(by=['similarity', 'product_price'], ascending=[False, True])

    results = []
    count = 0
    for _, row in search_df.iterrows():
        if count >= max_results:
            break
        warning = ""
        if row['missing']:
            warning += f"Missing salts: {', '.join(row['missing'])}. "
        if row['extra']:
            warning += f"Contains extra salts: {', '.join(row['extra'])}."
        results.append({
            'product_name': row['product_name'],
            'salt_composition': row['salt_composition'],
            'product_price': row['product_price'],
            'warning': warning.strip()
        })
        count += 1

    return results if results else "No alternatives or similar medicines found."

# CLI interactive usage

def run_ai_agent():
    while True:
        medicine_name = input("Enter medicine name (or 'exit' to quit): ").strip().lower()
        if medicine_name == 'exit':
            break

        alternatives = find_alternatives_by_medicine_name(medicine_name, df, max_results=5, show_expensive=False)

        if isinstance(alternatives, str):
            print(alternatives)  # e.g., medicine not found message
        else:
            print(f"Alternatives for '{medicine_name}':")
            for alt in alternatives:
                print(f"- Medicine Name: {alt['product_name']}")
                print(f"  Salt Composition: {alt['salt_composition']}")
                print(f"  Price: ₹{alt['product_price']}")
                if alt.get('warning'):
                    print(f"  Note: {alt['warning']}")
                print()

if __name__ == '__main__':
    run_ai_agent()
