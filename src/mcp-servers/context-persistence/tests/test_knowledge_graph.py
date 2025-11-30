#!/usr/bin/env python3
"""
Comprehensive unit tests for KnowledgeGraph component.
Target: >80% code coverage for knowledge_graph.py
"""

import pytest
from unittest.mock import Mock, AsyncMock, patch
from datetime import datetime
import networkx as nx

from context_persistence.knowledge_graph import KnowledgeGraph
from context_persistence.models_enhanced import Entity, Relationship


class TestKnowledgeGraph:
    """Test suite for KnowledgeGraph class"""

    @pytest.fixture
    def knowledge_graph(self):
        """Create KnowledgeGraph instance for testing"""
        return KnowledgeGraph()

    @pytest.fixture
    def mock_session(self):
        """Create mock database session"""
        session = AsyncMock()
        return session

    @pytest.fixture
    def sample_entities(self):
        """Create sample entity objects for testing"""
        return [
            Entity(
                id="entity1",
                name="John Doe",
                entity_type="person",
                description="A person",
                confidence=0.9,
                conversation_id="conv1",
                message_id=1,
                event_time=datetime(2023, 1, 1),
                ingestion_time=datetime(2023, 1, 1),
                valid_from=datetime(2023, 1, 1),
                valid_until=None,
                meta_data={}
            ),
            Entity(
                id="entity2", 
                name="Project X",
                entity_type="project",
                description="A project",
                confidence=0.8,
                conversation_id="conv1",
                message_id=2,
                event_time=datetime(2023, 1, 2),
                ingestion_time=datetime(2023, 1, 2),
                valid_from=datetime(2023, 1, 2),
                valid_until=None,
                meta_data={}
            ),
            Entity(
                id="entity3",
                name="API Server",
                entity_type="tool",
                description="A server tool",
                confidence=0.7,
                conversation_id="conv2",
                message_id=3,
                event_time=datetime(2023, 1, 3),
                ingestion_time=datetime(2023, 1, 3),
                valid_from=datetime(2023, 1, 3),
                valid_until=None,
                meta_data={}
            )
        ]

    @pytest.fixture
    def sample_relationships(self):
        """Create sample relationship objects for testing"""
        return [
            Relationship(
                id="rel1",
                source_entity_id="entity1",
                target_entity_id="entity2",
                relationship_type="works_on",
                confidence=0.9,
                conversation_id="conv1",
                message_id=2,
                event_time=datetime(2023, 1, 2),
                ingestion_time=datetime(2023, 1, 2),
                valid_from=datetime(2023, 1, 2),
                valid_until=None,
                properties={}
            ),
            Relationship(
                id="rel2",
                source_entity_id="entity2",
                target_entity_id="entity3", 
                relationship_type="uses",
                confidence=0.8,
                conversation_id="conv2",
                message_id=3,
                event_time=datetime(2023, 1, 3),
                ingestion_time=datetime(2023, 1, 3),
                valid_from=datetime(2023, 1, 3),
                valid_until=None,
                properties={}
            )
        ]

    class TestInitialization:
        """Test KnowledgeGraph initialization"""

        def test_init_default(self):
            """Test default initialization"""
            kg = KnowledgeGraph()
            
            assert isinstance(kg.graph, nx.MultiDiGraph)
            assert kg.graph.number_of_nodes() == 0
            assert kg.graph.number_of_edges() == 0
            assert kg._last_refresh is None

        def test_init_graph_type(self):
            """Test that correct graph type is created"""
            kg = KnowledgeGraph()
            
            # Should be a MultiDiGraph (directed multigraph)
            assert isinstance(kg.graph, nx.MultiDiGraph)
            assert kg.graph.is_directed()
            assert kg.graph.is_multigraph()

    class TestGraphBuilding:
        """Test graph building from database"""

        @pytest.mark.asyncio
        async def test_build_graph_empty_database(self, knowledge_graph, mock_session):
            """Test building graph from empty database"""
            # Mock empty results
            mock_session.execute.return_value.scalars.return_value.all.side_effect = [[], []]
            
            node_count = await knowledge_graph.build_graph(mock_session)
            
            assert node_count == 0
            assert knowledge_graph.graph.number_of_nodes() == 0
            assert knowledge_graph.graph.number_of_edges() == 0
            assert knowledge_graph._last_refresh is not None

        @pytest.mark.asyncio
        async def test_build_graph_with_entities(self, knowledge_graph, mock_session, sample_entities):
            """Test building graph with entities only"""
            mock_session.execute.return_value.scalars.return_value.all.side_effect = [
                sample_entities,  # entities
                []  # relationships
            ]
            
            node_count = await knowledge_graph.build_graph(mock_session)
            
            assert node_count == len(sample_entities)
            assert knowledge_graph.graph.number_of_nodes() == len(sample_entities)
            assert knowledge_graph.graph.number_of_edges() == 0
            
            # Check that entities were added as nodes
            for entity in sample_entities:
                assert entity.id in knowledge_graph.graph
                node_data = knowledge_graph.graph.nodes[entity.id]
                assert node_data["name"] == entity.name
                assert node_data["entity_type"] == entity.entity_type
                assert node_data["confidence"] == entity.confidence

        @pytest.mark.asyncio
        async def test_build_graph_with_relationships(self, knowledge_graph, mock_session, sample_entities, sample_relationships):
            """Test building graph with entities and relationships"""
            mock_session.execute.return_value.scalars.return_value.all.side_effect = [
                sample_entities,  # entities
                sample_relationships  # relationships
            ]
            
            node_count = await knowledge_graph.build_graph(mock_session)
            
            assert node_count == len(sample_entities)
            assert knowledge_graph.graph.number_of_nodes() == len(sample_entities)
            assert knowledge_graph.graph.number_of_edges() == len(sample_relationships)
            
            # Check that relationships were added as edges
            for rel in sample_relationships:
                assert knowledge_graph.graph.has_edge(rel.source_entity_id, rel.target_entity_id)
                edge_data = knowledge_graph.graph.get_edge_data(rel.source_entity_id, rel.target_entity_id)
                assert rel.id in edge_data
                assert edge_data[rel.id]["relationship_type"] == rel.relationship_type
                assert edge_data[rel.id]["confidence"] == rel.confidence

        @pytest.mark.asyncio
        async def test_build_graph_with_as_of_time(self, knowledge_graph, mock_session):
            """Test building graph with specific as_of time"""
            as_of_time = datetime(2023, 6, 1)
            
            # Mock query filters
            with patch('sqlalchemy.select') as mock_select:
                mock_session.execute.return_value.scalars.return_value.all.side_effect = [[], []]
                
                await knowledge_graph.build_graph(mock_session, as_of=as_of_time)
                
                # Should have called queries with time filters
                assert mock_session.execute.call_count == 2

        @pytest.mark.asyncio
        async def test_build_graph_clears_existing(self, knowledge_graph, mock_session, sample_entities):
            """Test that building graph clears existing data"""
            # Add some initial data
            knowledge_graph.graph.add_node("old_node")
            knowledge_graph.graph.add_edge("old_node", "old_node2")
            
            mock_session.execute.return_value.scalars.return_value.all.side_effect = [
                sample_entities,  # entities
                []  # relationships
            ]
            
            await knowledge_graph.build_graph(mock_session)
            
            # Should have cleared old data
            assert "old_node" not in knowledge_graph.graph
            assert "old_node2" not in knowledge_graph.graph
            assert knowledge_graph.graph.number_of_nodes() == len(sample_entities)

        @pytest.mark.asyncio
        async def test_build_graph_updates_refresh_time(self, knowledge_graph, mock_session):
            """Test that _last_refresh is updated"""
            initial_time = knowledge_graph._last_refresh
            assert initial_time is None
            
            mock_session.execute.return_value.scalars.return_value.all.side_effect = [[], []]
            
            await knowledge_graph.build_graph(mock_session)
            
            assert knowledge_graph._last_refresh is not None
            assert isinstance(knowledge_graph._last_refresh, datetime)

    class TestPathFinding:
        """Test path finding algorithms"""

        def test_find_paths_existing_path(self, knowledge_graph):
            """Test finding paths when path exists"""
            # Create a simple path: A -> B -> C
            knowledge_graph.graph.add_edge("A", "B")
            knowledge_graph.graph.add_edge("B", "C")
            
            paths = knowledge_graph.find_paths("A", "C", max_depth=3)
            
            assert len(paths) == 1
            assert paths[0] == ["A", "B", "C"]

        def test_find_paths_multiple_paths(self, knowledge_graph):
            """Test finding multiple paths"""
            # Create multiple paths: A -> B -> C and A -> D -> C
            knowledge_graph.graph.add_edge("A", "B")
            knowledge_graph.graph.add_edge("B", "C")
            knowledge_graph.graph.add_edge("A", "D")
            knowledge_graph.graph.add_edge("D", "C")
            
            paths = knowledge_graph.find_paths("A", "C", max_depth=3)
            
            assert len(paths) == 2
            assert ["A", "B", "C"] in paths
            assert ["A", "D", "C"] in paths

        def test_find_paths_no_path(self, knowledge_graph):
            """Test finding paths when no path exists"""
            # Create disconnected nodes
            knowledge_graph.graph.add_node("A")
            knowledge_graph.graph.add_node("B")
            
            paths = knowledge_graph.find_paths("A", "B")
            
            assert paths == []

        def test_find_paths_nonexistent_nodes(self, knowledge_graph):
            """Test finding paths with nonexistent nodes"""
            paths = knowledge_graph.find_paths("nonexistent1", "nonexistent2")
            
            assert paths == []

        def test_find_paths_with_cutoff(self, knowledge_graph):
            """Test finding paths with cutoff limit"""
            # Create multiple paths
            for i in range(5):
                knowledge_graph.graph.add_edge("A", f"B{i}")
                knowledge_graph.graph.add_edge(f"B{i}", "C")
            
            paths = knowledge_graph.find_paths("A", "C", cutoff=2)
            
            assert len(paths) == 2  # Should be limited by cutoff

        def test_find_paths_max_depth(self, knowledge_graph):
            """Test finding paths with max depth limit"""
            # Create path longer than max depth
            knowledge_graph.graph.add_edge("A", "B")
            knowledge_graph.graph.add_edge("B", "C")
            knowledge_graph.graph.add_edge("C", "D")
            knowledge_graph.graph.add_edge("D", "E")
            
            paths = knowledge_graph.find_paths("A", "E", max_depth=2)
            
            assert paths == []  # Path too long for max depth

        def test_find_shortest_path(self, knowledge_graph):
            """Test finding shortest path"""
            # Create a simple path
            knowledge_graph.graph.add_edge("A", "B")
            knowledge_graph.graph.add_edge("B", "C")
            
            path = knowledge_graph.find_shortest_path("A", "C")
            
            assert path == ["A", "B", "C"]

        def test_find_shortest_path_multiple_options(self, knowledge_graph):
            """Test finding shortest path when multiple options exist"""
            # Create short and long paths
            knowledge_graph.graph.add_edge("A", "B")
            knowledge_graph.graph.add_edge("B", "C")  # Short path: A-B-C
            
            knowledge_graph.graph.add_edge("A", "D")
            knowledge_graph.graph.add_edge("D", "E")
            knowledge_graph.graph.add_edge("E", "C")  # Long path: A-D-E-C
            
            path = knowledge_graph.find_shortest_path("A", "C")
            
            assert path == ["A", "B", "C"]  # Should choose shorter path

        def test_find_shortest_path_no_path(self, knowledge_graph):
            """Test finding shortest path when no path exists"""
            knowledge_graph.graph.add_node("A")
            knowledge_graph.graph.add_node("B")
            
            path = knowledge_graph.find_shortest_path("A", "B")
            
            assert path is None

        def test_find_shortest_path_nonexistent_nodes(self, knowledge_graph):
            """Test finding shortest path with nonexistent nodes"""
            path = knowledge_graph.find_shortest_path("nonexistent1", "nonexistent2")
            
            assert path is None

    class TestNeighborRetrieval:
        """Test neighbor retrieval functionality"""

        def test_get_neighbors_basic(self, knowledge_graph):
            """Test basic neighbor retrieval"""
            # Create star pattern: A connected to B, C, D
            knowledge_graph.graph.add_edge("A", "B")
            knowledge_graph.graph.add_edge("A", "C")
            knowledge_graph.graph.add_edge("A", "D")
            
            # Add node data
            for node in ["A", "B", "C", "D"]:
                knowledge_graph.graph.nodes[node]["name"] = node
                knowledge_graph.graph.nodes[node]["entity_type"] = "test"
            
            neighbors = knowledge_graph.get_neighbors("A", depth=1)
            
            assert "depth_1" in neighbors
            assert len(neighbors["depth_1"]) == 3
            
            neighbor_ids = [n["id"] for n in neighbors["depth_1"]]
            assert "B" in neighbor_ids
            assert "C" in neighbor_ids
            assert "D" in neighbor_ids

        def test_get_neighbors_with_depth(self, knowledge_graph):
            """Test neighbor retrieval with multiple depths"""
            # Create chain: A -> B -> C -> D
            knowledge_graph.graph.add_edge("A", "B")
            knowledge_graph.graph.add_edge("B", "C")
            knowledge_graph.graph.add_edge("C", "D")
            
            # Add node data
            for node in ["A", "B", "C", "D"]:
                knowledge_graph.graph.nodes[node]["name"] = node
                knowledge_graph.graph.nodes[node]["entity_type"] = "test"
            
            neighbors = knowledge_graph.get_neighbors("A", depth=3)
            
            assert "depth_1" in neighbors
            assert "depth_2" in neighbors
            assert "depth_3" in neighbors
            assert len(neighbors["depth_1"]) == 1  # B
            assert len(neighbors["depth_2"]) == 1  # C
            assert len(neighbors["depth_3"]) == 1  # D

        def test_get_neighbors_with_relationship_filter(self, knowledge_graph):
            """Test neighbor retrieval with relationship type filter"""
            # Add edges with different relationship types
            knowledge_graph.graph.add_edge("A", "B", key="edge1", relationship_type="works_on")
            knowledge_graph.graph.add_edge("A", "C", key="edge2", relationship_type="knows")
            knowledge_graph.graph.add_edge("A", "D", key="edge3", relationship_type="works_on")
            
            # Add node data
            for node in ["A", "B", "C", "D"]:
                knowledge_graph.graph.nodes[node]["name"] = node
                knowledge_graph.graph.nodes[node]["entity_type"] = "test"
            
            neighbors = knowledge_graph.get_neighbors(
                "A", depth=1, relationship_types=["works_on"]
            )
            
            assert len(neighbors["depth_1"]) == 2  # B and D only
            
            neighbor_ids = [n["id"] for n in neighbors["depth_1"]]
            assert "B" in neighbor_ids
            assert "D" in neighbor_ids
            assert "C" not in neighbor_ids

        def test_get_neighbors_nonexistent_node(self, knowledge_graph):
            """Test neighbor retrieval for nonexistent node"""
            neighbors = knowledge_graph.get_neighbors("nonexistent")
            
            assert neighbors == {}

        def test_get_neighbors_avoids_cycles(self, knowledge_graph):
            """Test that neighbor retrieval avoids cycles"""
            # Create cycle: A -> B -> C -> A
            knowledge_graph.graph.add_edge("A", "B")
            knowledge_graph.graph.add_edge("B", "C")
            knowledge_graph.graph.add_edge("C", "A")
            
            # Add node data
            for node in ["A", "B", "C"]:
                knowledge_graph.graph.nodes[node]["name"] = node
                knowledge_graph.graph.nodes[node]["entity_type"] = "test"
            
            neighbors = knowledge_graph.get_neighbors("A", depth=3)
            
            # Should not revisit A
            total_neighbors = sum(len(level) for level in neighbors.values())
            assert total_neighbors == 2  # B and C only

    class TestEntityContext:
        """Test entity context retrieval"""

        def test_get_entity_context_basic(self, knowledge_graph):
            """Test basic entity context retrieval"""
            # Setup entity with connections
            knowledge_graph.graph.add_node("entity1", name="Test Entity", entity_type="person", confidence=0.9)
            knowledge_graph.graph.add_node("entity2", name="Related Entity", entity_type="project", confidence=0.8)
            knowledge_graph.graph.add_edge("entity1", "entity2", key="rel1", relationship_type="works_on", confidence=0.9)
            
            context = knowledge_graph.get_entity_context("entity1", depth=1)
            
            assert "entity" in context
            assert "neighbors" in context
            assert "outgoing_relationships" in context
            assert "incoming_relationships" in context
            assert "stats" in context
            
            assert context["entity"]["name"] == "Test Entity"
            assert context["entity"]["entity_type"] == "person"
            assert len(context["outgoing_relationships"]) == 1
            assert context["outgoing_relationships"][0]["relationship_type"] == "works_on"
            assert context["outgoing_relationships"][0]["target_name"] == "Related Entity"

        def test_get_entity_context_with_incoming_edges(self, knowledge_graph):
            """Test entity context with incoming relationships"""
            knowledge_graph.graph.add_node("entity1", name="Target", entity_type="person")
            knowledge_graph.graph.add_node("entity2", name="Source", entity_type="organization")
            knowledge_graph.graph.add_edge("entity2", "entity1", key="rel1", relationship_type="employs", confidence=0.9)
            
            context = knowledge_graph.get_entity_context("entity1", depth=1)
            
            assert len(context["incoming_relationships"]) == 1
            assert context["incoming_relationships"][0]["relationship_type"] == "employs"
            assert context["incoming_relationships"][0]["source_name"] == "Source"

        def test_get_entity_context_stats(self, knowledge_graph):
            """Test entity context statistics"""
            knowledge_graph.graph.add_node("entity1", name="Test", entity_type="person")
            knowledge_graph.graph.add_node("entity2", name="Related1", entity_type="project")
            knowledge_graph.graph.add_node("entity3", name="Related2", entity_type="tool")
            
            knowledge_graph.graph.add_edge("entity1", "entity2", key="rel1")
            knowledge_graph.graph.add_edge("entity3", "entity1", key="rel2")
            
            context = knowledge_graph.get_entity_context("entity1", depth=1)
            
            stats = context["stats"]
            assert stats["out_degree"] == 1
            assert stats["in_degree"] == 1
            assert stats["total_degree"] == 2

        def test_get_entity_context_nonexistent(self, knowledge_graph):
            """Test entity context for nonexistent entity"""
            context = knowledge_graph.get_entity_context("nonexistent")
            
            assert context == {}

    class TestRelatedEntities:
        """Test related entity finding"""

        def test_find_related_entities_basic(self, knowledge_graph):
            """Test finding related entities"""
            # Create connected entities
            knowledge_graph.graph.add_node("entity1", name="Entity1", entity_type="person", confidence=0.9)
            knowledge_graph.graph.add_node("entity2", name="Entity2", entity_type="project", confidence=0.8)
            knowledge_graph.graph.add_node("entity3", name="Entity3", entity_type="tool", confidence=0.7)
            
            knowledge_graph.graph.add_edge("entity1", "entity2")
            knowledge_graph.graph.add_edge("entity2", "entity3")
            
            related = knowledge_graph.find_related_entities("entity1", max_distance=2)
            
            assert len(related) == 2  # entity2 and entity3
            
            # Check distance calculation
            entity2_info = next(r for r in related if r["id"] == "entity2")
            entity3_info = next(r for r in related if r["id"] == "entity3")
            
            assert entity2_info["distance"] == 1
            assert entity3_info["distance"] == 2

        def test_find_related_entities_with_type_filter(self, knowledge_graph):
            """Test finding related entities with type filter"""
            knowledge_graph.graph.add_node("entity1", name="Entity1", entity_type="person")
            knowledge_graph.graph.add_node("entity2", name="Entity2", entity_type="project")
            knowledge_graph.graph.add_node("entity3", name="Entity3", entity_type="tool")
            
            knowledge_graph.graph.add_edge("entity1", "entity2")
            knowledge_graph.graph.add_edge("entity1", "entity3")
            
            related = knowledge_graph.find_related_entities("entity1", entity_type="project")
            
            assert len(related) == 1
            assert related[0]["id"] == "entity2"
            assert related[0]["entity_type"] == "project"

        def test_find_related_entities_distance_limit(self, knowledge_graph):
            """Test finding related entities with distance limit"""
            # Create chain longer than max distance
            knowledge_graph.graph.add_node("entity1", name="Entity1", entity_type="person")
            knowledge_graph.graph.add_node("entity2", name="Entity2", entity_type="project")
            knowledge_graph.graph.add_node("entity3", name="Entity3", entity_type="tool")
            knowledge_graph.graph.add_node("entity4", name="Entity4", entity_type="concept")
            
            knowledge_graph.graph.add_edge("entity1", "entity2")
            knowledge_graph.graph.add_edge("entity2", "entity3")
            knowledge_graph.graph.add_edge("entity3", "entity4")
            
            related = knowledge_graph.find_related_entities("entity1", max_distance=2)
            
            # Should only find entities within distance 2
            entity_ids = [r["id"] for r in related]
            assert "entity2" in entity_ids  # distance 1
            assert "entity3" in entity_ids  # distance 2
            assert "entity4" not in entity_ids  # distance 3, too far

        def test_find_related_entities_sorting(self, knowledge_graph):
            """Test that related entities are sorted correctly"""
            knowledge_graph.graph.add_node("entity1", name="Entity1", entity_type="person")
            knowledge_graph.graph.add_node("entity2", name="Entity2", entity_type="project", confidence=0.9)
            knowledge_graph.graph.add_node("entity3", name="Entity3", entity_type="tool", confidence=0.7)
            knowledge_graph.graph.add_node("entity4", name="Entity4", entity_type="project", confidence=0.8)
            
            # entity2 and entity4 are both distance 1, but entity2 has higher confidence
            knowledge_graph.graph.add_edge("entity1", "entity2")
            knowledge_graph.graph.add_edge("entity1", "entity3")
            knowledge_graph.graph.add_edge("entity1", "entity4")
            
            related = knowledge_graph.find_related_entities("entity1", max_distance=1)
            
            # Should be sorted by distance, then by confidence (descending)
            project_entities = [r for r in related if r["entity_type"] == "project"]
            assert len(project_entities) == 2
            assert project_entities[0]["id"] == "entity2"  # Higher confidence
            assert project_entities[1]["id"] == "entity4"  # Lower confidence

        def test_find_related_entities_nonexistent(self, knowledge_graph):
            """Test finding related entities for nonexistent entity"""
            related = knowledge_graph.find_related_entities("nonexistent")
            
            assert related == []

    class TestConnectedComponents:
        """Test connected components functionality"""

        def test_get_connected_components_empty(self, knowledge_graph):
            """Test connected components on empty graph"""
            components = knowledge_graph.get_connected_components()
            
            assert components == []

        def test_get_connected_components_single_component(self, knowledge_graph):
            """Test connected components when all nodes are connected"""
            # Create a connected component
            knowledge_graph.graph.add_edge("A", "B")
            knowledge_graph.graph.add_edge("B", "C")
            knowledge_graph.graph.add_edge("C", "A")
            
            components = knowledge_graph.get_connected_components()
            
            assert len(components) == 1
            assert "A" in components[0]
            assert "B" in components[0]
            assert "C" in components[0]

        def test_get_connected_components_multiple_components(self, knowledge_graph):
            """Test connected components with multiple separate components"""
            # Component 1
            knowledge_graph.graph.add_edge("A", "B")
            knowledge_graph.graph.add_edge("B", "C")
            
            # Component 2
            knowledge_graph.graph.add_edge("X", "Y")
            knowledge_graph.graph.add_edge("Y", "Z")
            
            # Isolated node
            knowledge_graph.graph.add_node("isolated")
            
            components = knowledge_graph.get_connected_components()
            
            assert len(components) == 3
            
            # Check that components contain correct nodes
            component_sets = [set(comp) for comp in components]
            
            assert {"A", "B", "C"} in component_sets
            assert {"X", "Y", "Z"} in component_sets
            assert {"isolated"} in component_sets

    class TestCentralityAnalysis:
        """Test centrality score calculation"""

        def test_get_centrality_scores_empty(self, knowledge_graph):
            """Test centrality scores on empty graph"""
            scores = knowledge_graph.get_centrality_scores()
            
            assert scores == {}

        def test_get_centrality_scores_basic(self, knowledge_graph):
            """Test basic centrality score calculation"""
            # Create a simple graph
            knowledge_graph.graph.add_edge("A", "B")
            knowledge_graph.graph.add_edge("A", "C")
            knowledge_graph.graph.add_edge("B", "C")
            
            scores = knowledge_graph.get_centrality_scores(limit=10)
            
            assert len(scores) == 3
            assert all(0 <= score <= 1 for score in scores.values())

        def test_get_centrality_scores_with_limit(self, knowledge_graph):
            """Test centrality scores with limit"""
            # Create many nodes
            for i in range(10):
                knowledge_graph.graph.add_node(f"node{i}")
            
            # Create a hub node connected to all others
            for i in range(10):
                knowledge_graph.graph.add_edge("hub", f"node{i}")
            
            scores = knowledge_graph.get_centrality_scores(limit=3)
            
            assert len(scores) == 3
            # Hub should have highest centrality
            assert "hub" in scores

        def test_get_centrality_scores_sorting(self, knowledge_graph):
            """Test that centrality scores are sorted correctly"""
            # Create a star pattern with hub
            for i in range(5):
                knowledge_graph.graph.add_edge("hub", f"node{i}")
            
            scores = knowledge_graph.get_centrality_scores(limit=5)
            
            # Convert to list to check order
            score_items = list(scores.items())
            
            # Hub should be first (highest centrality)
            assert score_items[0][0] == "hub"

    class TestVisualization:
        """Test graph visualization functionality"""

        def test_visualize_mermaid_empty(self, knowledge_graph):
            """Test Mermaid visualization of empty graph"""
            mermaid = knowledge_graph.visualize_mermaid()
            
            assert mermaid.startswith("graph TD")
            assert "graph TD" in mermaid

        def test_visualize_mermaid_with_entities(self, knowledge_graph):
            """Test Mermaid visualization with entities"""
            # Add nodes with different types
            knowledge_graph.graph.add_node("person1", name="John", entity_type="person")
            knowledge_graph.graph.add_node("file1", name="main.py", entity_type="file")
            knowledge_graph.graph.add_node("concept1", name="API", entity_type="concept")
            knowledge_graph.graph.add_node("tool1", name="Server", entity_type="tool")
            
            mermaid = knowledge_graph.visualize_mermaid()
            
            # Check different node shapes for different types
            assert 'person1(["John"])' in mermaid  # Person: rounded rectangle
            assert 'file1[/"main.py"\\]' in mermaid  # File: folder shape
            assert 'concept1{"API"}' in mermaid  # Concept: rhombus
            assert 'tool1["Server"]' in mermaid  # Default: rectangle

        def test_visualize_mermaid_with_edges(self, knowledge_graph):
            """Test Mermaid visualization with edges"""
            knowledge_graph.graph.add_node("A", name="Entity A", entity_type="person")
            knowledge_graph.graph.add_node("B", name="Entity B", entity_type="project")
            knowledge_graph.graph.add_edge("A", "B", relationship_type="works_on")
            
            mermaid = knowledge_graph.visualize_mermaid()
            
            assert 'A -->|works_on| B' in mermaid

        def test_visualize_mermaid_with_specific_entities(self, knowledge_graph):
            """Test Mermaid visualization with specific entity subset"""
            # Add many nodes
            for i in range(5):
                knowledge_graph.graph.add_node(f"node{i}", name=f"Node {i}", entity_type="concept")
            
            # Visualize only subset
            entity_ids = ["node1", "node3"]
            mermaid = knowledge_graph.visualize_mermaid(entity_ids=entity_ids)
            
            assert 'node1["Node 1"]' in mermaid
            assert 'node3["Node 3"]' in mermaid
            assert 'node0["Node 0"]' not in mermaid
            assert 'node2["Node 2"]' not in mermaid
            assert 'node4["Node 4"]' not in mermaid

        def test_visualize_mermaid_with_max_nodes(self, knowledge_graph):
            """Test Mermaid visualization with node limit"""
            # Add many nodes
            for i in range(10):
                knowledge_graph.graph.add_node(f"node{i}", name=f"Node {i}", entity_type="concept")
            
            mermaid = knowledge_graph.visualize_mermaid(max_nodes=5)
            
            # Should only include first 5 nodes
            node_count = mermaid.count('node')
            assert node_count <= 5

        def test_visualize_mermaid_sanitization(self, knowledge_graph):
            """Test that special characters are sanitized in Mermaid output"""
            knowledge_graph.graph.add_node("test-id", name='Test "Entity"', entity_type="person")
            knowledge_graph.graph.add_node("target-id", name="Target Entity", entity_type="project")
            knowledge_graph.graph.add_edge("test-id", "target-id", relationship_type="relates_to")
            
            mermaid = knowledge_graph.visualize_mermaid()
            
            # Should sanitize IDs and names
            assert 'test_id(["Test \'Entity\'"])' in mermaid
            assert 'test_id -->|relates_to| target_id' in mermaid

    class TestGraphStatistics:
        """Test graph statistics functionality"""

        def test_get_graph_stats_empty(self, knowledge_graph):
            """Test graph statistics on empty graph"""
            stats = knowledge_graph.get_graph_stats()
            
            assert stats["num_nodes"] == 0
            assert stats["num_edges"] == 0
            assert stats["num_components"] == 0
            assert stats["last_refresh"] is None
            assert "density" not in stats
            assert "avg_degree" not in stats

        def test_get_graph_stats_basic(self, knowledge_graph):
            """Test basic graph statistics"""
            # Add some nodes and edges
            knowledge_graph.graph.add_node("A", name="Entity A", entity_type="person")
            knowledge_graph.graph.add_node("B", name="Entity B", entity_type="project")
            knowledge_graph.graph.add_edge("A", "B", relationship_type="works_on")
            
            stats = knowledge_graph.get_graph_stats()
            
            assert stats["num_nodes"] == 2
            assert stats["num_edges"] == 1
            assert stats["num_components"] == 1
            assert stats["density"] == 0.5  # 1 edge / (2*1) possible edges
            assert stats["avg_degree"] == 1.0  # (1+1)/2

        def test_get_graph_stats_entity_types(self, knowledge_graph):
            """Test entity type distribution in statistics"""
            # Add nodes with different types
            knowledge_graph.graph.add_node("person1", name="Person 1", entity_type="person")
            knowledge_graph.graph.add_node("person2", name="Person 2", entity_type="person")
            knowledge_graph.graph.add_node("project1", name="Project 1", entity_type="project")
            knowledge_graph.graph.add_node("unknown1", name="Unknown 1", entity_type="unknown")
            
            stats = knowledge_graph.get_graph_stats()
            
            assert "entity_type_distribution" in stats
            distribution = stats["entity_type_distribution"]
            assert distribution["person"] == 2
            assert distribution["project"] == 1
            assert distribution["unknown"] == 1

        def test_get_graph_stats_with_refresh_time(self, knowledge_graph):
            """Test graph statistics with refresh time"""
            # Set a refresh time
            knowledge_graph._last_refresh = datetime(2023, 1, 1, 12, 0, 0)
            
            stats = knowledge_graph.get_graph_stats()
            
            assert stats["last_refresh"] == "2023-01-01T12:00:00"

    class TestEdgeCases:
        """Test edge cases and error conditions"""

        def test_self_loops(self, knowledge_graph):
            """Test handling of self-loops"""
            knowledge_graph.graph.add_edge("A", "A", relationship_type="self_ref")
            
            # Should handle self-loops without issues
            paths = knowledge_graph.find_paths("A", "A")
            context = knowledge_graph.get_entity_context("A")
            neighbors = knowledge_graph.get_neighbors("A")
            
            assert isinstance(paths, list)
            assert isinstance(context, dict)
            assert isinstance(neighbors, dict)

        def test_multiple_edges_between_same_nodes(self, knowledge_graph):
            """Test handling of multiple edges between same nodes"""
            knowledge_graph.graph.add_edge("A", "B", key="edge1", relationship_type="works_on")
            knowledge_graph.graph.add_edge("A", "B", key="edge2", relationship_type="knows")
            
            context = knowledge_graph.get_entity_context("A")
            
            # Should handle multiple edges
            assert len(context["outgoing_relationships"]) == 2

        def test_disconnected_graph_operations(self, knowledge_graph):
            """Test operations on disconnected graph"""
            # Add disconnected components
            knowledge_graph.graph.add_edge("A", "B")
            knowledge_graph.graph.add_edge("C", "D")
            
            # Operations should work correctly
            paths_ab = knowledge_graph.find_paths("A", "B")
            paths_ac = knowledge_graph.find_paths("A", "C")
            neighbors_a = knowledge_graph.get_neighbors("A")
            components = knowledge_graph.get_connected_components()
            
            assert len(paths_ab) == 1
            assert len(paths_ac) == 0
            assert len(neighbors_a) == 1
            assert len(components) == 2

    class TestPerformance:
        """Test performance-related scenarios"""

        @pytest.mark.slow
        def test_large_graph_operations(self, knowledge_graph):
            """Test operations on large graph"""
            import time
            
            # Create a reasonably large graph
            num_nodes = 100
            for i in range(num_nodes):
                knowledge_graph.graph.add_node(f"node{i}", name=f"Node {i}", entity_type="concept")
            
            # Add some edges
            for i in range(0, num_nodes - 1, 10):
                for j in range(i + 1, min(i + 10, num_nodes)):
                    knowledge_graph.graph.add_edge(f"node{i}", f"node{j}")
            
            # Test performance of various operations
            start_time = time.time()
            
            paths = knowledge_graph.find_paths("node0", f"node{num_nodes-1}", max_depth=3)
            neighbors = knowledge_graph.get_neighbors("node0", depth=2)
            centrality = knowledge_graph.get_centrality_scores(limit=10)
            components = knowledge_graph.get_connected_components()
            
            end_time = time.time()
            processing_time = end_time - start_time
            
            # Should complete within reasonable time
            assert processing_time < 10.0  # 10 seconds
            assert isinstance(paths, list)
            assert isinstance(neighbors, dict)
            assert isinstance(centrality, dict)
            assert isinstance(components, list)

    class TestIntegration:
        """Integration tests combining multiple features"""

        def test_complex_graph_scenario(self, knowledge_graph):
            """Test complex scenario with multiple entity types and relationships"""
            # Create a realistic knowledge graph scenario
            
            # People
            knowledge_graph.graph.add_node("john", name="John Doe", entity_type="person", confidence=0.9)
            knowledge_graph.graph.add_node("jane", name="Jane Smith", entity_type="person", confidence=0.8)
            
            # Projects
            knowledge_graph.graph.add_node("project_x", name="Project X", entity_type="project", confidence=0.7)
            knowledge_graph.graph.add_node("project_y", name="Project Y", entity_type="project", confidence=0.6)
            
            # Tools/Files
            knowledge_graph.graph.add_node("api_server", name="API Server", entity_type="tool", confidence=0.8)
            knowledge_graph.graph.add_node("main_py", name="main.py", entity_type="file", confidence=0.9)
            
            # Concepts
            knowledge_graph.graph.add_node("microservices", name="Microservices", entity_type="concept", confidence=0.7)
            
            # Relationships
            knowledge_graph.graph.add_edge("john", "project_x", relationship_type="works_on", confidence=0.9)
            knowledge_graph.graph.add_edge("jane", "project_x", relationship_type="works_on", confidence=0.8)
            knowledge_graph.graph.add_edge("john", "project_y", relationship_type="leads", confidence=0.9)
            knowledge_graph.graph.add_edge("project_x", "api_server", relationship_type="uses", confidence=0.8)
            knowledge_graph.graph.add_edge("project_y", "main_py", relationship_type="contains", confidence=0.7)
            knowledge_graph.graph.add_edge("api_server", "microservices", relationship_type="implements", confidence=0.8)
            
            # Test various operations
            john_context = knowledge_graph.get_entity_context("john", depth=2)
            project_x_related = knowledge_graph.find_related_entities("project_x", max_distance=2)
            centrality_scores = knowledge_graph.get_centrality_scores(limit=5)
            mermaid_viz = knowledge_graph.visualize_mermaid(max_nodes=20)
            stats = knowledge_graph.get_graph_stats()
            
            # Verify results
            assert len(john_context["outgoing_relationships"]) == 2
            assert len(project_x_related) >= 3  # john, jane, api_server, microservices
            assert len(centrality_scores) == 5
            assert "graph TD" in mermaid_viz
            assert stats["num_nodes"] == 7
            assert stats["num_edges"] == 6
            
            # Test path finding
            john_to_main_py = knowledge_graph.find_shortest_path("john", "main_py")
            assert john_to_main_py == ["john", "project_y", "main_py"]
            
            # Test neighbor filtering
            john_neighbors_filtered = knowledge_graph.get_neighbors(
                "john", depth=1, relationship_types=["works_on"]
            )
            assert len(john_neighbors_filtered["depth_1"]) == 1  # Only project_x