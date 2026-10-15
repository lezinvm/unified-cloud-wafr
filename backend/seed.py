import os
import glob
import json
import pandas as pd
from pymongo import MongoClient

MONGO_URI = os.getenv("MONGO_URI", "mongodb://localhost:27017")
DB_NAME = os.getenv("DB_NAME", "wafr_db")

def parse_val(v):
    if pd.isna(v):
        return None
    if isinstance(v, str):
        v_strip = v.strip()
        if (v_strip.startswith("{") and v_strip.endswith("}")) or (v_strip.startswith("[") and v_strip.endswith("]")):
            try:
                return json.loads(v_strip)
            except Exception:
                return v
    return v

def seed_database():
    print(f"Connecting to MongoDB at {MONGO_URI}...")
    try:
        client = MongoClient(MONGO_URI, serverSelectionTimeoutMS=5000)
        # Check connection
        client.admin.command('ping')
        print("Connected to MongoDB successfully!")
    except Exception as e:
        print(f"\n[ERROR] Could not connect to MongoDB: {e}")
        print("Please ensure MongoDB is running locally on port 27017.")
        return False

    db = client[DB_NAME]
    schema_dir = os.path.join(os.path.dirname(__file__), "..", "Database_Schema_Drafts")
    csv_files = glob.glob(os.path.join(schema_dir, "*.csv"))

    if not csv_files:
        print(f"No CSV files found in {schema_dir}")
        return False

    # Sort files to load them consistently
    csv_files.sort(key=lambda x: int(os.path.basename(x).split('_')[0]) if os.path.basename(x).split('_')[0].isdigit() else 999)

    print(f"\nFound {len(csv_files)} schema files. Seeding database '{DB_NAME}'...\n")

    for file_path in csv_files:
        filename = os.path.basename(file_path)
        # Convert "1_organizations.csv" -> "organizations"
        parts = filename.split("_", 1)
        collection_name = parts[1].replace(".csv", "") if len(parts) > 1 else parts[0].replace(".csv", "")

        df = pd.read_csv(file_path)
        records = []
        for _, row in df.iterrows():
            record = {}
            for col, val in row.items():
                record[col] = parse_val(val)
            records.append(record)

        if records:
            col = db[collection_name]
            col.drop()
            col.insert_many(records)
            print(f"  [OK] {collection_name:<30} inserted {len(records)} documents")
        else:
            print(f"  [-]  {collection_name:<30} (empty, skipped)")

    print(f"\nDatabase '{DB_NAME}' seeded successfully!")
    return True

if __name__ == "__main__":
    seed_database()
