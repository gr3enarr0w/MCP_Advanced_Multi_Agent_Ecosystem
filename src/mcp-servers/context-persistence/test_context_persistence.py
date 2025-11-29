#!/usr/bin/env python3
"""
Comprehensive test script for context-persistence MCP server.
Tests server initialization, tool registration, and basic functionality.
"""

import asyncio
import sys
import os
import json
from pathlib import Path

# Add src to path for imports
sys.path.insert(0, str(Path(__file__).parent / "src"))

import pytest
from context_persistence.server import mcp

async def test_server_initialization():
    """Test that the server initializes correctly"""
    print("✅ Testing server initialization...")
    
    # Check that mcp instance exists
    assert mcp is not None, "MCP server instance is None"
    print("  ✓ MCP server instance created")
    
    # Use FastMCP test client to verify tools
    async with mcp.test_client() as client:
        # Get available tools
        tools_response = await client.list_tools()
        tools = tools_response.tools
        
        assert len(tools) > 0, "No tools registered in MCP server"
        print(f"  ✓ {len(tools)} tools registered")
        
        # List all tool names
        tool_names = [tool.name for tool in tools]
        print(f"  ✓ Available tools: {', '.join(tool_names)}")
    
    return True

async def test_save_conversation():
    """Test saving a conversation"""
    print("\n✅ Testing save_conversation tool...")
    
    conversation_id = "test-conversation-123"
    messages = [
        {"role": "user", "content": "Hello, how are you?"},
        {"role": "assistant", "content": "I'm doing well, thank you!"}
    ]
    
    async with mcp.test_client() as client:
        result = await client.call_tool("save_conversation", {
            "conversation_id": conversation_id,
            "messages": messages,
            "project_path": "/test/project",
            "mode": "test"
        })
        
        assert result["conversation_id"] == conversation_id
        assert result["message_count"] == 2
        assert result["status"] == "saved"
        print(f"  ✓ Conversation saved: {result}")
    
    return True

async def test_load_conversation():
    """Test loading a conversation"""
    print("\n✅ Testing load_conversation_history tool...")
    
    conversation_id = "test-conversation-123"
    
    result = await load_conversation_history(
        conversation_id=conversation_id
    )
    
    assert "error" not in result, f"Error loading conversation: {result.get('error')}"
    assert result["conversation_id"] == conversation_id
    assert len(result["messages"]) == 2
    print(f"  ✓ Conversation loaded: {len(result['messages'])} messages")
    
    return True

async def test_search_conversations():
    """Test searching conversations"""
    print("\n✅ Testing search_similar_conversations tool...")
    
    result = await search_similar_conversations(
        query="hello",
        limit=5,
        min_score=0.1  # Lower threshold for testing
    )
    
    assert isinstance(result, list)
    print(f"  ✓ Search returned {len(result)} results")
    
    if len(result) > 0:
        print(f"  ✓ First result: {result[0]}")
    
    return True

async def test_get_stats():
    """Test getting conversation statistics"""
    print("\n✅ Testing get_conversation_stats tool...")
    
    result = await get_conversation_stats()
    
    assert "conversations" in result
    assert "messages" in result
    assert "total_tokens" in result
    print(f"  ✓ Stats: {result['conversations']} conversations, {result['messages']} messages")
    
    return True

async def test_entity_extraction():
    """Test entity extraction"""
    print("\n✅ Testing extract_entities tool...")
    
    conversation_id = "test-conversation-123"
    
    result = await extract_entities(
        conversation_id=conversation_id
    )
    
    assert "conversation_id" in result
    assert "entities_extracted" in result
    print(f"  ✓ Extracted {result['entities_extracted']} entities")
    
    return True

async def test_knowledge_graph():
    """Test knowledge graph operations"""
    print("\n✅ Testing knowledge graph operations...")
    
    # Test graph stats
    result = await query_knowledge_graph(
        entity_id="test",
        operation="stats"
    )
    
    print(f"  ✓ Graph stats: {result}")
    
    return True

async def test_hybrid_search():
    """Test hybrid search"""
    print("\n✅ Testing hybrid search...")
    
    result = await search_hybrid(
        query="test query",
        mode="semantic",
        limit=5
    )
    
    assert isinstance(result, list)
    print(f"  ✓ Hybrid search returned {len(result)} results")
    
    return True

async def run_all_tests():
    """Run all tests"""
    print("🧪 Starting comprehensive context-persistence server tests...\n")
    
    tests = [
        test_server_initialization,
        test_save_conversation,
        test_load_conversation,
        test_search_conversations,
        test_get_stats,
        test_entity_extraction,
        test_knowledge_graph,
        test_hybrid_search
    ]
    
    passed = 0
    failed = 0
    
    for test in tests:
        try:
            result = await test()
            if result:
                passed += 1
        except Exception as e:
            print(f"  ❌ Test failed: {e}")
            failed += 1
            import traceback
            traceback.print_exc()
    
    print(f"\n📊 Test Results: {passed} passed, {failed} failed")
    
    if failed == 0:
        print("🎉 All tests passed! Context-persistence server is working correctly.")
        return True
    else:
        print("❌ Some tests failed. Check the errors above.")
        return False

if __name__ == "__main__":
    success = asyncio.run(run_all_tests())
    sys.exit(0 if success else 1)