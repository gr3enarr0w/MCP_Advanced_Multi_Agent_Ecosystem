"""
Hybrid Search for Phase 6 - Context Persistence

Combines three search strategies:
1. Semantic search (Qdrant vector similarity)
2. Keyword search (SQLite FTS - Full Text Search)
3. Graph search (entity relationships via NetworkX)

Results are ranked and fused for optimal relevance.
"""

from datetime import datetime
from typing import List, Dict, Any, Optional, TYPE_CHECKING
from dataclasses import dataclass
import sqlalchemy as sa
from sqlalchemy.ext.asyncio import AsyncSession
from qdrant_client import QdrantClient
from .models_enhanced import Entity, Relationship, SearchIndex
from .knowledge_graph import KnowledgeGraph

if TYPE_CHECKING:
    from .server import Message


@dataclass
class SearchResult:
    """Individual search result with metadata"""
    item_id: str
    item_type: str  # message, entity, relationship
    content: str
    score: float
    source: str  # semantic, keyword, graph
    metadata: Dict[str, Any]


class HybridSearch:
    """
    Combines semantic, keyword, and graph-based search.
    """

    def __init__(
        self,
        qdrant_client: QdrantClient,
        embedding_model,
        knowledge_graph: KnowledgeGraph
    ):
        """
        Initialize hybrid search with required components.

        Args:
            qdrant_client: Qdrant client for semantic search
            embedding_model: Model for generating embeddings
            knowledge_graph: Knowledge graph for relationship search
        """
        self.qdrant = qdrant_client
        self.embedding_model = embedding_model
        self.kg = knowledge_graph

    async def search(
        self,
        session: AsyncSession,
        query: str,
        mode: str = "hybrid",
        filters: Optional[Dict[str, Any]] = None,
        limit: int = 10,
        min_score: float = 0.5
    ) -> List[Dict[str, Any]]:
        """
        Perform hybrid search combining multiple strategies.

        Args:
            session: Database session
            query: Search query
            mode: Search mode (hybrid, semantic, keyword, graph)
            filters: Optional filters (entity_type, conversation_id, etc.)
            limit: Maximum results to return
            min_score: Minimum relevance score

        Returns:
            List of ranked search results
        """
        filters = filters or {}
        results = []

        # Execute search strategies based on mode
        if mode in ("hybrid", "semantic"):
            semantic_results = await self._semantic_search(
                query, filters, limit, min_score
            )
            results.extend(semantic_results)

        if mode in ("hybrid", "keyword"):
            keyword_results = await self._keyword_search(
                session, query, filters, limit
            )
            results.extend(keyword_results)

        if mode in ("hybrid", "graph"):
            graph_results = await self._graph_search(
                session, query, filters, limit
            )
            results.extend(graph_results)

        # Rank and fuse results
        if mode == "hybrid":
            results = self._fuse_results(results, limit)
        else:
            # Sort by score
            results = sorted(results, key=lambda x: x.score, reverse=True)[:limit]

        # Convert SearchResult objects to dictionaries
        return [
            {
                "item_id": r.item_id,
                "item_type": r.item_type,
                "content": r.content,
                "score": r.score,
                "source": r.source,
                "metadata": r.metadata
            }
            for r in results
            if r.score >= min_score
        ]

    async def _semantic_search(
        self,
        query: str,
        filters: Dict[str, Any],
        limit: int,
        min_score: float
    ) -> List[SearchResult]:
        """
        Semantic search using Qdrant vector similarity.
        """
        # Generate query embedding
        query_embedding = self.embedding_model.encode(query)
        if hasattr(query_embedding, 'tolist'):
            query_embedding = query_embedding.tolist()
        else:
            query_embedding = list(query_embedding)

        # Build Qdrant filter
        qdrant_filter = None
        if filters:
            # Qdrant filters would be built here
            # For now, we'll filter results after retrieval
            pass

        # Search in Qdrant
        try:
            search_results = self.qdrant.search(
                collection_name="messages",
                query_vector=query_embedding,
                limit=limit * 2,  # Get more for filtering
                score_threshold=min_score
            )
        except Exception as e:
            print(f"⚠️  Semantic search failed: {e}")
            return []

        # Convert to SearchResult objects
        results = []
        for result in search_results:
            # Apply filters
            if filters.get("conversation_id"):
                if result.payload.get("conversation_id") != filters["conversation_id"]:
                    continue

            results.append(SearchResult(
                item_id=result.id,
                item_type="message",
                content=result.payload.get("content", ""),
                score=result.score,
                source="semantic",
                metadata={
                    "conversation_id": result.payload.get("conversation_id"),
                    "role": result.payload.get("role"),
                    "timestamp": result.payload.get("timestamp")
                }
            ))

        return results[:limit]

    async def _keyword_search(
        self,
        session: AsyncSession,
        query: str,
        filters: Dict[str, Any],
        limit: int
    ) -> List[SearchResult]:
        """
        Keyword search using SQLite LIKE queries.

        Note: For production, this should use FTS5 (Full-Text Search).
        """
        results = []

        # Search in messages
        message_query = sa.select(Message).where(
            Message.content.like(f"%{query}%")
        )

        # Apply filters
        if filters.get("conversation_id"):
            message_query = message_query.where(
                Message.conversation_id == filters["conversation_id"]
            )

        message_query = message_query.limit(limit)

        result = await session.execute(message_query)
        messages = result.scalars().all()

        for msg in messages:
            # Calculate simple relevance score based on query term frequency
            content_lower = msg.content.lower()
            query_lower = query.lower()
            score = content_lower.count(query_lower) / max(len(content_lower), 1)
            score = min(score * 10, 1.0)  # Normalize to 0-1

            results.append(SearchResult(
                item_id=str(msg.id),
                item_type="message",
                content=msg.content,
                score=score,
                source="keyword",
                metadata={
                    "conversation_id": msg.conversation_id,
                    "role": msg.role,
                    "timestamp": msg.timestamp.isoformat() if msg.timestamp else None,
                    "tokens": msg.tokens
                }
            ))

        # Search in entities
        entity_query = sa.select(Entity).where(
            sa.or_(
                Entity.name.like(f"%{query}%"),
                Entity.description.like(f"%{query}%")
            )
        )

        # Apply filters
        if filters.get("entity_type"):
            entity_query = entity_query.where(
                Entity.entity_type == filters["entity_type"]
            )

        entity_query = entity_query.limit(limit)

        result = await session.execute(entity_query)
        entities = result.scalars().all()

        for entity in entities:
            # Score based on name vs description match
            if query.lower() in entity.name.lower():
                score = 0.9
            else:
                score = 0.6

            results.append(SearchResult(
                item_id=entity.id,
                item_type="entity",
                content=f"{entity.name}: {entity.description or ''}",
                score=score,
                source="keyword",
                metadata={
                    "entity_type": entity.entity_type,
                    "confidence": entity.confidence,
                    "conversation_id": entity.conversation_id
                }
            ))

        return results

    async def _graph_search(
        self,
        session: AsyncSession,
        query: str,
        filters: Dict[str, Any],
        limit: int
    ) -> List[SearchResult]:
        """
        Graph-based search finding entities related to query terms.
        """
        results = []

        # First, find entities matching the query
        entity_query = sa.select(Entity).where(
            sa.or_(
                Entity.name.like(f"%{query}%"),
                Entity.description.like(f"%{query}%")
            )
        ).limit(5)  # Top 5 matching entities

        result = await session.execute(entity_query)
        seed_entities = result.scalars().all()

        # For each seed entity, find related entities in the graph
        for seed_entity in seed_entities:
            if seed_entity.id not in self.kg.graph:
                continue

            # Get related entities
            related = self.kg.find_related_entities(
                seed_entity.id,
                entity_type=filters.get("entity_type"),
                max_distance=2
            )

            for rel_entity in related[:limit]:
                # Score based on distance from seed
                score = 1.0 / (1.0 + rel_entity["distance"] * 0.3)

                results.append(SearchResult(
                    item_id=rel_entity["id"],
                    item_type="entity",
                    content=f"{rel_entity['name']} ({rel_entity['entity_type']})",
                    score=score,
                    source="graph",
                    metadata={
                        "entity_type": rel_entity["entity_type"],
                        "distance_from_query": rel_entity["distance"],
                        "seed_entity": seed_entity.name
                    }
                ))

        return results

    def _fuse_results(
        self,
        results: List[SearchResult],
        limit: int
    ) -> List[SearchResult]:
        """
        Fuse results from multiple search strategies using Reciprocal Rank Fusion.

        RRF gives higher scores to items that rank well across multiple methods.
        """
        # Group results by source
        by_source: Dict[str, List[SearchResult]] = {}
        for result in results:
            if result.source not in by_source:
                by_source[result.source] = []
            by_source[result.source].append(result)

        # Sort each source by score
        for source in by_source:
            by_source[source].sort(key=lambda x: x.score, reverse=True)

        # Calculate RRF scores
        k = 60  # RRF constant
        rrf_scores: Dict[str, float] = {}
        item_map: Dict[str, SearchResult] = {}

        for source, source_results in by_source.items():
            for rank, result in enumerate(source_results, start=1):
                key = f"{result.item_type}:{result.item_id}"
                rrf_scores[key] = rrf_scores.get(key, 0) + 1.0 / (k + rank)
                item_map[key] = result

        # Create fused results
        fused = []
        for key, rrf_score in sorted(rrf_scores.items(), key=lambda x: x[1], reverse=True):
            result = item_map[key]
            # Update score to RRF score
            result.score = rrf_score
            fused.append(result)

        return fused[:limit]

    async def search_by_entity(
        self,
        session: AsyncSession,
        entity_id: str,
        depth: int = 1,
        limit: int = 10
    ) -> Dict[str, Any]:
        """
        Search for content related to a specific entity.

        Args:
            session: Database session
            entity_id: Entity to search around
            depth: Graph depth to explore
            limit: Maximum results per category

        Returns:
            Dictionary with messages, entities, and relationships
        """
        if entity_id not in self.kg.graph:
            return {"error": "Entity not found in knowledge graph"}

        # Get entity context
        context = self.kg.get_entity_context(entity_id, depth)

        # Get messages mentioning this entity
        entity = await session.get(Entity, entity_id)
        if entity and entity.conversation_id:
            message_query = sa.select(Message).where(
                Message.conversation_id == entity.conversation_id
            ).limit(limit)

            result = await session.execute(message_query)
            messages = result.scalars().all()

            context["related_messages"] = [
                {
                    "id": msg.id,
                    "role": msg.role,
                    "content": msg.content,
                    "timestamp": msg.timestamp.isoformat() if msg.timestamp else None
                }
                for msg in messages
            ]

        return context

    async def search_by_time_range(
        self,
        session: AsyncSession,
        start_time: datetime,
        end_time: datetime,
        entity_types: Optional[List[str]] = None,
        limit: int = 50
    ) -> Dict[str, Any]:
        """
        Search for entities and messages within a time range.

        Args:
            session: Database session
            start_time: Start of time range
            end_time: End of time range
            entity_types: Optional filter by entity types
            limit: Maximum results

        Returns:
            Dictionary with entities and messages from time range
        """
        # Query entities in time range
        entity_query = sa.select(Entity).where(
            Entity.event_time >= start_time,
            Entity.event_time <= end_time
        )

        if entity_types:
            entity_query = entity_query.where(
                Entity.entity_type.in_(entity_types)
            )

        entity_query = entity_query.limit(limit)

        result = await session.execute(entity_query)
        entities = result.scalars().all()

        # Query messages in time range
        message_query = sa.select(Message).where(
            Message.timestamp >= start_time,
            Message.timestamp <= end_time
        ).limit(limit)

        result = await session.execute(message_query)
        messages = result.scalars().all()

        return {
            "time_range": {
                "start": start_time.isoformat(),
                "end": end_time.isoformat()
            },
            "entities": [
                {
                    "id": e.id,
                    "name": e.name,
                    "entity_type": e.entity_type,
                    "event_time": e.event_time.isoformat(),
                    "confidence": e.confidence
                }
                for e in entities
            ],
            "messages": [
                {
                    "id": m.id,
                    "conversation_id": m.conversation_id,
                    "role": m.role,
                    "content": m.content[:200] + "..." if len(m.content) > 200 else m.content,
                    "timestamp": m.timestamp.isoformat() if m.timestamp else None
                }
                for m in messages
            ]
        }
