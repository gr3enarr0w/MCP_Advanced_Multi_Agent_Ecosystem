"""
Context Persistence MCP Server

Local-first conversation history with semantic search using:
- SQLite for structured storage
- Qdrant (local) for vector embeddings
- Sentence transformers for embeddings
"""

import asyncio
import os
from pathlib import Path
from typing import Any, Optional
from datetime import datetime
import json
from contextlib import asynccontextmanager

from mcp.server.fastmcp import FastMCP, Context
from mcp.server.session import ServerSession
from qdrant_client import QdrantClient
from qdrant_client.models import Distance, VectorParams, PointStruct
from sentence_transformers import SentenceTransformer
import sqlalchemy as sa
from sqlalchemy.ext.asyncio import create_async_engine, AsyncSession
from sqlalchemy.orm import declarative_base, sessionmaker
import tiktoken

# Configuration
MCP_HOME = Path.home() / ".mcp"
CONTEXT_DB = MCP_HOME / "context" / "db" / "conversation.db"
QDRANT_PATH = MCP_HOME / "context" / "qdrant"

# Ensure directories exist
CONTEXT_DB.parent.mkdir(parents=True, exist_ok=True)
QDRANT_PATH.mkdir(parents=True, exist_ok=True)

# SQLAlchemy setup
Base = declarative_base()

class Conversation(Base):
    __tablename__ = "conversations"
    
    id = sa.Column(sa.String, primary_key=True)
    started_at = sa.Column(sa.DateTime, default=datetime.utcnow)
    project_path = sa.Column(sa.String, nullable=True)
    mode = sa.Column(sa.String, nullable=True)
    meta_data = sa.Column(sa.JSON, default=dict)

class Message(Base):
    __tablename__ = "messages"
    
    id = sa.Column(sa.Integer, primary_key=True, autoincrement=True)
    conversation_id = sa.Column(sa.String, sa.ForeignKey("conversations.id"))
    timestamp = sa.Column(sa.DateTime, default=datetime.utcnow)
    role = sa.Column(sa.String)  # user, assistant, system
    content = sa.Column(sa.Text)
    tokens = sa.Column(sa.Integer, nullable=True)
    embedding_id = sa.Column(sa.String, nullable=True)  # References Qdrant point

class Decision(Base):
    __tablename__ = "decisions"
    
    id = sa.Column(sa.Integer, primary_key=True, autoincrement=True)
    conversation_id = sa.Column(sa.String, sa.ForeignKey("conversations.id"))
    timestamp = sa.Column(sa.DateTime, default=datetime.utcnow)
    decision_type = sa.Column(sa.String)
    context = sa.Column(sa.Text)
    outcome = sa.Column(sa.Text)

# Global instances (lazy initialization)
db_engine = None
async_session = None
qdrant_client = None
embedding_model = None
tokenizer = None
_initialized = False

async def ensure_initialized():
    """Ensure all components are initialized (lazy initialization)"""
    global db_engine, async_session, qdrant_client, embedding_model, tokenizer, _initialized
    
    if _initialized:
        return
    
    try:
        # Initialize database
        if db_engine is None:
            db_url = f"sqlite+aiosqlite:///{CONTEXT_DB}"
            db_engine = create_async_engine(db_url, echo=False)
            
            async with db_engine.begin() as conn:
                await conn.run_sync(Base.metadata.create_all)
            
            async_session = sessionmaker(
                db_engine, class_=AsyncSession, expire_on_commit=False
            )
        
        # Initialize Qdrant
        if qdrant_client is None:
            qdrant_client = QdrantClient(path=str(QDRANT_PATH))
            
            # Create collection for message embeddings
            try:
                qdrant_client.get_collection("messages")
            except Exception:
                qdrant_client.create_collection(
                    collection_name="messages",
                    vectors_config=VectorParams(size=384, distance=Distance.COSINE)
                )
        
        # Initialize models
        if embedding_model is None:
            embedding_model = SentenceTransformer('all-MiniLM-L6-v2')
            tokenizer = tiktoken.get_encoding("cl100k_base")
        
        _initialized = True
        print("✅ Context Persistence server initialized")
        
    except Exception as e:
        print(f"❌ Context Persistence server initialization failed: {e}")
        raise

# Initialize FastMCP server without lifespan
mcp = FastMCP("Context Persistence")

def count_tokens(text: str) -> int:
    """Count tokens in text"""
    return len(tokenizer.encode(text))

def generate_embedding(text: str) -> list[float]:
    """Generate embedding for text"""
    return embedding_model.encode(text).tolist()

@mcp.tool()
async def save_conversation(
    conversation_id: str,
    messages: list[dict[str, str]],
    project_path: Optional[str] = None,
    mode: Optional[str] = None,
    metadata: Optional[dict[str, Any]] = None
) -> dict[str, Any]:
    """
    Save a conversation with messages to local storage and generate embeddings.
    
    Args:
        conversation_id: Unique conversation identifier
        messages: List of messages with 'role' and 'content' keys
        project_path: Optional project path
        mode: Optional mode (code, architect, etc.)
        metadata: Optional metadata dict
    
    Returns:
        dict with conversation_id, message_count, and status
    """
    await ensure_initialized()
    async with async_session() as session:
        # Create or update conversation
        conv = await session.get(Conversation, conversation_id)
        if not conv:
            conv = Conversation(
                id=conversation_id,
                project_path=project_path,
                mode=mode,
                meta_data=metadata or {}
            )
            session.add(conv)
        
        # Save messages and generate embeddings
        points = []
        for msg in messages:
            content = msg.get("content", "")
            role = msg.get("role", "user")
            
            # Count tokens
            tokens = count_tokens(content)
            
            # Generate embedding
            embedding = generate_embedding(content)
            embedding_id = f"{conversation_id}_{len(points)}"
            
            # Create message record
            message = Message(
                conversation_id=conversation_id,
                role=role,
                content=content,
                tokens=tokens,
                embedding_id=embedding_id
            )
            session.add(message)
            
            # Prepare Qdrant point
            points.append(PointStruct(
                id=embedding_id,
                vector=embedding,
                payload={
                    "conversation_id": conversation_id,
                    "role": role,
                    "content": content,
                    "timestamp": datetime.utcnow().isoformat()
                }
            ))
        
        await session.commit()
        
        # Upload embeddings to Qdrant
        qdrant_client.upsert(
            collection_name="messages",
            points=points
        )
        
        return {
            "conversation_id": conversation_id,
            "message_count": len(messages),
            "status": "saved"
        }

@mcp.tool()
async def search_similar_conversations(
    query: str,
    limit: int = 5,
    min_score: float = 0.7
) -> list[dict[str, Any]]:
    """
    Search for similar conversations using semantic search.
    
    Args:
        query: Search query text
        limit: Maximum number of results
        min_score: Minimum similarity score (0-1)
    
    Returns:
        List of matching messages with conversation context
    """
    # Generate query embedding
    query_embedding = generate_embedding(query)
    
    # Search in Qdrant
    results = qdrant_client.search(
        collection_name="messages",
        query_vector=query_embedding,
        limit=limit,
        score_threshold=min_score
    )
    
    # Format results
    matches = []
    for result in results:
        matches.append({
            "conversation_id": result.payload["conversation_id"],
            "role": result.payload["role"],
            "content": result.payload["content"],
            "timestamp": result.payload["timestamp"],
            "similarity_score": result.score
        })
    
    return matches

@mcp.tool()
async def load_conversation_history(
    conversation_id: str,
    limit: Optional[int] = None
) -> dict[str, Any]:
    """
    Load conversation history from local storage.
    
    Args:
        conversation_id: Conversation identifier
        limit: Optional limit on number of messages to return
    
    Returns:
        Conversation data with messages
    """
    async with async_session() as session:
        # Get conversation
        conv = await session.get(Conversation, conversation_id)
        if not conv:
            return {"error": "Conversation not found"}
        
        # Get messages
        query = sa.select(Message).where(
            Message.conversation_id == conversation_id
        ).order_by(Message.timestamp)
        
        if limit:
            query = query.limit(limit)
        
        result = await session.execute(query)
        messages = result.scalars().all()
        
        return {
            "conversation_id": conversation_id,
            "started_at": conv.started_at.isoformat(),
            "project_path": conv.project_path,
            "mode": conv.mode,
            "metadata": conv.meta_data,
            "messages": [
                {
                    "id": msg.id,
                    "role": msg.role,
                    "content": msg.content,
                    "timestamp": msg.timestamp.isoformat(),
                    "tokens": msg.tokens
                }
                for msg in messages
            ]
        }

@mcp.tool()
async def save_decision(
    conversation_id: str,
    decision_type: str,
    context: str,
    outcome: str
) -> dict[str, str]:
    """
    Log an important decision in the conversation.
    
    Args:
        conversation_id: Conversation identifier
        decision_type: Type of decision (e.g., "architecture", "implementation")
        context: Context leading to the decision
        outcome: Decision outcome or result
    
    Returns:
        Status confirmation
    """
    async with async_session() as session:
        decision = Decision(
            conversation_id=conversation_id,
            decision_type=decision_type,
            context=context,
            outcome=outcome
        )
        session.add(decision)
        await session.commit()
        
        return {
            "status": "saved",
            "decision_type": decision_type
        }

@mcp.tool()
async def get_conversation_stats() -> dict[str, Any]:
    """
    Get statistics about stored conversations.
    
    Returns:
        Stats including conversation count, message count, total tokens
    """
    async with async_session() as session:
        # Count conversations
        conv_count = await session.execute(
            sa.select(sa.func.count(Conversation.id))
        )
        
        # Count messages
        msg_count = await session.execute(
            sa.select(sa.func.count(Message.id))
        )
        
        # Sum tokens
        token_sum = await session.execute(
            sa.select(sa.func.sum(Message.tokens))
        )
        
        return {
            "conversations": conv_count.scalar(),
            "messages": msg_count.scalar(),
            "total_tokens": token_sum.scalar() or 0,
            "database_path": str(CONTEXT_DB),
            "qdrant_path": str(QDRANT_PATH)
        }

def main():
    """Run the server"""
    import sys
    mcp.run(transport="stdio")

if __name__ == "__main__":
    main()