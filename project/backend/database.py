from azure.cosmos import CosmosClient
import os
from dotenv import load_dotenv

# Load environment variables
load_dotenv()

# Cosmos DB Configuration
COSMOS_DB_URL = os.getenv("COSMOS_DB_URL")
COSMOS_DB_KEY = os.getenv("COSMOS_DB_KEY")
COSMOS_DB_NAME = "ai-education"
COSMOS_DB_CONTAINER = "userContent"

# Initialize Cosmos Client
client = CosmosClient(COSMOS_DB_URL, credential=COSMOS_DB_KEY)

# Get reference to database
database = client.get_database_client(COSMOS_DB_NAME)

# Get reference to the container
container = database.get_container_client(COSMOS_DB_CONTAINER)
