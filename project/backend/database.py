from azure.cosmos import CosmosClient
import os
from dotenv import load_dotenv

load_dotenv()

COSMOS_DB_URL = os.getenv("COSMOS_DB_URL")
COSMOS_DB_KEY = os.getenv("COSMOS_DB_KEY")
COSMOS_DB_NAME = "ai-education"
COSMOS_DB_CONTAINER = "userData"

# Initialize Cosmos Client only when credentials are present (local dev uses LocalContainer in main)
client = None
container = None

if COSMOS_DB_URL and COSMOS_DB_KEY:
    client = CosmosClient(COSMOS_DB_URL, credential=COSMOS_DB_KEY)
    database = client.get_database_client(COSMOS_DB_NAME)
    container = database.get_container_client(COSMOS_DB_CONTAINER)
