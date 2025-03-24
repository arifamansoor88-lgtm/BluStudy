from azure.cosmos import CosmosClient
import os
from dotenv import load_dotenv

# Load environment variables (optional but recommended)
load_dotenv()

# Cosmos DB Configuration
COSMOS_DB_URL = os.getenv("COSMOS_DB_URL")  # Your Cosmos DB endpoint
COSMOS_DB_KEY = os.getenv("COSMOS_DB_KEY")  # Your Cosmos DB primary key
COSMOS_DB_NAME = "ai-education-platform-db"    # Your database name
COSMOS_DB_CONTAINER = "UserContent"        # Your container name

# Initialize Cosmos Client
client = CosmosClient(COSMOS_DB_URL, credential=COSMOS_DB_KEY)

# Get reference to database
database = client.get_database_client(COSMOS_DB_NAME)

# Get reference to the existing container
container = database.get_container_client(COSMOS_DB_CONTAINER)

print("✅ Successfully connected to Azure Cosmos DB!")
