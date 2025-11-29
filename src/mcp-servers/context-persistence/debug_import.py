#!/usr/bin/env python3
"""
Debug script to identify problematic imports causing segmentation fault
"""

import sys
import traceback

def test_import(module_name):
    """Test importing a module and catch any errors"""
    try:
        print(f"Testing import: {module_name}")
        __import__(module_name)
        print(f"✅ {module_name} - OK")
        return True
    except Exception as e:
        print(f"❌ {module_name} - ERROR: {e}")
        traceback.print_exc()
        return False

def main():
    """Test imports one by one to identify the problematic one"""
    
    # Test basic imports first
    basic_modules = [
        "os",
        "json",
        "asyncio",
        "pathlib",
        "uuid",
        "datetime"
    ]
    
    for module in basic_modules:
        test_import(module)
    
    # Test MCP imports
    mcp_modules = [
        "mcp.server.fastmcp",
        "mcp.server.session"
    ]
    
    for module in mcp_modules:
        test_import(module)
    
    # Test database imports
    db_modules = [
        "sqlalchemy",
        "sqlalchemy.ext.asyncio",
        "sqlalchemy.orm"
    ]
    
    for module in db_modules:
        test_import(module)
    
    # Test vector database imports
    vector_modules = [
        "qdrant_client",
        "qdrant_client.models"
    ]
    
    for module in vector_modules:
        test_import(module)
    
    # Test ML imports (these might be the culprits)
    ml_modules = [
        "sentence_transformers",
        "tiktoken"
    ]
    
    for module in ml_modules:
        test_import(module)
    
    # Test Phase 6 imports (might have heavy dependencies)
    phase6_modules = [
        ".entity_extractor",
        ".knowledge_graph", 
        ".hybrid_search",
        ".models_enhanced"
    ]
    
    for module in phase6_modules:
        try:
            print(f"Testing import: {module}")
            import importlib.util
            spec = importlib.util.spec_from_file_location("test", f"/Users/ceverson/MCP_Advanced_Multi_Agent_Ecosystem/src/mcp-servers/context-persistence/src/context_persistence/{module.replace('.', '/')}.py")
            print(f"✅ {module} spec found")
        except Exception as e:
            print(f"❌ {module} - ERROR: {e}")
            traceback.print_exc()

if __name__ == "__main__":
    main()