#!/usr/bin/env python3
"""
Comprehensive unit tests for HybridSearch component.
Target: >80% code coverage for hybrid_search.py
"""

import pytest
from unittest.mock import Mock, AsyncMock, patch, MagicMock
from datetime import datetime
from dataclasses import dataclass

from context_persistence.hybrid_search import HybridSearch, SearchResult
from context_persistence.models_enhanced import Entity, Relationship, Message


class TestSearchResult:
    """Test SearchResult dataclass"""

    def test_search_result_creation(self):
        """Test SearchResult creation and attributes"""
        result = SearchResult(
            item_id="test_id",
            item_type="message",
            content="Test content",
            score=0.9,
            source="semantic",
            metadata={"key": "value"}
        )
        
        assert result.item_id == "test_id"
        assert result.item_type == "message"
        assert result.content == "Test content"
        assert result.score == 0.9
        assert result.source == "semantic"
        assert result.metadata == {"key": "value"}

    def test_search_result_equality(self):
        """Test SearchResult equality comparison"""
        result1 = SearchResult("id1", "message", "content", 0.9, "semantic", {})
        result2 = SearchResult("id1", "message", "content", 0.9, "semantic", {})
        result3 = SearchResult("id2", "message", "content", 0.9, "semantic", {})
        
        # SearchResult should be comparable by attributes
        assert result1.item_id == result2.item_id
        assert result1.item_id != result3.item_id


class TestHybridSearch:
    """Test suite for HybridSearch class"""

    @pytest.fixture
    def mock_qdrant_client(self):
        """Create mock Qdrant client"""
        client = Mock()
        return client

    @pytest.fixture
    def mock_embedding_model(self):
        """Create mock embedding model"""
        model = Mock()
        model.encode.return_value = [0.1, 0.2, 0.3]
        return model

    @pytest.fixture
    def mock_knowledge_graph(self):
        """Create mock knowledge graph"""
        kg = Mock()
        kg.graph = Mock()
        return kg

    @pytest.fixture
    def hybrid_search(self, mock_qdrant_client, mock_embedding_model, mock_knowledge_graph):
        """Create HybridSearch instance for testing"""
        return HybridSearch(
            qdrant_client=mock_qdrant_client,
            embedding_model=mock_embedding_model,
            knowledge_graph=mock_knowledge_graph
        )

    @pytest.fixture
    def mock_session(self):
        """Create mock database session"""
        session = AsyncMock()
        return session

    @pytest.fixture
    def sample_messages(self):
        """Create sample message objects for testing"""
        return [
            Message(
                id=1,
                conversation_id="conv1",
                content="This is a test message about API design",
                role="user",
                timestamp=datetime(2023, 1, 1),
                tokens=10
            ),
            Message(
                id=2,
                conversation_id="conv1",
                content="Another message about database architecture",
                role="assistant",
                timestamp=datetime(2023, 1, 2),
                tokens=12
            )
        ]

    @pytest.fixture
    def sample_entities(self):
        """Create sample entity objects for testing"""
        return [
            Entity(
                id="entity1",
                name="API",
                entity_type="concept",
                description="Application Programming Interface",
                confidence=0.9,
                conversation_id="conv1",
                event_time=datetime(2023, 1, 1),
                ingestion_time=datetime(2023, 1, 1),
                valid_from=datetime(2023, 1, 1),
                valid_until=None
            ),
            Entity(
                id="entity2",
                name="Database",
                entity_type="concept",
                description="Data storage system",
                confidence=0.8,
                conversation_id="conv1",
                event_time=datetime(2023, 1, 2),
                ingestion_time=datetime(2023, 1, 2),
                valid_from=datetime(2023, 1, 2),
                valid_until=None
            )
        ]

    class TestInitialization:
        """Test HybridSearch initialization"""

        def test_init(self, mock_qdrant_client, mock_embedding_model, mock_knowledge_graph):
            """Test HybridSearch initialization"""
            search = HybridSearch(
                qdrant_client=mock_qdrant_client,
                embedding_model=mock_embedding_model,
                knowledge_graph=mock_knowledge_graph
            )
            
            assert search.qdrant == mock_qdrant_client
            assert search.embedding_model == mock_embedding_model
            assert search.kg == mock_knowledge_graph

    class TestMainSearch:
        """Test main search functionality"""

        @pytest.mark.asyncio
        async def test_search_hybrid_mode(self, hybrid_search, mock_session):
            """Test hybrid search mode"""
            # Mock individual search methods
            hybrid_search._semantic_search = AsyncMock(return_value=[
                SearchResult("msg1", "message", "API content", 0.9, "semantic", {})
            ])
            hybrid_search._keyword_search = AsyncMock(return_value=[
                SearchResult("msg2", "message", "API message", 0.7, "keyword", {})
            ])
            hybrid_search._graph_search = AsyncMock(return_value=[
                SearchResult("entity1", "entity", "API entity", 0.6, "graph", {})
            ])
            hybrid_search._fuse_results = Mock(return_value=[
                SearchResult("msg1", "message", "API content", 0.9, "semantic", {}),
                SearchResult("msg2", "message", "API message", 0.7, "keyword", {})
            ])
            
            results = await hybrid_search.search(
                session=mock_session,
                query="API",
                mode="hybrid",
                limit=10,
                min_score=0.5
            )
            
            assert len(results) == 2
            assert all(r["score"] >= 0.5 for r in results)
            hybrid_search._semantic_search.assert_called_once()
            hybrid_search._keyword_search.assert_called_once()
            hybrid_search._graph_search.assert_called_once()
            hybrid_search._fuse_results.assert_called_once()

        @pytest.mark.asyncio
        async def test_search_semantic_mode_only(self, hybrid_search, mock_session):
            """Test semantic-only search mode"""
            hybrid_search._semantic_search = AsyncMock(return_value=[
                SearchResult("msg1", "message", "API content", 0.9, "semantic", {})
            ])
            hybrid_search._keyword_search = AsyncMock()
            hybrid_search._graph_search = AsyncMock()
            
            results = await hybrid_search.search(
                session=mock_session,
                query="API",
                mode="semantic",
                limit=10
            )
            
            assert len(results) == 1
            hybrid_search._semantic_search.assert_called_once()
            hybrid_search._keyword_search.assert_not_called()
            hybrid_search._graph_search.assert_not_called()

        @pytest.mark.asyncio
        async def test_search_keyword_mode_only(self, hybrid_search, mock_session):
            """Test keyword-only search mode"""
            hybrid_search._semantic_search = AsyncMock()
            hybrid_search._keyword_search = AsyncMock(return_value=[
                SearchResult("msg1", "message", "API message", 0.8, "keyword", {})
            ])
            hybrid_search._graph_search = AsyncMock()
            
            results = await hybrid_search.search(
                session=mock_session,
                query="API",
                mode="keyword",
                limit=10
            )
            
            assert len(results) == 1
            hybrid_search._semantic_search.assert_not_called()
            hybrid_search._keyword_search.assert_called_once()
            hybrid_search._graph_search.assert_not_called()

        @pytest.mark.asyncio
        async def test_search_graph_mode_only(self, hybrid_search, mock_session):
            """Test graph-only search mode"""
            hybrid_search._semantic_search = AsyncMock()
            hybrid_search._keyword_search = AsyncMock()
            hybrid_search._graph_search = AsyncMock(return_value=[
                SearchResult("entity1", "entity", "API entity", 0.7, "graph", {})
            ])
            
            results = await hybrid_search.search(
                session=mock_session,
                query="API",
                mode="graph",
                limit=10
            )
            
            assert len(results) == 1
            hybrid_search._semantic_search.assert_not_called()
            hybrid_search._keyword_search.assert_not_called()
            hybrid_search._graph_search.assert_called_once()

        @pytest.mark.asyncio
        async def test_search_with_filters(self, hybrid_search, mock_session):
            """Test search with filters"""
            filters = {"conversation_id": "conv1", "entity_type": "concept"}
            
            hybrid_search._semantic_search = AsyncMock(return_value=[])
            hybrid_search._keyword_search = AsyncMock(return_value=[])
            hybrid_search._graph_search = AsyncMock(return_value=[])
            
            await hybrid_search.search(
                session=mock_session,
                query="test",
                filters=filters
            )
            
            # Check that filters were passed to search methods
            hybrid_search._semantic_search.assert_called_once_with("test", filters, 10, 0.5)
            hybrid_search._keyword_search.assert_called_once_with(mock_session, "test", filters, 10)
            hybrid_search._graph_search.assert_called_once_with(mock_session, "test", filters, 10)

        @pytest.mark.asyncio
        async def test_search_min_score_filtering(self, hybrid_search, mock_session):
            """Test that results below min_score are filtered out"""
            hybrid_search._semantic_search = AsyncMock(return_value=[
                SearchResult("msg1", "message", "content1", 0.9, "semantic", {}),
                SearchResult("msg2", "message", "content2", 0.3, "semantic", {}),
                SearchResult("msg3", "message", "content3", 0.7, "semantic", {})
            ])
            hybrid_search._keyword_search = AsyncMock(return_value=[])
            hybrid_search._graph_search = AsyncMock(return_value=[])
            
            results = await hybrid_search.search(
                session=mock_session,
                query="test",
                mode="semantic",
                min_score=0.5
            )
            
            assert len(results) == 2  # Only items with score >= 0.5
            assert all(r["score"] >= 0.5 for r in results)

        @pytest.mark.asyncio
        async def test_search_result_conversion(self, hybrid_search, mock_session):
            """Test that SearchResult objects are converted to dictionaries"""
            hybrid_search._semantic_search = AsyncMock(return_value=[
                SearchResult("msg1", "message", "API content", 0.9, "semantic", {"conv": "conv1"})
            ])
            hybrid_search._keyword_search = AsyncMock(return_value=[])
            hybrid_search._graph_search = AsyncMock(return_value=[])
            
            results = await hybrid_search.search(
                session=mock_session,
                query="API",
                mode="semantic"
            )
            
            assert isinstance(results, list)
            assert isinstance(results[0], dict)
            assert results[0]["item_id"] == "msg1"
            assert results[0]["item_type"] == "message"
            assert results[0]["content"] == "API content"
            assert results[0]["score"] == 0.9
            assert results[0]["source"] == "semantic"
            assert results[0]["metadata"] == {"conv": "conv1"}

    class TestSemanticSearch:
        """Test semantic search functionality"""

        @pytest.mark.asyncio
        async def test_semantic_search_success(self, hybrid_search):
            """Test successful semantic search"""
            # Mock Qdrant search response
            mock_result = Mock()
            mock_result.id = "point1"
            mock_result.score = 0.9
            mock_result.payload = {
                "content": "API design discussion",
                "conversation_id": "conv1",
                "role": "user",
                "timestamp": "2023-01-01T12:00:00"
            }
            
            hybrid_search.qdrant.search.return_value = [mock_result]
            
            results = await hybrid_search._semantic_search(
                query="API design",
                filters={},
                limit=10,
                min_score=0.5
            )
            
            assert len(results) == 1
            assert results[0].item_id == "point1"
            assert results[0].score == 0.9
            assert results[0].source == "semantic"
            assert results[0].content == "API design discussion"
            
            # Check that embedding model was called
            hybrid_search.embedding_model.encode.assert_called_once_with("API design")
            hybrid_search.qdrant.search.assert_called_once()

        @pytest.mark.asyncio
        async def test_semantic_search_with_filters(self, hybrid_search):
            """Test semantic search with conversation filter"""
            mock_result = Mock()
            mock_result.id = "point1"
            mock_result.score = 0.9
            mock_result.payload = {
                "content": "API design",
                "conversation_id": "conv1"
            }
            
            hybrid_search.qdrant.search.return_value = [mock_result]
            
            filters = {"conversation_id": "conv1"}
            results = await hybrid_search._semantic_search(
                query="API",
                filters=filters,
                limit=10,
                min_score=0.5
            )
            
            assert len(results) == 1
            
            # Test filter rejection
            filters_wrong = {"conversation_id": "conv2"}
            results_filtered = await hybrid_search._semantic_search(
                query="API",
                filters=filters_wrong,
                limit=10,
                min_score=0.5
            )
            
            assert len(results_filtered) == 0

        @pytest.mark.asyncio
        async def test_semantic_search_embedding_conversion(self, hybrid_search):
            """Test embedding conversion for different return types"""
            # Test with numpy array
            import numpy as np
            hybrid_search.embedding_model.encode.return_value = np.array([0.1, 0.2, 0.3])
            hybrid_search.qdrant.search.return_value = []
            
            await hybrid_search._semantic_search("test", {}, 10, 0.5)
            
            # Should convert numpy array to list
            call_args = hybrid_search.qdrant.search.call_args[1]
            query_vector = call_args["query_vector"]
            assert isinstance(query_vector, list)
            assert query_vector == [0.1, 0.2, 0.3]

        @pytest.mark.asyncio
        async def test_semantic_search_error_handling(self, hybrid_search):
            """Test semantic search error handling"""
            hybrid_search.qdrant.search.side_effect = Exception("Qdrant error")
            
            results = await hybrid_search._semantic_search(
                query="test",
                filters={},
                limit=10,
                min_score=0.5
            )
            
            assert results == []

        @pytest.mark.asyncio
        async def test_semantic_search_with_limit(self, hybrid_search):
            """Test semantic search respects limit"""
            # Mock more results than limit
            mock_results = []
            for i in range(20):  # 20 results, but limit is 10
                mock_result = Mock()
                mock_result.id = f"point{i}"
                mock_result.score = 0.9 - (i * 0.01)
                mock_result.payload = {"content": f"content{i}", "conversation_id": "conv1"}
                mock_results.append(mock_result)
            
            hybrid_search.qdrant.search.return_value = mock_results
            
            results = await hybrid_search._semantic_search(
                query="test",
                filters={},
                limit=10,
                min_score=0.5
            )
            
            assert len(results) == 10

    class TestKeywordSearch:
        """Test keyword search functionality"""

        @pytest.mark.asyncio
        async def test_keyword_search_messages(self, hybrid_search, mock_session, sample_messages):
            """Test keyword search in messages"""
            # Mock database query
            mock_result = AsyncMock()
            mock_result.scalars.return_value.all.return_value = sample_messages
            mock_session.execute.return_value = mock_result
            
            results = await hybrid_search._keyword_search(
                session=mock_session,
                query="API",
                filters={},
                limit=10
            )
            
            assert len(results) == 2
            assert all(r.item_type == "message" for r in results)
            assert all(r.source == "keyword" for r in results)
            
            # Check score calculation based on term frequency
            api_results = [r for r in results if "API" in r.content]
            assert len(api_results) == 1
            assert api_results[0].score > 0

        @pytest.mark.asyncio
        async def test_keyword_search_entities(self, hybrid_search, mock_session, sample_entities):
            """Test keyword search in entities"""
            # Mock entity query
            mock_result = AsyncMock()
            mock_result.scalars.return_value.all.return_value = sample_entities
            mock_session.execute.return_value = mock_result
            
            results = await hybrid_search._keyword_search(
                session=mock_session,
                query="API",
                filters={},
                limit=10
            )
            
            entity_results = [r for r in results if r.item_type == "entity"]
            assert len(entity_results) == 1  # Only "API" entity should match
            assert entity_results[0].score == 0.9  # Name match gets higher score

        @pytest.mark.asyncio
        async def test_keyword_search_with_conversation_filter(self, hybrid_search, mock_session, sample_messages):
            """Test keyword search with conversation filter"""
            mock_result = AsyncMock()
            mock_result.scalars.return_value.all.return_value = sample_messages
            mock_session.execute.return_value = mock_result
            
            filters = {"conversation_id": "conv1"}
            results = await hybrid_search._keyword_search(
                session=mock_session,
                query="test",
                filters=filters,
                limit=10
            )
            
            # Should apply filter to message query
            message_results = [r for r in results if r.item_type == "message"]
            assert len(message_results) == 2

        @pytest.mark.asyncio
        async def test_keyword_search_with_entity_type_filter(self, hybrid_search, mock_session, sample_entities):
            """Test keyword search with entity type filter"""
            mock_result = AsyncMock()
            mock_result.scalars.return_value.all.return_value = sample_entities
            mock_session.execute.return_value = mock_result
            
            filters = {"entity_type": "concept"}
            results = await hybrid_search._keyword_search(
                session=mock_session,
                query="test",
                filters=filters,
                limit=10
            )
            
            entity_results = [r for r in results if r.item_type == "entity"]
            assert len(entity_results) == 2  # Both entities are "concept" type

        @pytest.mark.asyncio
        async def test_keyword_search_score_calculation(self, hybrid_search, mock_session):
            """Test keyword search score calculation"""
            # Create message with multiple query occurrences
            message = Message(
                id=1,
                conversation_id="conv1",
                content="API API API design",
                role="user",
                timestamp=datetime(2023, 1, 1),
                tokens=10
            )
            
            mock_result = AsyncMock()
            mock_result.scalars.return_value.all.return_value = [message]
            mock_session.execute.return_value = mock_result
            
            results = await hybrid_search._keyword_search(
                session=mock_session,
                query="API",
                filters={},
                limit=10
            )
            
            # Score should be based on term frequency
            assert len(results) == 1
            assert results[0].score > 0  # Should have positive score
            assert results[0].score <= 1.0  # Should be normalized

    class TestGraphSearch:
        """Test graph search functionality"""

        @pytest.mark.asyncio
        async def test_graph_search_basic(self, hybrid_search, mock_session, sample_entities):
            """Test basic graph search"""
            # Mock entity query for seed entities
            mock_entity_result = AsyncMock()
            mock_entity_result.scalars.return_value.all.return_value = sample_entities[:1]  # Only API entity
            mock_session.execute.return_value = mock_entity_result
            
            # Mock knowledge graph related entities
            related_entities = [
                {"id": "rel1", "name": "Related 1", "entity_type": "project", "distance": 1, "confidence": 0.8},
                {"id": "rel2", "name": "Related 2", "entity_type": "tool", "distance": 2, "confidence": 0.7}
            ]
            hybrid_search.kg.find_related_entities.return_value = related_entities
            
            # Mock graph nodes check
            hybrid_search.kg.graph.__contains__ = Mock(return_value=True)
            
            results = await hybrid_search._graph_search(
                session=mock_session,
                query="API",
                filters={},
                limit=10
            )
            
            assert len(results) == 2
            assert all(r.item_type == "entity" for r in results)
            assert all(r.source == "graph" for r in results)
            
            # Check score calculation based on distance
            rel1_result = next(r for r in results if r.item_id == "rel1")
            rel2_result = next(r for r in results if r.item_id == "rel2")
            
            assert rel1_result.score > rel2_result.score  # Closer distance = higher score

        @pytest.mark.asyncio
        async def test_graph_search_with_entity_type_filter(self, hybrid_search, mock_session, sample_entities):
            """Test graph search with entity type filter"""
            mock_entity_result = AsyncMock()
            mock_entity_result.scalars.return_value.all.return_value = sample_entities[:1]
            mock_session.execute.return_value = mock_entity_result
            
            related_entities = [
                {"id": "rel1", "name": "Related 1", "entity_type": "project", "distance": 1, "confidence": 0.8},
                {"id": "rel2", "name": "Related 2", "entity_type": "tool", "distance": 2, "confidence": 0.7}
            ]
            hybrid_search.kg.find_related_entities.return_value = related_entities
            hybrid_search.kg.graph.__contains__ = Mock(return_value=True)
            
            filters = {"entity_type": "project"}
            results = await hybrid_search._graph_search(
                session=mock_session,
                query="API",
                filters=filters,
                limit=10
            )
            
            # Should only return project entities
            assert len(results) == 1
            assert results[0].item_id == "rel1"
            assert results[0].metadata["entity_type"] == "project"

        @pytest.mark.asyncio
        async def test_graph_search_no_seed_entities(self, hybrid_search, mock_session):
            """Test graph search when no seed entities found"""
            mock_entity_result = AsyncMock()
            mock_entity_result.scalars.return_value.all.return_value = []
            mock_session.execute.return_value = mock_entity_result
            
            results = await hybrid_search._graph_search(
                session=mock_session,
                query="nonexistent",
                filters={},
                limit=10
            )
            
            assert results == []

        @pytest.mark.asyncio
        async def test_graph_search_entity_not_in_graph(self, hybrid_search, mock_session, sample_entities):
            """Test graph search when entity not in knowledge graph"""
            mock_entity_result = AsyncMock()
            mock_entity_result.scalars.return_value.all.return_value = sample_entities[:1]
            mock_session.execute.return_value = mock_entity_result
            
            # Entity not in graph
            hybrid_search.kg.graph.__contains__ = Mock(return_value=False)
            
            results = await hybrid_search._graph_search(
                session=mock_session,
                query="API",
                filters={},
                limit=10
            )
            
            assert results == []

        @pytest.mark.asyncio
        async def test_graph_search_limit_results(self, hybrid_search, mock_session, sample_entities):
            """Test graph search result limiting"""
            mock_entity_result = AsyncMock()
            mock_entity_result.scalars.return_value.all.return_value = sample_entities[:1]
            mock_session.execute.return_value = mock_entity_result
            
            # Create many related entities
            related_entities = [
                {"id": f"rel{i}", "name": f"Related {i}", "entity_type": "project", 
                 "distance": 1, "confidence": 0.8} for i in range(20)
            ]
            hybrid_search.kg.find_related_entities.return_value = related_entities
            hybrid_search.kg.graph.__contains__ = Mock(return_value=True)
            
            results = await hybrid_search._graph_search(
                session=mock_session,
                query="API",
                filters={},
                limit=5
            )
            
            assert len(results) == 5  # Should be limited

    class TestResultFusion:
        """Test result fusion algorithms"""

        def test_fuse_results_basic(self, hybrid_search):
            """Test basic result fusion"""
            results = [
                SearchResult("item1", "message", "content1", 0.9, "semantic", {}),
                SearchResult("item2", "message", "content2", 0.8, "keyword", {}),
                SearchResult("item3", "entity", "content3", 0.7, "graph", {}),
                SearchResult("item1", "message", "content1", 0.6, "keyword", {})  # Duplicate
            ]
            
            fused = hybrid_search._fuse_results(results, limit=10)
            
            # Should deduplicate and rank
            item_ids = [r.item_id for r in fused]
            assert len(set(item_ids)) == len(item_ids)  # No duplicates
            assert "item1" in item_ids
            assert "item2" in item_ids
            assert "item3" in item_ids
            
            # item1 should have higher RRF score (appears in multiple sources)
            item1_result = next(r for r in fused if r.item_id == "item1")
            item2_result = next(r for r in fused if r.item_id == "item2")
            
            assert item1_result.score > item2_result.score

        def test_fuse_results_rrf_scoring(self, hybrid_search):
            """Test Reciprocal Rank Fusion scoring"""
            results = [
                # Source 1 results (ranked by score)
                SearchResult("item1", "message", "content1", 0.9, "semantic", {}),
                SearchResult("item2", "message", "content2", 0.7, "semantic", {}),
                SearchResult("item3", "message", "content3", 0.5, "semantic", {}),
                
                # Source 2 results (different ranking)
                SearchResult("item2", "message", "content2", 0.8, "keyword", {}),
                SearchResult("item1", "message", "content1", 0.6, "keyword", {}),
                SearchResult("item4", "message", "content4", 0.4, "keyword", {}),
            ]
            
            fused = hybrid_search._fuse_results(results, limit=10)
            
            # item1 appears in both sources (ranks 1 and 2)
            # item2 appears in both sources (ranks 2 and 1)
            # item3 and item4 appear in single sources
            
            item_ids = [r.item_id for r in fused]
            item1_result = next((r for r in fused if r.item_id == "item1"), None)
            item2_result = next((r for r in fused if r.item_id == "item2"), None)
            
            # Both should have high scores due to multiple source appearances
            assert item1_result.score > 0
            assert item2_result.score > 0

        def test_fuse_results_with_limit(self, hybrid_search):
            """Test result fusion with limit"""
            results = []
            for i in range(20):
                results.append(SearchResult(f"item{i}", "message", f"content{i}", 0.9 - i*0.01, "semantic", {}))
            
            fused = hybrid_search._fuse_results(results, limit=5)
            
            assert len(fused) == 5
            assert fused[0].score >= fused[4].score  # Should be sorted by score

        def test_fuse_results_empty(self, hybrid_search):
            """Test fusion with empty results"""
            fused = hybrid_search._fuse_results([], limit=10)
            
            assert fused == []

        def test_fuse_results_single_source(self, hybrid_search):
            """Test fusion with results from single source"""
            results = [
                SearchResult("item1", "message", "content1", 0.9, "semantic", {}),
                SearchResult("item2", "message", "content2", 0.7, "semantic", {}),
                SearchResult("item3", "message", "content3", 0.5, "semantic", {}),
            ]
            
            fused = hybrid_search._fuse_results(results, limit=10)
            
            assert len(fused) == 3
            # Should maintain original order since only one source
            assert fused[0].item_id == "item1"
            assert fused[1].item_id == "item2"
            assert fused[2].item_id == "item3"

    class TestSearchByEntity:
        """Test entity-based search functionality"""

        @pytest.mark.asyncio
        async def test_search_by_entity_basic(self, hybrid_search, mock_session):
            """Test basic search by entity"""
            # Mock entity in database
            mock_entity = Entity(
                id="entity1",
                name="API",
                entity_type="concept",
                conversation_id="conv1"
            )
            mock_session.get.return_value = mock_entity
            
            # Mock entity context from knowledge graph
            mock_context = {
                "entity": {"id": "entity1", "name": "API", "entity_type": "concept"},
                "neighbors": {"depth_1": [{"id": "rel1", "name": "Related"}]},
                "outgoing_relationships": [],
                "incoming_relationships": []
            }
            hybrid_search.kg.get_entity_context.return_value = mock_context
            
            # Mock related messages
            mock_message = Message(
                id=1,
                conversation_id="conv1",
                content="API discussion",
                role="user",
                timestamp=datetime(2023, 1, 1)
            )
            mock_result = AsyncMock()
            mock_result.scalars.return_value.all.return_value = [mock_message]
            mock_session.execute.return_value = mock_result
            
            result = await hybrid_search.search_by_entity(
                session=mock_session,
                entity_id="entity1",
                depth=1,
                limit=10
            )
            
            assert "entity" in result
            assert "neighbors" in result
            assert "related_messages" in result
            assert len(result["related_messages"]) == 1
            assert result["related_messages"][0]["content"] == "API discussion"

        @pytest.mark.asyncio
        async def test_search_by_entity_not_in_graph(self, hybrid_search, mock_session):
            """Test search by entity when entity not in knowledge graph"""
            hybrid_search.kg.graph.__contains__ = Mock(return_value=False)
            
            result = await hybrid_search.search_by_entity(
                session=mock_session,
                entity_id="nonexistent",
                depth=1,
                limit=10
            )
            
            assert "error" in result
            assert "Entity not found" in result["error"]

        @pytest.mark.asyncio
        async def test_search_by_entity_no_conversation(self, hybrid_search, mock_session):
            """Test search by entity when entity has no conversation"""
            mock_entity = Entity(
                id="entity1",
                name="API",
                entity_type="concept",
                conversation_id=None  # No conversation
            )
            mock_session.get.return_value = mock_entity
            
            mock_context = {
                "entity": {"id": "entity1", "name": "API"},
                "neighbors": {},
                "outgoing_relationships": [],
                "incoming_relationships": []
            }
            hybrid_search.kg.get_entity_context.return_value = mock_context
            
            result = await hybrid_search.search_by_entity(
                session=mock_session,
                entity_id="entity1",
                depth=1,
                limit=10
            )
            
            assert "related_messages" not in result or len(result.get("related_messages", [])) == 0

    class TestSearchByTimeRange:
        """Test time range search functionality"""

        @pytest.mark.asyncio
        async def test_search_by_time_range_basic(self, hybrid_search, mock_session, sample_entities, sample_messages):
            """Test basic time range search"""
            start_time = datetime(2023, 1, 1)
            end_time = datetime(2023, 1, 31)
            
            # Mock entity query
            mock_entity_result = AsyncMock()
            mock_entity_result.scalars.return_value.all.return_value = sample_entities
            mock_session.execute.return_value = mock_entity_result
            
            # Mock message query
            mock_message_result = AsyncMock()
            mock_message_result.scalars.return_value.all.return_value = sample_messages
            mock_session.execute.return_value = mock_message_result
            
            result = await hybrid_search.search_by_time_range(
                session=mock_session,
                start_time=start_time,
                end_time=end_time,
                entity_types=None,
                limit=50
            )
            
            assert "time_range" in result
            assert "entities" in result
            assert "messages" in result
            assert len(result["entities"]) == 2
            assert len(result["messages"]) == 2

        @pytest.mark.asyncio
        async def test_search_by_time_range_with_entity_types(self, hybrid_search, mock_session, sample_entities):
            """Test time range search with entity type filter"""
            start_time = datetime(2023, 1, 1)
            end_time = datetime(2023, 1, 31)
            
            # Mock entity query with type filter
            mock_entity_result = AsyncMock()
            mock_entity_result.scalars.return_value.all.return_value = sample_entities[:1]  # Only first entity
            mock_session.execute.return_value = mock_entity_result
            
            mock_message_result = AsyncMock()
            mock_message_result.scalars.return_value.all.return_value = []
            mock_session.execute.return_value = mock_message_result
            
            result = await hybrid_search.search_by_time_range(
                session=mock_session,
                start_time=start_time,
                end_time=end_time,
                entity_types=["concept"],
                limit=50
            )
            
            assert len(result["entities"]) == 1
            assert result["entities"][0]["entity_type"] == "concept"

        @pytest.mark.asyncio
        async def test_search_by_time_range_content_truncation(self, hybrid_search, mock_session):
            """Test that message content is truncated in time range search"""
            # Create long message
            long_content = "This is a very long message that should be truncated " * 10
            long_message = Message(
                id=1,
                conversation_id="conv1",
                content=long_content,
                role="user",
                timestamp=datetime(2023, 1, 15)
            )
            
            mock_entity_result = AsyncMock()
            mock_entity_result.scalars.return_value.all.return_value = []
            mock_session.execute.return_value = mock_entity_result
            
            mock_message_result = AsyncMock()
            mock_message_result.scalars.return_value.all.return_value = [long_message]
            mock_session.execute.return_value = mock_message_result
            
            result = await hybrid_search.search_by_time_range(
                session=mock_session,
                start_time=datetime(2023, 1, 1),
                end_time=datetime(2023, 1, 31),
                limit=50
            )
            
            message_content = result["messages"][0]["content"]
            assert len(message_content) <= 203  # 200 + "..."
            assert message_content.endswith("...")

    class TestEdgeCases:
        """Test edge cases and error conditions"""

        @pytest.mark.asyncio
        async def test_search_empty_query(self, hybrid_search, mock_session):
            """Test search with empty query"""
            hybrid_search._semantic_search = AsyncMock(return_value=[])
            hybrid_search._keyword_search = AsyncMock(return_value=[])
            hybrid_search._graph_search = AsyncMock(return_value=[])
            
            results = await hybrid_search.search(
                session=mock_session,
                query="",
                mode="hybrid"
            )
            
            assert results == []

        @pytest.mark.asyncio
        async def test_search_invalid_mode(self, hybrid_search, mock_session):
            """Test search with invalid mode"""
            hybrid_search._semantic_search = AsyncMock(return_value=[])
            hybrid_search._keyword_search = AsyncMock(return_value=[])
            hybrid_search._graph_search = AsyncMock(return_value=[])
            
            # Should default to no searches for invalid mode
            results = await hybrid_search.search(
                session=mock_session,
                query="test",
                mode="invalid_mode"
            )
            
            assert results == []

        @pytest.mark.asyncio
        async def test_search_zero_limit(self, hybrid_search, mock_session):
            """Test search with zero limit"""
            hybrid_search._semantic_search = AsyncMock(return_value=[])
            hybrid_search._keyword_search = AsyncMock(return_value=[])
            hybrid_search._graph_search = AsyncMock(return_value=[])
            
            results = await hybrid_search.search(
                session=mock_session,
                query="test",
                limit=0
            )
            
            assert results == []

        @pytest.mark.asyncio
        async def test_search_negative_min_score(self, hybrid_search, mock_session):
            """Test search with negative min_score"""
            hybrid_search._semantic_search = AsyncMock(return_value=[
                SearchResult("item1", "message", "content", -0.1, "semantic", {})
            ])
            hybrid_search._keyword_search = AsyncMock(return_value=[])
            hybrid_search._graph_search = AsyncMock(return_value=[])
            
            results = await hybrid_search.search(
                session=mock_session,
                query="test",
                min_score=-1.0
            )
            
            # Should still return results with negative scores if min_score allows
            assert len(results) == 1
            assert results[0]["score"] == -0.1

    class TestPerformance:
        """Test performance-related scenarios"""

        @pytest.mark.asyncio
        @pytest.mark.slow
        async def test_large_search_performance(self, hybrid_search, mock_session):
            """Test search performance with large result sets"""
            import time
            
            # Mock large result sets
            large_semantic_results = [
                SearchResult(f"item{i}", "message", f"content{i}", 0.9 - i*0.001, "semantic", {})
                for i in range(100)
            ]
            large_keyword_results = [
                SearchResult(f"kw_item{i}", "message", f"kw_content{i}", 0.8 - i*0.001, "keyword", {})
                for i in range(80)
            ]
            large_graph_results = [
                SearchResult(f"graph_item{i}", "entity", f"graph_content{i}", 0.7 - i*0.001, "graph", {})
                for i in range(60)
            ]
            
            hybrid_search._semantic_search = AsyncMock(return_value=large_semantic_results)
            hybrid_search._keyword_search = AsyncMock(return_value=large_keyword_results)
            hybrid_search._graph_search = AsyncMock(return_value=large_graph_results)
            
            start_time = time.time()
            
            results = await hybrid_search.search(
                session=mock_session,
                query="test",
                mode="hybrid",
                limit=50
            )
            
            end_time = time.time()
            processing_time = end_time - start_time
            
            # Should complete within reasonable time
            assert processing_time < 5.0  # 5 seconds
            assert len(results) <= 50  # Should respect limit

    class TestIntegration:
        """Integration tests combining multiple features"""

        @pytest.mark.asyncio
        async def test_comprehensive_search_scenario(self, hybrid_search, mock_session):
            """Test comprehensive search scenario with all components"""
            # Setup semantic search results
            semantic_results = [
                SearchResult("msg1", "message", "API design discussion", 0.95, "semantic", 
                          {"conversation_id": "conv1", "role": "user"}),
                SearchResult("msg2", "message", "Database architecture", 0.85, "semantic",
                          {"conversation_id": "conv1", "role": "assistant"})
            ]
            
            # Setup keyword search results
            keyword_results = [
                SearchResult("msg3", "message", "API implementation details", 0.8, "keyword",
                          {"conversation_id": "conv1", "role": "user"}),
                SearchResult("entity1", "entity", "API: Application Programming Interface", 0.9, "keyword",
                          {"entity_type": "concept", "confidence": 0.9})
            ]
            
            # Setup graph search results
            graph_results = [
                SearchResult("entity2", "entity", "Server (tool)", 0.7, "graph",
                          {"entity_type": "tool", "distance_from_query": 1}),
                SearchResult("entity3", "entity", "Microservices (concept)", 0.6, "graph",
                          {"entity_type": "concept", "distance_from_query": 2})
            ]
            
            hybrid_search._semantic_search = AsyncMock(return_value=semantic_results)
            hybrid_search._keyword_search = AsyncMock(return_value=keyword_results)
            hybrid_search._graph_search = AsyncMock(return_value=graph_results)
            
            # Execute comprehensive search
            results = await hybrid_search.search(
                session=mock_session,
                query="API design database",
                mode="hybrid",
                filters={"conversation_id": "conv1"},
                limit=10,
                min_score=0.5
            )
            
            # Verify results
            assert len(results) > 0
            assert all(r["score"] >= 0.5 for r in results)
            
            # Check that different result types are included
            result_types = set(r["item_type"] for r in results)
            sources = set(r["source"] for r in results)
            
            assert "message" in result_types or "entity" in result_types
            assert len(sources) > 1  # Should have results from multiple sources
            
            # Verify result structure
            for result in results:
                assert "item_id" in result
                assert "item_type" in result
                assert "content" in result
                assert "score" in result
                assert "source" in result
                assert "metadata" in result

        @pytest.mark.asyncio
        async def test_search_workflow_with_entity_context(self, hybrid_search, mock_session):
            """Test search workflow that includes entity context"""
            # First search for entities
            entity_results = [
                SearchResult("entity1", "entity", "API", 0.9, "keyword",
                          {"entity_type": "concept", "conversation_id": "conv1"})
            ]
            
            hybrid_search._semantic_search = AsyncMock(return_value=[])
            hybrid_search._keyword_search = AsyncMock(return_value=entity_results)
            hybrid_search._graph_search = AsyncMock(return_value=[])
            
            # Mock entity for context search
            mock_entity = Entity(
                id="entity1",
                name="API",
                entity_type="concept",
                conversation_id="conv1"
            )
            mock_session.get.return_value = mock_entity
            
            mock_context = {
                "entity": {"id": "entity1", "name": "API", "entity_type": "concept"},
                "neighbors": {"depth_1": [{"id": "rel1", "name": "Server"}]},
                "outgoing_relationships": [{"target_id": "rel1", "relationship_type": "uses"}],
                "incoming_relationships": []
            }
            hybrid_search.kg.get_entity_context.return_value = mock_context
            
            # Mock related messages
            mock_message = Message(
                id=1,
                conversation_id="conv1",
                content="API server implementation",
                role="user",
                timestamp=datetime(2023, 1, 1)
            )
            mock_result = AsyncMock()
            mock_result.scalars.return_value.all.return_value = [mock_message]
            mock_session.execute.return_value = mock_result
            
            # Execute search and get entity context
            search_results = await hybrid_search.search(
                session=mock_session,
                query="API",
                mode="keyword",
                limit=10
            )
            
            entity_context = await hybrid_search.search_by_entity(
                session=mock_session,
                entity_id="entity1",
                depth=1,
                limit=10
            )
            
            # Verify integrated workflow
            assert len(search_results) == 1
            assert search_results[0]["item_id"] == "entity1"
            
            assert "entity" in entity_context
            assert "neighbors" in entity_context
            assert "related_messages" in entity_context
            assert len(entity_context["related_messages"]) == 1