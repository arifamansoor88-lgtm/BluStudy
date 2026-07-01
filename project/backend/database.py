from azure.cosmos import CosmosClient
import os
from dotenv import load_dotenv

# Load environment variables
load_dotenv()

# Cosmos DB Configuration
COSMOS_DB_URL = os.getenv("COSMOS_DB_URL")
COSMOS_DB_KEY = os.getenv("COSMOS_DB_KEY")
COSMOS_DB_NAME = "ai-education-platform-db"
COSMOS_DB_CONTAINER = "userContent"

# Initialize Cosmos Client only when credentials are present (local dev uses LocalContainer in main)
client = None
container = None

if COSMOS_DB_URL and COSMOS_DB_KEY:
    try:
        client = CosmosClient(COSMOS_DB_URL, credential=COSMOS_DB_KEY)
        database = client.get_database_client(COSMOS_DB_NAME)
        container = database.get_container_client(COSMOS_DB_CONTAINER)
    except Exception as e:
        print(f"[database] WARNING: Could not connect to Cosmos DB: {e}")
        print("[database] Server will start but database operations will fail.")
