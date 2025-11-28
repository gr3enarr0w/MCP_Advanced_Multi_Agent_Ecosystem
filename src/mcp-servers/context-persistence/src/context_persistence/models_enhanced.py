"""
Enhanced models for Context Persistence - Phase 6
Adds:
- Bi-temporal schema (event_time + ingestion_time)
- Entity extraction
- Knowledge graph (entities + relationships)
"""

from datetime import datetime
from typing import Optional
import sqlalchemy as sa
from sqlalchemy.orm import declarative_base, relationship as sa_relationship

Base = declarative_base()


# ============================================================================
# Bi-Temporal Schema - Tracks both when events occurred and when we learned about them
# ============================================================================

class Entity(Base):
    """
    Represents an entity extracted from conversations.
    Uses bi-temporal modeling to track:
    - event_time: When the entity was actually relevant
    - ingestion_time: When we learned about it
    - valid_from/valid_until: Time ranges for validity
    """
    __tablename__ = "entities"

    id = sa.Column(sa.String, primary_key=True)
    name = sa.Column(sa.String, nullable=False, index=True)
    entity_type = sa.Column(sa.String, nullable=False, index=True)  # person, project, tool, concept, code, file
    description = sa.Column(sa.Text, nullable=True)

    # Bi-temporal fields
    event_time = sa.Column(sa.DateTime, nullable=False)  # When this was true in reality
    ingestion_time = sa.Column(sa.DateTime, default=datetime.utcnow, nullable=False)  # When we learned about it
    valid_from = sa.Column(sa.DateTime, nullable=False)  # Start of validity period
    valid_until = sa.Column(sa.DateTime, nullable=True)  # End of validity (NULL = still valid)

    # Source tracking
    conversation_id = sa.Column(sa.String, nullable=True)
    message_id = sa.Column(sa.Integer, nullable=True)

    # Metadata
    confidence = sa.Column(sa.Float, default=1.0)  # 0-1 confidence score
    meta_data = sa.Column(sa.JSON, default=dict)

    # Relationships
    relationships_out = sa_relationship("Relationship", foreign_keys="Relationship.source_entity_id", back_populates="source")
    relationships_in = sa_relationship("Relationship", foreign_keys="Relationship.target_entity_id", back_populates="target")


class Relationship(Base):
    """
    Represents relationships between entities in the knowledge graph.
    Examples:
    - Person "works_on" Project
    - Code "uses" Tool
    - Concept "relates_to" Concept
    """
    __tablename__ = "relationships"

    id = sa.Column(sa.String, primary_key=True)
    source_entity_id = sa.Column(sa.String, sa.ForeignKey("entities.id"), nullable=False, index=True)
    target_entity_id = sa.Column(sa.String, sa.ForeignKey("entities.id"), nullable=False, index=True)
    relationship_type = sa.Column(sa.String, nullable=False, index=True)  # works_on, uses, knows, created, etc.

    # Bi-temporal fields
    event_time = sa.Column(sa.DateTime, nullable=False)
    ingestion_time = sa.Column(sa.DateTime, default=datetime.utcnow, nullable=False)
    valid_from = sa.Column(sa.DateTime, nullable=False)
    valid_until = sa.Column(sa.DateTime, nullable=True)

    # Source tracking
    conversation_id = sa.Column(sa.String, nullable=True)
    message_id = sa.Column(sa.Integer, nullable=True)

    # Metadata
    confidence = sa.Column(sa.Float, default=1.0)
    properties = sa.Column(sa.JSON, default=dict)  # Additional properties

    # SQLAlchemy relationships
    source = sa_relationship("Entity", foreign_keys=[source_entity_id], back_populates="relationships_out")
    target = sa_relationship("Entity", foreign_keys=[target_entity_id], back_populates="relationships_in")


class EntityMention(Base):
    """
    Tracks where entities are mentioned in conversations.
    Links entities back to specific messages for context.
    """
    __tablename__ = "entity_mentions"

    id = sa.Column(sa.Integer, primary_key=True, autoincrement=True)
    entity_id = sa.Column(sa.String, sa.ForeignKey("entities.id"), nullable=False, index=True)
    conversation_id = sa.Column(sa.String, nullable=False, index=True)
    message_id = sa.Column(sa.Integer, nullable=False)

    # Mention details
    mention_text = sa.Column(sa.String, nullable=False)  # Actual text that mentioned the entity
    context_snippet = sa.Column(sa.Text, nullable=True)  # Surrounding context
    position = sa.Column(sa.Integer, nullable=True)  # Character position in message

    timestamp = sa.Column(sa.DateTime, default=datetime.utcnow, nullable=False)
    confidence = sa.Column(sa.Float, default=1.0)


class TopicCluster(Base):
    """
    Groups related conversations and entities by topic.
    Enables topic-based search and navigation.
    """
    __tablename__ = "topic_clusters"

    id = sa.Column(sa.String, primary_key=True)
    name = sa.Column(sa.String, nullable=False)
    description = sa.Column(sa.Text, nullable=True)

    # Cluster characteristics
    keywords = sa.Column(sa.JSON, default=list)  # Key terms in this cluster
    entity_ids = sa.Column(sa.JSON, default=list)  # Related entities
    conversation_ids = sa.Column(sa.JSON, default=list)  # Related conversations

    # Temporal tracking
    created_at = sa.Column(sa.DateTime, default=datetime.utcnow, nullable=False)
    last_updated = sa.Column(sa.DateTime, default=datetime.utcnow, onupdate=datetime.utcnow)

    # Metadata
    size = sa.Column(sa.Integer, default=0)  # Number of items in cluster
    centroid_vector = sa.Column(sa.JSON, nullable=True)  # Vector representation


class SearchIndex(Base):
    """
    Full-text search index for hybrid search.
    Combines keyword, semantic, and graph-based search.
    """
    __tablename__ = "search_index"

    id = sa.Column(sa.Integer, primary_key=True, autoincrement=True)

    # What's being indexed
    item_type = sa.Column(sa.String, nullable=False, index=True)  # message, entity, relationship
    item_id = sa.Column(sa.String, nullable=False, index=True)

    # Search fields
    content = sa.Column(sa.Text, nullable=False)  # Full searchable text
    keywords = sa.Column(sa.JSON, default=list)  # Extracted keywords
    embedding_id = sa.Column(sa.String, nullable=True)  # Qdrant vector ID

    # Graph connections
    connected_entity_ids = sa.Column(sa.JSON, default=list)  # Related entities

    # Metadata
    timestamp = sa.Column(sa.DateTime, default=datetime.utcnow, nullable=False)
    last_indexed = sa.Column(sa.DateTime, default=datetime.utcnow, onupdate=datetime.utcnow)


# ============================================================================
# Helper functions for bi-temporal queries
# ============================================================================

def get_valid_entities_at_time(session, timestamp: datetime):
    """Get all entities valid at a specific point in time"""
    return session.query(Entity).filter(
        Entity.valid_from <= timestamp,
        sa.or_(
            Entity.valid_until.is_(None),
            Entity.valid_until > timestamp
        )
    )


def get_entity_history(session, entity_id: str):
    """Get full history of an entity including all versions"""
    return session.query(Entity).filter(
        Entity.id == entity_id
    ).order_by(Entity.valid_from).all()


def invalidate_entity(session, entity_id: str, as_of: Optional[datetime] = None):
    """Mark an entity as no longer valid"""
    if as_of is None:
        as_of = datetime.utcnow()

    entity = session.query(Entity).filter(Entity.id == entity_id).first()
    if entity:
        entity.valid_until = as_of


def get_relationship_paths(session, source_id: str, target_id: str, max_depth: int = 3):
    """
    Find all paths between two entities in the knowledge graph.
    Uses recursive CTE for efficient graph traversal.
    """
    # This would use a recursive CTE in SQL
    # Simplified version here - actual implementation would be more complex
    pass
