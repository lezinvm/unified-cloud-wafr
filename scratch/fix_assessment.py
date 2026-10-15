import asyncio
from motor.motor_asyncio import AsyncIOMotorClient

async def main():
    client = AsyncIOMotorClient("mongodb://127.0.0.1:27017")
    db = client["wafr_db"]
    r = await db["assessments"].update_one(
        {"id": "A-001"},
        {"$set": {
            "user_id": "8b694203-2f05-4510-8239-8419c3f66d2d",
            "org_id": "org_akshay_vm"
        }}
    )
    print("Updated A-001 modified count:", r.modified_count)
    doc = await db["assessments"].find_one({"id": "A-001"}, {"_id": 0, "id": 1, "user_id": 1, "org_id": 1, "account_name": 1})
    print("Verified doc:", doc)

if __name__ == "__main__":
    asyncio.run(main())
