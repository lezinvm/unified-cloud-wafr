import asyncio
from motor.motor_asyncio import AsyncIOMotorClient

async def inspect():
    client = AsyncIOMotorClient('mongodb://127.0.0.1:27017')
    db = client['wafr_db']
    cols = await db.list_collection_names()
    print('All Collections:', cols)
    for c in cols:
        count = await db[c].count_documents({})
        sample = await db[c].find_one({}, {'_id': 0})
        sample_keys = list(sample.keys()) if sample else []
        print(f'{c}: {count} documents. Sample keys: {sample_keys}')

if __name__ == '__main__':
    asyncio.run(inspect())
