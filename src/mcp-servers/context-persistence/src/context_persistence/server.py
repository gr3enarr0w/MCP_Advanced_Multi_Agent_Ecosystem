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
from uuid import uuid4
from datetime import datetime
import json

from mcp.server.fastmcp import FastMCP, Context
from mcp.server.session import ServerSession
from qdrant_client import QdrantClient
from qdrant_client.models import Distance, VectorParams, PointStruct
from sentence_transformers import SentenceTransformer
import sqlalchemy as sa
from sqlalchemy.ext.asyncio import create_async_engine, AsyncSession
from sqlalchemy.orm import declarative_base, sessionmaker
import tiktoken

# Phase 6 imports
from .entity_extractor import EntityExtractor
from .knowledge_graph import KnowledgeGraph
from .hybrid_search import HybridSearch
from .models_enhanced import Entity, Relationship, EntityMention


def _is_writable(path: Path) -> bool:
    """Return True if the path can be created and written to."""
    try:
        path.mkdir(parents=True, exist_ok=True)
        probe = path / ".write_test"
        probe.touch(exist_ok=True)
        probe.unlink(missing_ok=True)
        return True
    except Exception:
        return False


def resolve_mcp_home() -> Path:
    """
    Determine a writable MCP home directory.

    Prefers the configured path (or ~/.mcp), but falls back to a local
    directory inside the project if the default is not writable (e.g., in
    sandboxed environments).
    """
    configured_home = Path(os.environ.get("MCP_HOME", Path.home() / ".mcp"))
    fallback_home = Path.cwd() / ".mcp-local"

    if _is_writable(configured_home):
        return configured_home

    if _is_writable(fallback_home):
        print(f"⚠️  Using fallback MCP storage at {fallback_home}")
        return fallback_home

    raise RuntimeError("No writable MCP storage location available.")


# Configuration
MCP_HOME = resolve_mcp_home()
CONTEXT_DB = MCP_HOME / "context" / "db" / "conversation.db"
QDRANT_PATH = MCP_HOME / "context" / "qdrant"

# Ensure directories exist
CONTEXT_DB.parent.mkdir(parents=True, exist_ok=True)
QDRANT_PATH.mkdir(parents=True, exist_ok=True)


def sanitize_qdrant_metadata(meta_path: Path) -> None:
    """
    Remove deprecated fields from persisted Qdrant metadata.

    Older qdrant-client versions wrote an `init_from` field that the current
    client rejects during load. Cleaning it allows the local store to be
    reopened without wiping user data.
    """
    if not meta_path.exists():
        return

    try:
        data = json.loads(meta_path.read_text())
    except Exception:
        return

    collections = data.get("collections", {})
    changed = False

    if isinstance(collections, dict):
        for _, config in collections.items():
            if isinstance(config, dict) and "init_from" in config:
                config.pop("init_from", None)
                changed = True

    if changed:
        meta_path.write_text(json.dumps(data, indent=2))


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

# Initialize FastMCP server
mcp = FastMCP("Context Persistence")

# Global instances (initialized in lifespan)
db_engine = None
async_session = None
qdrant_client = None
embedding_model = None
tokenizer = None

# Phase 6 instances
entity_extractor = None
knowledge_graph = None
hybrid_search = None

class _SimpleTokenizer:
    """Fallback tokenizer that splits on whitespace and characters."""

    def encode(self, text: str) -> list[int]:
        # Basic encoding: words get index, characters add entropy to spread values.
        if not text:
            return []
        tokens = []
        for word_idx, word in enumerate(text.split()):
            tokens.append(word_idx + 1)
            tokens.extend(ord(ch) for ch in word)
        return tokens


class _TokenHasher:
    """Deterministic, lightweight embedding fallback using token IDs."""

    def encode(self, text: str):
        # Spread token ids across a fixed-size vector to approximate similarity.
        vector = [0.0] * 384
        if tokenizer is None:
            return vector

        for idx, token_id in enumerate(tokenizer.encode(text)):
            vector[idx % len(vector)] += float(token_id)
        return vector

async def init_database():
    """Initialize SQLite database"""
    global db_engine, async_session

    db_url = f"sqlite+aiosqlite:///{CONTEXT_DB}"
    db_engine = create_async_engine(db_url, echo=False)

    # Import all models including Phase 6 models
    from .models_enhanced import Base as EnhancedBase

    async with db_engine.begin() as conn:
        await conn.run_sync(Base.metadata.create_all)
        await conn.run_sync(EnhancedBase.metadata.create_all)

    async_session = sessionmaker(
        db_engine, class_=AsyncSession, expire_on_commit=False
    )

async def init_qdrant():
    """Initialize Qdrant local client"""
    global qdrant_client
    
    sanitize_qdrant_metadata(QDRANT_PATH / "meta.json")
    qdrant_client = QdrantClient(path=str(QDRANT_PATH))
    
    # Create collection for message embeddings
    try:
        qdrant_client.get_collection("messages")
    except Exception:
        qdrant_client.create_collection(
            collection_name="messages",
            vectors_config=VectorParams(size=384, distance=Distance.COSINE)
        )

async def init_models():
    """Initialize embedding model and tokenizer"""
    global embedding_model, tokenizer, entity_extractor, knowledge_graph, hybrid_search

    try:
        tokenizer = tiktoken.get_encoding("cl100k_base")
    except Exception as tokenizer_error:
        print(f"⚠️  Using basic tokenizer fallback: {tokenizer_error}")
        tokenizer = _SimpleTokenizer()
    allow_download = os.environ.get("MCP_ALLOW_MODEL_DOWNLOAD", "").lower() in {
        "1",
        "true",
        "yes",
    }

    try:
        embedding_model = SentenceTransformer(
            "all-MiniLM-L6-v2",
            local_files_only=True
        )
    except Exception:
        if allow_download:
            try:
                embedding_model = SentenceTransformer("all-MiniLM-L6-v2")
            except Exception as download_error:
                print(f"⚠️  Falling back to hashing embeddings (download failed): {download_error}")
                embedding_model = _TokenHasher()
        else:
            print("⚠️  Using hashing embeddings (set MCP_ALLOW_MODEL_DOWNLOAD=1 to allow model download)")
            embedding_model = _TokenHasher()

    # Initialize Phase 6 components
    entity_extractor = EntityExtractor()
    knowledge_graph = KnowledgeGraph()
    hybrid_search = HybridSearch(qdrant_client, embedding_model, knowledge_graph)

# Initialize on import for simplicity
import asyncio
try:
    asyncio.run(init_database())
    asyncio.run(init_qdrant())
    asyncio.run(init_models())
    print("✅ Context Persistence server initialized")
except Exception as e:
    print(f"⚠️  Context Persistence server initialization failed: {e}")

def count_tokens(text: str) -> int:
    """Count tokens in text"""
    return len(tokenizer.encode(text))

def generate_embedding(text: str) -> list[float]:
    """Generate embedding for text"""
    embedding = embedding_model.encode(text)
    return embedding.tolist() if hasattr(embedding, "tolist") else list(embedding)

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
            # Qdrant expects UUID-friendly point ids; generate instead of deriving
            embedding_id = str(uuid4())
            
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
    results = qdrant_client.query_points(
        collection_name="messages",
        query=query_embedding,
        limit=limit,
        score_threshold=min_score
    ).points
    
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

# ============================================================================
# Phase 6 MCP Tools - Entity Extraction, Knowledge Graph, Hybrid Search
# ============================================================================

@mcp.tool()
async def extract_entities(
    conversation_id: str,
    text: Optional[str] = None,
    message_id: Optional[int] = None
) -> dict[str, Any]:
    """
    Extract entities from conversation text using NLP.

    Args:
        conversation_id: Conversation to extract entities from
        text: Optional text to extract from (if not provided, uses all messages)
        message_id: Optional specific message ID

    Returns:
        Dictionary with extracted entities
    """
    async with async_session() as session:
        # If text provided, extract directly
        if text:
            entities = entity_extractor.extract_entities(
                text, conversation_id, message_id
            )
        else:
            # Extract from conversation messages
            query = sa.select(Message).where(
                Message.conversation_id == conversation_id
            )
            if message_id:
                query = query.where(Message.id == message_id)

            result = await session.execute(query)
            messages = result.scalars().all()

            entities = []
            for msg in messages:
                msg_entities = entity_extractor.extract_entities(
                    msg.content, conversation_id, msg.id
                )
                entities.extend(msg_entities)

        # Deduplicate
        entities = entity_extractor.deduplicate_entities(entities)

        # Save to database
        for entity_data in entities:
            entity = Entity(**entity_data)
            session.add(entity)

        await session.commit()

        # Rebuild knowledge graph
        await knowledge_graph.build_graph(session)

        return {
            "conversation_id": conversation_id,
            "entities_extracted": len(entities),
            "entity_types": list(set(e["entity_type"] for e in entities)),
            "entities": entities[:20]  # Return first 20 for preview
        }


@mcp.tool()
async def create_relationship(
    source_entity_id: str,
    target_entity_id: str,
    relationship_type: str,
    confidence: float = 1.0,
    properties: Optional[dict[str, Any]] = None
) -> dict[str, str]:
    """
    Create a relationship between two entities.

    Args:
        source_entity_id: Source entity ID
        target_entity_id: Target entity ID
        relationship_type: Type of relationship (e.g., "works_on", "uses", "created")
        confidence: Confidence score (0-1)
        properties: Optional additional properties

    Returns:
        Status confirmation
    """
    async with async_session() as session:
        # Verify entities exist
        source = await session.get(Entity, source_entity_id)
        target = await session.get(Entity, target_entity_id)

        if not source or not target:
            return {"error": "One or both entities not found"}

        # Create relationship
        now = datetime.utcnow()
        relationship = Relationship(
            id=str(uuid4()),
            source_entity_id=source_entity_id,
            target_entity_id=target_entity_id,
            relationship_type=relationship_type,
            event_time=now,
            ingestion_time=now,
            valid_from=now,
            valid_until=None,
            confidence=confidence,
            properties=properties or {}
        )

        session.add(relationship)
        await session.commit()

        # Rebuild knowledge graph
        await knowledge_graph.build_graph(session)

        return {
            "status": "created",
            "relationship_id": relationship.id,
            "relationship_type": relationship_type
        }


@mcp.tool()
async def query_knowledge_graph(
    entity_id: str,
    depth: int = 2,
    operation: str = "context"
) -> dict[str, Any]:
    """
    Query the knowledge graph for entity information.

    Args:
        entity_id: Entity to query
        depth: Depth of graph traversal
        operation: Operation type (context, neighbors, paths)

    Returns:
        Graph query results
    """
    async with async_session() as session:
        # Ensure graph is built
        if knowledge_graph.graph.number_of_nodes() == 0:
            await knowledge_graph.build_graph(session)

        if operation == "context":
            return knowledge_graph.get_entity_context(entity_id, depth)

        elif operation == "neighbors":
            return knowledge_graph.get_neighbors(entity_id, depth)

        elif operation == "stats":
            return knowledge_graph.get_graph_stats()

        elif operation == "centrality":
            scores = knowledge_graph.get_centrality_scores(limit=20)
            # Add entity names to scores
            results = []
            for eid, score in scores.items():
                if eid in knowledge_graph.graph:
                    results.append({
                        "entity_id": eid,
                        "name": knowledge_graph.graph.nodes[eid].get("name"),
                        "centrality_score": score
                    })
            return {"centrality_scores": results}

        elif operation == "visualize":
            return {
                "mermaid": knowledge_graph.visualize_mermaid(
                    entity_ids=None,
                    max_nodes=30
                )
            }

        else:
            return {"error": f"Unknown operation: {operation}"}


@mcp.tool()
async def search_hybrid(
    query: str,
    mode: str = "hybrid",
    filters: Optional[dict[str, Any]] = None,
    limit: int = 10
) -> list[dict[str, Any]]:
    """
    Perform hybrid search combining semantic, keyword, and graph search.

    Args:
        query: Search query
        mode: Search mode (hybrid, semantic, keyword, graph)
        filters: Optional filters (entity_type, conversation_id, etc.)
        limit: Maximum results to return

    Returns:
        List of search results with scores
    """
    async with async_session() as session:
        # Ensure knowledge graph is built for graph search
        if mode in ("hybrid", "graph"):
            if knowledge_graph.graph.number_of_nodes() == 0:
                await knowledge_graph.build_graph(session)

        results = await hybrid_search.search(
            session, query, mode, filters or {}, limit
        )

        return results


@mcp.tool()
async def get_entity_history(entity_id: str) -> dict[str, Any]:
    """
    Get the full history of an entity including all versions.

    Args:
        entity_id: Entity to get history for

    Returns:
        Entity history with all temporal versions
    """
    async with async_session() as session:
        # Get all versions of this entity
        query = sa.select(Entity).where(
            Entity.id == entity_id
        ).order_by(Entity.valid_from)

        result = await session.execute(query)
        versions = result.scalars().all()

        if not versions:
            return {"error": "Entity not found"}

        history = []
        for version in versions:
            history.append({
                "name": version.name,
                "entity_type": version.entity_type,
                "description": version.description,
                "event_time": version.event_time.isoformat(),
                "ingestion_time": version.ingestion_time.isoformat(),
                "valid_from": version.valid_from.isoformat(),
                "valid_until": version.valid_until.isoformat() if version.valid_until else None,
                "confidence": version.confidence,
                "conversation_id": version.conversation_id,
                "message_id": version.message_id
            })

        return {
            "entity_id": entity_id,
            "current_name": versions[-1].name,
            "version_count": len(versions),
            "history": history
        }


def main():
    """Run the server"""
    import sys
    mcp.run(transport="stdio")

if __name__ == "__main__":
    main()
