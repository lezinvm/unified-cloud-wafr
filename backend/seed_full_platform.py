import os
import json
from pymongo import MongoClient

MONGO_URI = os.getenv("MONGO_URI", "mongodb://localhost:27017")
DB_NAME = os.getenv("DB_NAME", "wafr_db")

INITIAL_USERS = [
    { "id": "usr-01", "name": "Jagan Gurugubelli", "email": "jagan.gurugubelli@cloudifyops.com", "organization": "CloudifyOps", "status": "Active", "plan": "Enterprise", "costUsage": 14.85, "tokenUsage": 2410500, "projects": ["WAFR Review - 1", "PROD Modernization", "AWS Assessment"], "createdAt": "Sep 01, 2024", "lastActive": "5 mins ago" },
    { "id": "usr-02", "name": "Thiruvengadam Raju", "email": "thiruvengadam.raju@cloudifyops.com", "organization": "Acme Corp", "status": "Active", "plan": "Enterprise", "costUsage": 8.40, "tokenUsage": 1380200, "projects": ["Azure Migrations", "Security Audit"], "createdAt": "Sep 01, 2024", "lastActive": "12 mins ago" },
    { "id": "usr-03", "name": "Vais Afeefa", "email": "vais.afeefa@cloudifyops.com", "organization": "CloudifyOps", "status": "Active", "plan": "Enterprise", "costUsage": 6.20, "tokenUsage": 940000, "projects": ["Governance Portal"], "createdAt": "Sep 01, 2024", "lastActive": "1 hour ago" },
    { "id": "usr-04", "name": "Mariyam Qurashi", "email": "mariyam.qurashi@cloudifyops.com", "organization": "Contoso Tech", "status": "Active", "plan": "Enterprise", "costUsage": 4.50, "tokenUsage": 720000, "projects": ["Multi-Cloud WAFR"], "createdAt": "Sep 01, 2024", "lastActive": "3 hours ago" },
    { "id": "usr-05", "name": "Dhernis Tiwari", "email": "dhernis.tiwari@cloudifyops.com", "organization": "FinTech Cloud", "status": "Active", "plan": "Pro", "costUsage": 3.80, "tokenUsage": 610000, "projects": ["Cost Optimizer"], "createdAt": "Sep 01, 2024", "lastActive": "Yesterday" },
    { "id": "usr-06", "name": "Jabin Sebastian", "email": "jabin.sebastian@cloudifyops.com", "organization": "CloudifyOps", "status": "Active", "plan": "Enterprise", "costUsage": 5.10, "tokenUsage": 830000, "projects": ["AWS Lens 2026"], "createdAt": "Sep 01, 2024", "lastActive": "2 days ago" },
    { "id": "usr-07", "name": "Cloudn 836 Hub", "email": "cloudn-836-hub@cloudifyops.com", "organization": "Global Hub Ltd", "status": "Inactive", "plan": "Starter", "costUsage": 0.20, "tokenUsage": 35000, "projects": [], "createdAt": "Aug 15, 2024", "lastActive": "18 days ago" },
    { "id": "usr-08", "name": "Vishal Agrawal", "email": "vishal.agrawal@cloudifyops.com", "organization": "DataCorp Enterprise", "status": "Active", "plan": "Pro", "costUsage": 7.30, "tokenUsage": 1190000, "projects": ["SecOps Automation"], "createdAt": "Sep 01, 2024", "lastActive": "30 mins ago" },
    { "id": "usr-09", "name": "Lezin VM", "email": "lezin.menath@cloudifyops.com", "organization": "CloudifyOps", "status": "Active", "plan": "Enterprise", "costUsage": 12.90, "tokenUsage": 2150000, "projects": ["Unified Cloud Lens", "AI Fix Assistant"], "createdAt": "Sep 01, 2024", "lastActive": "Just now" },
    { "id": "usr-10", "name": "Karthick Duraiswamy", "email": "karthickduraiswamy@cloudifyops.com", "organization": "CloudifyOps", "status": "Active", "plan": "Enterprise", "costUsage": 9.60, "tokenUsage": 1540000, "projects": ["WAFR Review - 1", "FinOps Insights"], "createdAt": "Sep 01, 2024", "lastActive": "45 mins ago" },
    { "id": "usr-11", "name": "Kiran K", "email": "kiran.k@cloudifyops.com", "organization": "Apex Solutions", "status": "Active", "plan": "Pro", "costUsage": 4.90, "tokenUsage": 780000, "projects": ["GCP Compliance"], "createdAt": "Sep 01, 2024", "lastActive": "4 hours ago" },
    { "id": "usr-12", "name": "Akshay VM", "email": "akshay.vm@cloudifyops.com", "organization": "CloudifyOps", "status": "Active", "plan": "Pro", "costUsage": 5.70, "tokenUsage": 910000, "projects": ["IaC Remediation"], "createdAt": "Sep 01, 2024", "lastActive": "1 day ago" },
    { "id": "usr-13", "name": "Jayasharma Alagupandhy", "email": "jayasharma.alagupandhy@cloudifyops.com", "organization": "Alpha Cloud Ltd", "status": "Active", "plan": "Enterprise", "costUsage": 8.10, "tokenUsage": 1300000, "projects": ["PROD Modernization"], "createdAt": "Sep 01, 2024", "lastActive": "2 hours ago" },
    { "id": "usr-14", "name": "Abhijith Sasidharan", "email": "abhijith.sasidharan@cloudifyops.com", "organization": "CloudifyOps", "status": "Active", "plan": "Enterprise", "costUsage": 6.90, "tokenUsage": 1120000, "projects": ["Security Posture"], "createdAt": "Sep 01, 2024", "lastActive": "5 hours ago" },
    { "id": "usr-15", "name": "Manoj Chalapaka", "email": "manoj.chalapaka@cloudifyops.com", "organization": "CyberSec Shield", "status": "Inactive", "plan": "Starter", "costUsage": 0.50, "tokenUsage": 85000, "projects": [], "createdAt": "Aug 20, 2024", "lastActive": "25 days ago" }
]

def seed_full_platform():
    client = MongoClient(MONGO_URI)
    db = client[DB_NAME]
    print(f"Connecting to MongoDB at {MONGO_URI} [db: {DB_NAME}]...")

    json_path = os.path.join(os.path.dirname(__file__), "platform_data_dump.json")
    if not os.path.exists(json_path):
        print(f"[ERROR] Dump file not found: {json_path}")
        return

    with open(json_path, "r", encoding="utf-8") as f:
        data = json.load(f)

    # 1. Seed Pillars (pillars collection)
    pillars = data.get("pillars", [])
    if pillars:
        db["pillars"].drop()
        for idx, p in enumerate(pillars):
            p["display_order"] = idx
        db["pillars"].insert_many(pillars)
        print(f"[OK] Seeded {len(pillars)} pillars into 'pillars' collection")

    # 2. Seed Compliance Frameworks (compliance_frameworks collection)
    compliance_frameworks = data.get("complianceFrameworks", [])
    if compliance_frameworks:
        db["compliance_frameworks"].drop()
        db["compliance_frameworks"].insert_many(compliance_frameworks)
        print(f"[OK] Seeded {len(compliance_frameworks)} frameworks into 'compliance_frameworks' collection")

    # 3. Seed Integrations Config (integrations collection)
    integrations_dict = data.get("integrations", {})
    if integrations_dict:
        db["integrations"].drop()
        integration_docs = []
        for service_type, config in integrations_dict.items():
            config["service_type"] = service_type
            integration_docs.append(config)
        db["integrations"].insert_many(integration_docs)
        print(f"[OK] Seeded {len(integration_docs)} integrations into 'integrations' collection")

    # 4. Seed Alert Logs (alert_logs collection)
    alert_logs = data.get("alertLogs", [])
    if alert_logs:
        db["alert_logs"].drop()
        db["alert_logs"].insert_many(alert_logs)
        print(f"[OK] Seeded {len(alert_logs)} alert logs into 'alert_logs' collection")

    # 5. Seed Questionnaire Questions (questionnaire_questions collection)
    org_questions = data.get("orgQuestions", [])
    if org_questions:
        db["questionnaire_questions"].drop()
        db["questionnaire_questions"].insert_many(org_questions)
        print(f"[OK] Seeded {len(org_questions)} questions into 'questionnaire_questions' collection")

    # 6. Seed Users (users collection)
    if INITIAL_USERS:
        db["users"].drop()
        db["users"].insert_many(INITIAL_USERS)
        print(f"[OK] Seeded {len(INITIAL_USERS)} users into 'users' collection")

    print("\n[SUCCESS] Full platform seed completed! All datasets are now in MongoDB.")

if __name__ == "__main__":
    seed_full_platform()
