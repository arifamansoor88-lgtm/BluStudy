#!/usr/bin/env python3
"""
Simple test script to check backend functionality
"""
import os
import sys
from dotenv import load_dotenv

# Load environment variables
load_dotenv()

def test_environment():
    """Test if required environment variables are set"""
    print("=== Environment Variables Test ===")
    
    required_vars = [
        "COSMOS_DB_URL",
        "COSMOS_DB_KEY", 
        "AZURE_OPENAI_QUIZ_GENERATOR_ENDPOINT",
        "AZURE_OPENAI_QUIZ_GENERATOR_API_KEY",
        "AZURE_OPENAI_QUIZ_GENERATOR_DEPLOYMENT_NAME"
    ]
    
    missing_vars = []
    for var in required_vars:
        value = os.getenv(var)
        if value:
            print(f"✅ {var}: SET")
        else:
            print(f"❌ {var}: NOT SET")
            missing_vars.append(var)
    
    if missing_vars:
        print(f"\n❌ Missing environment variables: {', '.join(missing_vars)}")
        print("Please check your .env file and ensure all required variables are set.")
        return False
    else:
        print("\n✅ All required environment variables are set!")
        return True

def test_database_connection():
    """Test database connection"""
    print("\n=== Database Connection Test ===")
    
    try:
        from database import client, container
        
        # Try to query the database
        query = "SELECT VALUE COUNT(1) FROM c"
        result = list(container.query_items(
            query=query,
            enable_cross_partition_query=True
        ))
        
        count = result[0] if result else 0
        print(f"✅ Database connection successful! Document count: {count}")
        return True
        
    except Exception as e:
        print(f"❌ Database connection failed: {str(e)}")
        return False

def test_openai_connection():
    """Test OpenAI connection"""
    print("\n=== OpenAI Connection Test ===")
    
    try:
        from openai_client import quiz_client
        
        # Try a simple test call
        response = quiz_client.chat.completions.create(
            model=os.getenv("AZURE_OPENAI_QUIZ_GENERATOR_DEPLOYMENT_NAME"),
            messages=[
                {"role": "user", "content": "Hello, this is a test."}
            ],
            max_tokens=10
        )
        
        print("✅ OpenAI connection successful!")
        return True
        
    except Exception as e:
        print(f"❌ OpenAI connection failed: {str(e)}")
        return False

def main():
    """Run all tests"""
    print("Backend Test Script")
    print("=" * 50)
    
    # Test environment variables
    env_ok = test_environment()
    
    if not env_ok:
        print("\n❌ Environment test failed. Please fix environment variables first.")
        sys.exit(1)
    
    # Test database connection
    db_ok = test_database_connection()
    
    # Test OpenAI connection
    openai_ok = test_openai_connection()
    
    print("\n=== Summary ===")
    if env_ok and db_ok and openai_ok:
        print("✅ All tests passed! Backend should work correctly.")
    else:
        print("❌ Some tests failed. Please check the errors above.")
        if not db_ok:
            print("  - Database connection issue")
        if not openai_ok:
            print("  - OpenAI connection issue")

if __name__ == "__main__":
    main() 