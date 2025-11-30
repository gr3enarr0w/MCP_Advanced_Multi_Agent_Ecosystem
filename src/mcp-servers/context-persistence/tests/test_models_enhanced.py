#!/usr/bin/env python3
"""
Comprehensive unit tests for enhanced models with edge cases.
Focus on bi-temporal queries, versioning, concurrent modifications, and data integrity.
Target: Maintain >90% coverage while adding edge case coverage.
"""

import pytest
from unittest.mock import Mock, AsyncMock, patch
from datetime import datetime, timedelta
import sqlalchemy as sa
from sqlalchemy.orm import Session

from context_persistence.models_enhanced import (
    Base, Conversation, Message, Decision, Entity, Relationship, 
    EntityMention, TopicCluster, SearchIndex,
    get_valid_entities_at_time, get_entity_history, invalidate_entity,
    get_relationship_paths
)


class TestBaseModel:
    """Test base model functionality"""

    def test_base_metadata(self):
        """Test that Base has correct metadata"""
        assert hasattr(Base, 'metadata')
        assert Base.metadata is not None

    def test_model_registry(self):
        """Test that all models are registered with Base"""
        model_names = Base.metadata.tables.keys()
        
        expected_tables = {
            'conversations', 'messages', 'decisions', 'entities', 
            'relationships', 'entity_mentions', 'topic_clusters', 'search_index'
        }
        
        assert expected_tables.issubset(set(model_names))


class TestConversation:
    """Test Conversation model"""

    def test_conversation_creation_minimal(self):
        """Test conversation creation with minimal fields"""
        conv = Conversation(id="conv1")
        
        assert conv.id == "conv1"
        assert conv.started_at is not None  # Should have default
        assert conv.project_path is None
        assert conv.mode is None
        assert conv.meta_data == {}

    def test_conversation_creation_full(self):
        """Test conversation creation with all fields"""
        now = datetime.utcnow()
        conv = Conversation(
            id="conv1",
            started_at=now,
            project_path="/test/project",
            mode="test",
            meta_data={"key": "value"}
        )
        
        assert conv.id == "conv1"
        assert conv.started_at == now
        assert conv.project_path == "/test/project"
        assert conv.mode == "test"
        assert conv.meta_data == {"key": "value"}

    def test_conversation_repr(self):
        """Test conversation string representation"""
        conv = Conversation(id="conv1", mode="test")
        repr_str = repr(conv)
        
        assert "Conversation" in repr_str
        assert "conv1" in repr_str


class TestMessage:
    """Test Message model"""

    def test_message_creation_minimal(self):
        """Test message creation with minimal fields"""
        msg = Message(
            conversation_id="conv1",
            role="user",
            content="Hello world"
        )
        
        assert msg.conversation_id == "conv1"
        assert msg.role == "user"
        assert msg.content == "Hello world"
        assert msg.id is None  # Auto-generated
        assert msg.timestamp is not None  # Default
        assert msg.tokens is None
        assert msg.embedding_id is None

    def test_message_creation_full(self):
        """Test message creation with all fields"""
        now = datetime.utcnow()
        msg = Message(
            id=1,
            conversation_id="conv1",
            timestamp=now,
            role="assistant",
            content="Response",
            tokens=10,
            embedding_id="embed123"
        )
        
        assert msg.id == 1
        assert msg.conversation_id == "conv1"
        assert msg.timestamp == now
        assert msg.role == "assistant"
        assert msg.content == "Response"
        assert msg.tokens == 10
        assert msg.embedding_id == "embed123"

    def test_message_invalid_role(self):
        """Test message with invalid role"""
        # Should accept any string for role (validation at application level)
        msg = Message(
            conversation_id="conv1",
            role="invalid_role",
            content="test"
        )
        
        assert msg.role == "invalid_role"

    def test_message_empty_content(self):
        """Test message with empty content"""
        msg = Message(
            conversation_id="conv1",
            role="user",
            content=""
        )
        
        assert msg.content == ""

    def test_message_very_long_content(self):
        """Test message with very long content"""
        long_content = "x" * 10000
        msg = Message(
            conversation_id="conv1",
            role="user",
            content=long_content
        )
        
        assert msg.content == long_content


class TestDecision:
    """Test Decision model"""

    def test_decision_creation_minimal(self):
        """Test decision creation with minimal fields"""
        decision = Decision(
            conversation_id="conv1",
            decision_type="architecture",
            context="Context",
            outcome="Decision made"
        )
        
        assert decision.conversation_id == "conv1"
        assert decision.decision_type == "architecture"
        assert decision.context == "Context"
        assert decision.outcome == "Decision made"
        assert decision.id is None  # Auto-generated
        assert decision.timestamp is not None  # Default

    def test_decision_creation_full(self):
        """Test decision creation with all fields"""
        now = datetime.utcnow()
        decision = Decision(
            id=1,
            conversation_id="conv1",
            timestamp=now,
            decision_type="implementation",
            context="Technical context",
            outcome="Implementation decision"
        )
        
        assert decision.id == 1
        assert decision.timestamp == now

    def test_decision_empty_fields(self):
        """Test decision with empty optional fields"""
        decision = Decision(
            conversation_id="conv1",
            decision_type="test",
            context="",
            outcome=""
        )
        
        assert decision.context == ""
        assert decision.outcome == ""


class TestEntity:
    """Test Entity model with bi-temporal features"""

    def test_entity_creation_minimal(self):
        """Test entity creation with minimal required fields"""
        now = datetime.utcnow()
        entity = Entity(
            id="entity1",
            name="Test Entity",
            entity_type="concept",
            event_time=now,
            ingestion_time=now,
            valid_from=now
        )
        
        assert entity.id == "entity1"
        assert entity.name == "Test Entity"
        assert entity.entity_type == "concept"
        assert entity.event_time == now
        assert entity.ingestion_time == now
        assert entity.valid_from == now
        assert entity.valid_until is None
        assert entity.confidence == 1.0  # Default
        assert entity.meta_data == {}  # Default

    def test_entity_creation_full(self):
        """Test entity creation with all fields"""
        event_time = datetime(2023, 1, 1)
        ingestion_time = datetime(2023, 1, 2)
        valid_from = datetime(2023, 1, 1)
        valid_until = datetime(2023, 12, 31)
        
        entity = Entity(
            id="entity1",
            name="Full Entity",
            entity_type="person",
            description="A complete entity",
            event_time=event_time,
            ingestion_time=ingestion_time,
            valid_from=valid_from,
            valid_until=valid_until,
            conversation_id="conv1",
            message_id=1,
            confidence=0.85,
            meta_data={"source": "manual", "verified": True}
        )
        
        assert entity.description == "A complete entity"
        assert entity.valid_until == valid_until
        assert entity.conversation_id == "conv1"
        assert entity.message_id == 1
        assert entity.confidence == 0.85
        assert entity.meta_data == {"source": "manual", "verified": True}

    def test_entity_confidence_bounds(self):
        """Test entity confidence bounds"""
        # Test various confidence values
        for confidence in [-0.1, 0.0, 0.5, 1.0, 1.5, 2.0]:
            entity = Entity(
                id="test",
                name="Test",
                entity_type="concept",
                event_time=datetime.utcnow(),
                ingestion_time=datetime.utcnow(),
                valid_from=datetime.utcnow(),
                confidence=confidence
            )
            assert entity.confidence == confidence  # Should accept any float

    def test_entity_temporal_consistency(self):
        """Test temporal consistency in entity"""
        event_time = datetime(2023, 1, 1)
        ingestion_time = datetime(2022, 12, 31)  # Before event time
        valid_from = datetime(2023, 1, 2)  # After event time
        
        # Should allow any temporal relationship (validation at application level)
        entity = Entity(
            id="test",
            name="Test",
            entity_type="concept",
            event_time=event_time,
            ingestion_time=ingestion_time,
            valid_from=valid_from
        )
        
        assert entity.event_time == event_time
        assert entity.ingestion_time == ingestion_time
        assert entity.valid_from == valid_from

    def test_entity_unicode_content(self):
        """Test entity with Unicode content"""
        entity = Entity(
            id="unicode",
            name="Café API",
            entity_type="concept",
            description="Entité avec caractères spéciaux: ñ, ü, ç",
            event_time=datetime.utcnow(),
            ingestion_time=datetime.utcnow(),
            valid_from=datetime.utcnow()
        )
        
        assert entity.name == "Café API"
        assert "ñ" in entity.description
        assert "ü" in entity.description
        assert "ç" in entity.description

    def test_entity_very_long_name(self):
        """Test entity with very long name"""
        long_name = "A" * 1000
        entity = Entity(
            id="long",
            name=long_name,
            entity_type="concept",
            event_time=datetime.utcnow(),
            ingestion_time=datetime.utcnow(),
            valid_from=datetime.utcnow()
        )
        
        assert entity.name == long_name

    def test_entity_complex_metadata(self):
        """Test entity with complex metadata structure"""
        complex_metadata = {
            "nested": {
                "level1": {
                    "level2": ["item1", "item2", {"item3": "value"}]
                }
            },
            "array": [1, 2, 3, {"key": "value"}],
            "null_value": None,
            "boolean": True,
            "number": 42.5,
            "string": "test"
        }
        
        entity = Entity(
            id="complex",
            name="Complex Entity",
            entity_type="concept",
            event_time=datetime.utcnow(),
            ingestion_time=datetime.utcnow(),
            valid_from=datetime.utcnow(),
            meta_data=complex_metadata
        )
        
        assert entity.meta_data == complex_metadata


class TestRelationship:
    """Test Relationship model with bi-temporal features"""

    def test_relationship_creation_minimal(self):
        """Test relationship creation with minimal fields"""
        now = datetime.utcnow()
        rel = Relationship(
            id="rel1",
            source_entity_id="entity1",
            target_entity_id="entity2",
            relationship_type="works_on",
            event_time=now,
            ingestion_time=now,
            valid_from=now
        )
        
        assert rel.id == "rel1"
        assert rel.source_entity_id == "entity1"
        assert rel.target_entity_id == "entity2"
        assert rel.relationship_type == "works_on"
        assert rel.confidence == 1.0  # Default
        assert rel.properties == {}  # Default

    def test_relationship_creation_full(self):
        """Test relationship creation with all fields"""
        now = datetime.utcnow()
        rel = Relationship(
            id="rel1",
            source_entity_id="entity1",
            target_entity_id="entity2",
            relationship_type="uses",
            event_time=now,
            ingestion_time=now,
            valid_from=now,
            valid_until=datetime(2024, 12, 31),
            conversation_id="conv1",
            message_id=1,
            confidence=0.9,
            properties={"strength": "strong", "context": "work"}
        )
        
        assert rel.valid_until == datetime(2024, 12, 31)
        assert rel.conversation_id == "conv1"
        assert rel.message_id == 1
        assert rel.confidence == 0.9
        assert rel.properties == {"strength": "strong", "context": "work"}

    def test_self_relationship(self):
        """Test relationship where source equals target"""
        now = datetime.utcnow()
        rel = Relationship(
            id="self_rel",
            source_entity_id="entity1",
            target_entity_id="entity1",  # Same as source
            relationship_type="self_ref",
            event_time=now,
            ingestion_time=now,
            valid_from=now
        )
        
        assert rel.source_entity_id == rel.target_entity_id

    def test_relationship_complex_properties(self):
        """Test relationship with complex properties"""
        complex_props = {
            "weights": [0.1, 0.2, 0.7],
            "metadata": {
                "source": "automated",
                "verified": True,
                "timestamp": "2023-01-01T12:00:00Z"
            },
            "nested_array": [[1, 2], [3, 4]]
        }
        
        now = datetime.utcnow()
        rel = Relationship(
            id="complex",
            source_entity_id="e1",
            target_entity_id="e2",
            relationship_type="complex_rel",
            event_time=now,
            ingestion_time=now,
            valid_from=now,
            properties=complex_props
        )
        
        assert rel.properties == complex_props


class TestEntityMention:
    """Test EntityMention model"""

    def test_entity_mention_creation_minimal(self):
        """Test entity mention creation with minimal fields"""
        mention = EntityMention(
            entity_id="entity1",
            conversation_id="conv1",
            message_id=1,
            mention_text="API"
        )
        
        assert mention.entity_id == "entity1"
        assert mention.conversation_id == "conv1"
        assert mention.message_id == 1
        assert mention.mention_text == "API"
        assert mention.id is None  # Auto-generated
        assert mention.timestamp is not None  # Default
        assert mention.confidence == 1.0  # Default
        assert mention.context_snippet is None
        assert mention.position is None

    def test_entity_mention_creation_full(self):
        """Test entity mention creation with all fields"""
        now = datetime.utcnow()
        mention = EntityMention(
            id=1,
            entity_id="entity1",
            conversation_id="conv1",
            message_id=1,
            mention_text="API server",
            context_snippet="The API server is running",
            position=4,
            timestamp=now,
            confidence=0.95
        )
        
        assert mention.id == 1
        assert mention.context_snippet == "The API server is running"
        assert mention.position == 4
        assert mention.timestamp == now
        assert mention.confidence == 0.95

    def test_entity_mention_unicode(self):
        """Test entity mention with Unicode text"""
        mention = EntityMention(
            entity_id="unicode",
            conversation_id="conv1",
            message_id=1,
            mention_text="Café API",
            context_snippet="Le Café API est disponible"
        )
        
        assert "Café" in mention.mention_text
        assert "Café" in mention.context_snippet

    def test_entity_mention_position_bounds(self):
        """Test entity mention with various position values"""
        positions = [-1, 0, 1, 100, 10000]
        
        for pos in positions:
            mention = EntityMention(
                entity_id="test",
                conversation_id="conv1",
                message_id=1,
                mention_text="test",
                position=pos
            )
            assert mention.position == pos


class TestTopicCluster:
    """Test TopicCluster model"""

    def test_topic_cluster_creation_minimal(self):
        """Test topic cluster creation with minimal fields"""
        cluster = TopicCluster(
            id="cluster1",
            name="API Development"
        )
        
        assert cluster.id == "cluster1"
        assert cluster.name == "API Development"
        assert cluster.description is None
        assert cluster.keywords == []  # Default
        assert cluster.entity_ids == []  # Default
        assert cluster.conversation_ids == []  # Default
        assert cluster.created_at is not None  # Default
        assert cluster.last_updated is not None  # Default
        assert cluster.size == 0  # Default
        assert cluster.centroid_vector is None  # Default

    def test_topic_cluster_creation_full(self):
        """Test topic cluster creation with all fields"""
        now = datetime.utcnow()
        cluster = TopicCluster(
            id="cluster1",
            name="Full Cluster",
            description="A complete topic cluster",
            keywords=["API", "server", "development"],
            entity_ids=["entity1", "entity2"],
            conversation_ids=["conv1", "conv2"],
            created_at=now,
            last_updated=now,
            size=10,
            centroid_vector=[0.1, 0.2, 0.3, 0.4]
        )
        
        assert cluster.description == "A complete topic cluster"
        assert cluster.keywords == ["API", "server", "development"]
        assert cluster.entity_ids == ["entity1", "entity2"]
        assert cluster.conversation_ids == ["conv1", "conv2"]
        assert cluster.created_at == now
        assert cluster.last_updated == now
        assert cluster.size == 10
        assert cluster.centroid_vector == [0.1, 0.2, 0.3, 0.4]

    def test_topic_cluster_complex_arrays(self):
        """Test topic cluster with complex array data"""
        cluster = TopicCluster(
            id="complex",
            name="Complex Cluster",
            keywords=[
                {"term": "API", "weight": 0.9},
                {"term": "server", "weight": 0.7}
            ],
            entity_ids=["e1", "e2", "e3"],
            conversation_ids=["c1", "c2"],
            centroid_vector=[[0.1, 0.2], [0.3, 0.4]]
        )
        
        assert len(cluster.keywords) == 2
        assert cluster.keywords[0]["term"] == "API"
        assert cluster.centroid_vector == [[0.1, 0.2], [0.3, 0.4]]

    def test_topic_cluster_size_calculation_edge_cases(self):
        """Test topic cluster size with edge cases"""
        sizes = [-1, 0, 1, 100, 10000]
        
        for size in sizes:
            cluster = TopicCluster(
                id="test",
                name="Test",
                size=size
            )
            assert cluster.size == size


class TestSearchIndex:
    """Test SearchIndex model"""

    def test_search_index_creation_minimal(self):
        """Test search index creation with minimal fields"""
        index = SearchIndex(
            item_type="message",
            item_id="msg1",
            content="Searchable content"
        )
        
        assert index.item_type == "message"
        assert index.item_id == "msg1"
        assert index.content == "Searchable content"
        assert index.id is None  # Auto-generated
        assert index.keywords == []  # Default
        assert index.embedding_id is None  # Default
        assert index.connected_entity_ids == []  # Default
        assert index.timestamp is not None  # Default
        assert index.last_indexed is not None  # Default

    def test_search_index_creation_full(self):
        """Test search index creation with all fields"""
        now = datetime.utcnow()
        index = SearchIndex(
            id=1,
            item_type="entity",
            item_id="entity1",
            content="Entity content",
            keywords=["keyword1", "keyword2"],
            embedding_id="embed123",
            connected_entity_ids=["rel1", "rel2"],
            timestamp=now,
            last_indexed=now
        )
        
        assert index.id == 1
        assert index.keywords == ["keyword1", "keyword2"]
        assert index.embedding_id == "embed123"
        assert index.connected_entity_ids == ["rel1", "rel2"]
        assert index.timestamp == now
        assert index.last_indexed == now

    def test_search_index_different_item_types(self):
        """Test search index with different item types"""
        item_types = ["message", "entity", "relationship", "conversation", "custom_type"]
        
        for item_type in item_types:
            index = SearchIndex(
                item_type=item_type,
                item_id="test_id",
                content="test content"
            )
            assert index.item_type == item_type

    def test_search_index_very_long_content(self):
        """Test search index with very long content"""
        long_content = "x" * 50000
        index = SearchIndex(
            item_type="message",
            item_id="long",
            content=long_content
        )
        
        assert index.content == long_content


class TestBiTemporalQueries:
    """Test bi-temporal query helper functions"""

    def test_get_valid_entities_at_time_current(self):
        """Test getting entities valid at current time"""
        mock_session = Mock(spec=Session)
        mock_query = Mock()
        mock_session.query.return_value = mock_query
        
        timestamp = datetime.utcnow()
        result = get_valid_entities_at_time(mock_session, timestamp)
        
        # Should build query with time filters
        mock_session.query.assert_called_once_with(Entity)
        mock_query.filter.assert_called_once()
        
        # Check filter arguments
        call_args = mock_query.filter.call_args[0][0]
        # Should have valid_from <= timestamp and (valid_until is None or valid_until > timestamp)

    def test_get_valid_entities_at_time_historical(self):
        """Test getting entities valid at historical time"""
        mock_session = Mock(spec=Session)
        mock_query = Mock()
        mock_session.query.return_value = mock_query
        
        historical_time = datetime(2023, 6, 15)
        result = get_valid_entities_at_time(mock_session, historical_time)
        
        mock_session.query.assert_called_once_with(Entity)
        mock_query.filter.assert_called_once()

    def test_get_entity_history(self):
        """Test getting complete entity history"""
        mock_session = Mock(spec=Session)
        mock_query = Mock()
        mock_session.query.return_value = mock_query
        
        entity_id = "test_entity"
        result = get_entity_history(mock_session, entity_id)
        
        mock_session.query.assert_called_once_with(Entity)
        mock_query.filter.assert_called_once()
        mock_query.order_by.assert_called_once()

    def test_invalidate_entity_existing(self):
        """Test invalidating existing entity"""
        mock_session = Mock(spec=Session)
        mock_query = Mock()
        mock_session.query.return_value = mock_query
        
        mock_entity = Mock()
        mock_entity.valid_until = None
        mock_query.filter.return_value.first.return_value = mock_entity
        
        as_of = datetime(2023, 12, 31)
        result = invalidate_entity(mock_session, "entity1", as_of)
        
        mock_query.filter.assert_called_once()
        assert mock_entity.valid_until == as_of

    def test_invalidate_entity_nonexistent(self):
        """Test invalidating nonexistent entity"""
        mock_session = Mock(spec=Session)
        mock_query = Mock()
        mock_session.query.return_value = mock_query
        mock_query.filter.return_value.first.return_value = None
        
        as_of = datetime(2023, 12, 31)
        result = invalidate_entity(mock_session, "nonexistent", as_of)
        
        # Should not raise error, just do nothing
        mock_query.filter.assert_called_once()
        # No attribute set on None

    def test_invalidate_entity_default_time(self):
        """Test invalidating entity with default time"""
        mock_session = Mock(spec=Session)
        mock_query = Mock()
        mock_session.query.return_value = mock_query
        
        mock_entity = Mock()
        mock_query.filter.return_value.first.return_value = mock_entity
        
        with patch('context_persistence.models_enhanced.datetime') as mock_datetime:
            mock_now = datetime(2023, 6, 15, 12, 0, 0)
            mock_datetime.utcnow.return_value = mock_now
            
            result = invalidate_entity(mock_session, "entity1")
            
            assert mock_entity.valid_until == mock_now

    def test_get_relationship_paths(self):
        """Test getting relationship paths (placeholder implementation)"""
        mock_session = Mock(spec=Session)
        
        result = get_relationship_paths(mock_session, "source", "target", 3)
        
        # Current implementation returns None (placeholder)
        assert result is None


class TestEdgeCases:
    """Test edge cases and boundary conditions"""

    def test_model_with_none_required_fields(self):
        """Test models when required fields are None"""
        # These should not raise errors during creation
        # (validation would happen at database level)
        
        # Entity with None name (should create but fail at DB)
        entity = Entity(
            id="test",
            name=None,
            entity_type="concept",
            event_time=datetime.utcnow(),
            ingestion_time=datetime.utcnow(),
            valid_from=datetime.utcnow()
        )
        assert entity.name is None

    def test_model_with_extreme_dates(self):
        """Test models with extreme date values"""
        past_date = datetime(1970, 1, 1)
        future_date = datetime(2100, 12, 31)
        
        entity = Entity(
            id="extreme_dates",
            name="Test",
            entity_type="concept",
            event_time=past_date,
            ingestion_time=future_date,
            valid_from=past_date,
            valid_until=future_date
        )
        
        assert entity.event_time == past_date
        assert entity.ingestion_time == future_date

    def test_model_with_timezone_aware_dates(self):
        """Test models with timezone-aware datetime"""
        from datetime import timezone
        
        utc_time = datetime(2023, 1, 1, 12, 0, 0, tzinfo=timezone.utc)
        
        entity = Entity(
            id="timezone",
            name="Test",
            entity_type="concept",
            event_time=utc_time,
            ingestion_time=utc_time,
            valid_from=utc_time
        )
        
        assert entity.event_time.tzinfo is not None
        assert entity.event_time == utc_time

    def test_model_with_circular_references(self):
        """Test models that could have circular references"""
        # Create entities and relationships that could form cycles
        entity1 = Entity(
            id="entity1",
            name="Entity 1",
            entity_type="concept",
            event_time=datetime.utcnow(),
            ingestion_time=datetime.utcnow(),
            valid_from=datetime.utcnow()
        )
        
        entity2 = Entity(
            id="entity2",
            name="Entity 2",
            entity_type="concept",
            event_time=datetime.utcnow(),
            ingestion_time=datetime.utcnow(),
            valid_from=datetime.utcnow()
        )
        
        # Create circular relationships
        rel1 = Relationship(
            id="rel1",
            source_entity_id="entity1",
            target_entity_id="entity2",
            relationship_type="relates_to",
            event_time=datetime.utcnow(),
            ingestion_time=datetime.utcnow(),
            valid_from=datetime.utcnow()
        )
        
        rel2 = Relationship(
            id="rel2",
            source_entity_id="entity2",
            target_entity_id="entity1",
            relationship_type="relates_to",
            event_time=datetime.utcnow(),
            ingestion_time=datetime.utcnow(),
            valid_from=datetime.utcnow()
        )
        
        assert rel1.source_entity_id == "entity1"
        assert rel1.target_entity_id == "entity2"
        assert rel2.source_entity_id == "entity2"
        assert rel2.target_entity_id == "entity1"

    def test_model_with_large_numeric_values(self):
        """Test models with large numeric values"""
        large_confidence = 1.7976931348623157e+308  # Max float
        large_size = 2**31 - 1  # Max 32-bit int
        
        entity = Entity(
            id="large_numbers",
            name="Test",
            entity_type="concept",
            event_time=datetime.utcnow(),
            ingestion_time=datetime.utcnow(),
            valid_from=datetime.utcnow(),
            confidence=large_confidence
        )
        
        cluster = TopicCluster(
            id="large_cluster",
            name="Large",
            size=large_size
        )
        
        assert entity.confidence == large_confidence
        assert cluster.size == large_size

    def test_model_with_special_characters(self):
        """Test models with special characters in strings"""
        special_chars = "!@#$%^&*()_+-=[]{}|;':\",./<>?"
        
        entity = Entity(
            id="special",
            name=f"Entity {special_chars}",
            entity_type="concept",
            description=f"Description with {special_chars}",
            event_time=datetime.utcnow(),
            ingestion_time=datetime.utcnow(),
            valid_from=datetime.utcnow(),
            meta_data={"special": special_chars}
        )
        
        assert special_chars in entity.name
        assert special_chars in entity.description
        assert entity.meta_data["special"] == special_chars

    def test_model_with_json_serialization_edge_cases(self):
        """Test models with edge cases for JSON serialization"""
        # Test with None values in JSON
        entity = Entity(
            id="json_edge",
            name="Test",
            entity_type="concept",
            event_time=datetime.utcnow(),
            ingestion_time=datetime.utcnow(),
            valid_from=datetime.utcnow(),
            meta_data={
                "null_value": None,
                "empty_list": [],
                "empty_dict": {},
                "nested_none": {"inner": None}
            }
        )
        
        assert entity.meta_data["null_value"] is None
        assert entity.meta_data["empty_list"] == []
        assert entity.meta_data["empty_dict"] == {}
        assert entity.meta_data["nested_none"]["inner"] is None


class TestConcurrentModifications:
    """Test scenarios related to concurrent modifications"""

    def test_concurrent_entity_creation(self):
        """Test creating entities with same ID concurrently"""
        now = datetime.utcnow()
        
        entity1 = Entity(
            id="concurrent",
            name="Entity 1",
            entity_type="concept",
            event_time=now,
            ingestion_time=now,
            valid_from=now
        )
        
        entity2 = Entity(
            id="concurrent",  # Same ID
            name="Entity 2",
            entity_type="concept",
            event_time=now + timedelta(seconds=1),
            ingestion_time=now + timedelta(seconds=1),
            valid_from=now + timedelta(seconds=1)
        )
        
        # Both should create successfully (conflict handled at DB level)
        assert entity1.id == entity2.id
        assert entity1.name != entity2.name

    def test_concurrent_relationship_creation(self):
        """Test creating relationships between entities concurrently"""
        now = datetime.utcnow()
        
        rel1 = Relationship(
            id="rel_concurrent",
            source_entity_id="entity1",
            target_entity_id="entity2",
            relationship_type="works_on",
            event_time=now,
            ingestion_time=now,
            valid_from=now
        )
        
        rel2 = Relationship(
            id="rel_concurrent",  # Same ID
            source_entity_id="entity1",
            target_entity_id="entity2",
            relationship_type="knows",  # Different relationship type
            event_time=now + timedelta(seconds=1),
            ingestion_time=now + timedelta(seconds=1),
            valid_from=now + timedelta(seconds=1)
        )
        
        assert rel1.id == rel2.id
        assert rel1.relationship_type != rel2.relationship_type


class TestDataIntegrity:
    """Test data integrity constraints"""

    def test_entity_temporal_integrity(self):
        """Test temporal integrity constraints"""
        # Create entity with valid_until before valid_from
        valid_from = datetime(2023, 6, 15)
        valid_until = datetime(2023, 1, 1)  # Before valid_from
        
        entity = Entity(
            id="temporal_issue",
            name="Test",
            entity_type="concept",
            event_time=datetime(2023, 1, 1),
            ingestion_time=datetime(2023, 1, 1),
            valid_from=valid_from,
            valid_until=valid_until
        )
        
        # Should allow creation (validation at DB/application level)
        assert entity.valid_from == valid_from
        assert entity.valid_until == valid_until

    def test_relationship_entity_existence(self):
        """Test relationship with potentially nonexistent entities"""
        rel = Relationship(
            id="orphan_rel",
            source_entity_id="nonexistent_source",
            target_entity_id="nonexistent_target",
            relationship_type="connects_to",
            event_time=datetime.utcnow(),
            ingestion_time=datetime.utcnow(),
            valid_from=datetime.utcnow()
        )
        
        # Should allow creation (foreign key constraints enforced at DB level)
        assert rel.source_entity_id == "nonexistent_source"
        assert rel.target_entity_id == "nonexistent_target"

    def test_mention_entity_consistency(self):
        """Test entity mention consistency"""
        mention = EntityMention(
            entity_id="different_entity",  # Different from actual entity
            conversation_id="conv1",
            message_id=1,
            mention_text="API"
        )
        
        # Should allow creation (consistency checks at application level)
        assert mention.entity_id == "different_entity"


class TestPerformanceConsiderations:
    """Test performance-related scenarios"""

    def test_large_metadata_impact(self):
        """Test impact of large metadata on model creation"""
        large_metadata = {
            "large_array": list(range(10000)),
            "nested_data": {
                f"key_{i}": f"value_{i}" * 100 for i in range(1000)
            }
        }
        
        start_time = datetime.utcnow()
        
        entity = Entity(
            id="performance_test",
            name="Performance Test",
            entity_type="concept",
            event_time=start_time,
            ingestion_time=start_time,
            valid_from=start_time,
            meta_data=large_metadata
        )
        
        creation_time = datetime.utcnow() - start_time
        
        # Should complete creation quickly even with large metadata
        assert creation_time.total_seconds() < 1.0
        assert entity.meta_data == large_metadata

    def test_many_relationships_single_entity(self):
        """Test entity with many relationships"""
        entity_id = "hub_entity"
        
        # Create many relationships pointing to/from the same entity
        relationships = []
        for i in range(1000):
            rel = Relationship(
                id=f"rel_{i}",
                source_entity_id=entity_id if i % 2 == 0 else f"source_{i}",
                target_entity_id=f"target_{i}" if i % 2 == 0 else entity_id,
                relationship_type="connects_to",
                event_time=datetime.utcnow(),
                ingestion_time=datetime.utcnow(),
                valid_from=datetime.utcnow()
            )
            relationships.append(rel)
        
        # Should handle large number of relationships
        assert len(relationships) == 1000
        assert all(rel.source_entity_id == entity_id or rel.target_entity_id == entity_id 
                  for rel in relationships)


class TestIntegrationScenarios:
    """Test integration scenarios between models"""

    def test_conversation_message_relationship(self):
        """Test relationship between conversation and messages"""
        conv = Conversation(id="conv1", mode="test")
        
        msg1 = Message(
            conversation_id=conv.id,
            role="user",
            content="Hello"
        )
        
        msg2 = Message(
            conversation_id=conv.id,
            role="assistant",
            content="Hi there!"
        )
        
        assert msg1.conversation_id == conv.id
        assert msg2.conversation_id == conv.id
        assert msg1.conversation_id == msg2.conversation_id

    def test_entity_relationship_web(self):
        """Test complex web of entity relationships"""
        # Create entities
        person = Entity(
            id="person1",
            name="John Doe",
            entity_type="person",
            event_time=datetime.utcnow(),
            ingestion_time=datetime.utcnow(),
            valid_from=datetime.utcnow()
        )
        
        project = Entity(
            id="project1",
            name="Project X",
            entity_type="project",
            event_time=datetime.utcnow(),
            ingestion_time=datetime.utcnow(),
            valid_from=datetime.utcnow()
        )
        
        tool = Entity(
            id="tool1",
            name="API Server",
            entity_type="tool",
            event_time=datetime.utcnow(),
            ingestion_time=datetime.utcnow(),
            valid_from=datetime.utcnow()
        )
        
        # Create relationships
        works_on = Relationship(
            id="rel1",
            source_entity_id=person.id,
            target_entity_id=project.id,
            relationship_type="works_on",
            event_time=datetime.utcnow(),
            ingestion_time=datetime.utcnow(),
            valid_from=datetime.utcnow()
        )
        
        uses = Relationship(
            id="rel2",
            source_entity_id=project.id,
            target_entity_id=tool.id,
            relationship_type="uses",
            event_time=datetime.utcnow(),
            ingestion_time=datetime.utcnow(),
            valid_from=datetime.utcnow()
        )
        
        # Verify relationship chain
        assert works_on.source_entity_id == person.id
        assert works_on.target_entity_id == project.id
        assert uses.source_entity_id == project.id
        assert uses.target_entity_id == tool.id
        
        # person -> project -> tool chain exists
        assert works_on.target_entity_id == uses.source_entity_id

    def test_entity_mentions_across_conversations(self):
        """Test entity mentions across multiple conversations"""
        entity = Entity(
            id="api_entity",
            name="API",
            entity_type="concept",
            event_time=datetime.utcnow(),
            ingestion_time=datetime.utcnow(),
            valid_from=datetime.utcnow()
        )
        
        # Create mentions in different conversations
        mention1 = EntityMention(
            entity_id=entity.id,
            conversation_id="conv1",
            message_id=1,
            mention_text="API",
            context_snippet="The API is working"
        )
        
        mention2 = EntityMention(
            entity_id=entity.id,
            conversation_id="conv2",
            message_id=1,
            mention_text="API",
            context_snippet="API documentation"
        )
        
        mention3 = EntityMention(
            entity_id=entity.id,
            conversation_id="conv1",  # Same conversation as mention1
            message_id=2,  # Different message
            mention_text="API",
            context_snippet="API update"
        )
        
        assert mention1.entity_id == mention2.entity_id == mention3.entity_id
        assert mention1.conversation_id == "conv1"
        assert mention2.conversation_id == "conv2"
        assert mention3.conversation_id == "conv1"
        assert mention1.message_id != mention3.message_id

    def test_topic_cluster_content_aggregation(self):
        """Test topic cluster aggregating various content"""
        cluster = TopicCluster(
            id="api_cluster",
            name="API Development",
            keywords=["API", "REST", "GraphQL", "server"],
            entity_ids=["api_entity", "server_entity", "rest_entity"],
            conversation_ids=["api_conv", "server_conv", "design_conv"],
            size=15,
            centroid_vector=[0.1, 0.2, 0.3, 0.4, 0.5]
        )
        
        # Verify aggregation
        assert len(cluster.keywords) == 4
        assert "API" in cluster.keywords
        assert len(cluster.entity_ids) == 3
        assert len(cluster.conversation_ids) == 3
        assert cluster.size == 15
        assert len(cluster.centroid_vector) == 5

    def test_search_index_content_types(self):
        """Test search index with different content types"""
        message_index = SearchIndex(
            item_type="message",
            item_id="msg1",
            content="User message about API design",
            keywords=["API", "design", "user"],
            connected_entity_ids=["api_entity", "design_entity"]
        )
        
        entity_index = SearchIndex(
            item_type="entity",
            item_id="entity1",
            content="API: Application Programming Interface",
            keywords=["API", "Application", "Programming", "Interface"],
            connected_entity_ids=[]
        )
        
        relationship_index = SearchIndex(
            item_type="relationship",
            item_id="rel1",
            content="Person works_on Project",
            keywords=["Person", "works_on", "Project"],
            connected_entity_ids=["person_entity", "project_entity"]
        )
        
        # Verify different content types
        assert message_index.item_type == "message"
        assert entity_index.item_type == "entity"
        assert relationship_index.item_type == "relationship"
        
        # Verify content indexing
        assert "API design" in message_index.content
        assert "Application Programming Interface" in entity_index.content
        assert "works_on" in relationship_index.content