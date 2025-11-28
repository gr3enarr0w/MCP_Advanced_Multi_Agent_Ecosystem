"""
Knowledge Graph for Phase 6 - Context Persistence

Manages entity relationships using NetworkX:
- Graph construction from entities and relationships
- Path finding algorithms
- Entity context retrieval
- Graph visualization (Mermaid format)
- Bi-temporal queries
"""

from datetime import datetime
from typing import List, Dict, Any, Optional, Tuple, Set
import networkx as nx
from sqlalchemy.ext.asyncio import AsyncSession
import sqlalchemy as sa
from .models_enhanced import Entity, Relationship


class KnowledgeGraph:
    """
    Manages a knowledge graph of entities and relationships.
    Uses NetworkX for graph algorithms and traversal.
    """

    def __init__(self):
        """Initialize an empty knowledge graph"""
        self.graph = nx.MultiDiGraph()  # Directed multigraph (multiple edges allowed)
        self._last_refresh = None

    async def build_graph(self, session: AsyncSession, as_of: Optional[datetime] = None) -> int:
        """
        Build graph from database entities and relationships.

        Args:
            session: Database session
            as_of: Point in time to build graph (None = current time)

        Returns:
            Number of nodes added
        """
        if as_of is None:
            as_of = datetime.utcnow()

        # Clear existing graph
        self.graph.clear()

        # Get valid entities at this time
        entities_query = sa.select(Entity).where(
            Entity.valid_from <= as_of,
            sa.or_(
                Entity.valid_until.is_(None),
                Entity.valid_until > as_of
            )
        )
        result = await session.execute(entities_query)
        entities = result.scalars().all()

        # Add entities as nodes
        for entity in entities:
            self.graph.add_node(
                entity.id,
                name=entity.name,
                entity_type=entity.entity_type,
                description=entity.description,
                confidence=entity.confidence,
                meta_data=entity.meta_data,
                conversation_id=entity.conversation_id,
                message_id=entity.message_id
            )

        # Get valid relationships
        rels_query = sa.select(Relationship).where(
            Relationship.valid_from <= as_of,
            sa.or_(
                Relationship.valid_until.is_(None),
                Relationship.valid_until > as_of
            )
        )
        result = await session.execute(rels_query)
        relationships = result.scalars().all()

        # Add relationships as edges
        for rel in relationships:
            self.graph.add_edge(
                rel.source_entity_id,
                rel.target_entity_id,
                key=rel.id,
                relationship_type=rel.relationship_type,
                confidence=rel.confidence,
                properties=rel.properties,
                conversation_id=rel.conversation_id,
                message_id=rel.message_id
            )

        self._last_refresh = datetime.utcnow()
        return self.graph.number_of_nodes()

    def find_paths(
        self,
        source_id: str,
        target_id: str,
        max_depth: int = 3,
        cutoff: Optional[int] = None
    ) -> List[List[str]]:
        """
        Find all paths between two entities.

        Args:
            source_id: Source entity ID
            target_id: Target entity ID
            max_depth: Maximum path length
            cutoff: Maximum number of paths to return

        Returns:
            List of paths (each path is a list of entity IDs)
        """
        if source_id not in self.graph or target_id not in self.graph:
            return []

        try:
            paths = list(nx.all_simple_paths(
                self.graph,
                source_id,
                target_id,
                cutoff=max_depth
            ))
            if cutoff:
                paths = paths[:cutoff]
            return paths
        except nx.NetworkXNoPath:
            return []

    def find_shortest_path(self, source_id: str, target_id: str) -> Optional[List[str]]:
        """
        Find shortest path between two entities.

        Args:
            source_id: Source entity ID
            target_id: Target entity ID

        Returns:
            Shortest path as list of entity IDs, or None if no path exists
        """
        if source_id not in self.graph or target_id not in self.graph:
            return None

        try:
            return nx.shortest_path(self.graph, source_id, target_id)
        except nx.NetworkXNoPath:
            return None

    def get_neighbors(
        self,
        entity_id: str,
        depth: int = 1,
        relationship_types: Optional[List[str]] = None
    ) -> Dict[str, Any]:
        """
        Get neighboring entities within specified depth.

        Args:
            entity_id: Entity to start from
            depth: How many hops to traverse
            relationship_types: Filter by relationship types

        Returns:
            Dictionary with neighbors organized by depth level
        """
        if entity_id not in self.graph:
            return {}

        neighbors_by_level = {}

        # BFS to get neighbors at each level
        current_level = {entity_id}
        visited = {entity_id}

        for level in range(1, depth + 1):
            next_level = set()
            for node in current_level:
                for neighbor in self.graph.neighbors(node):
                    if neighbor not in visited:
                        # Check relationship type filter
                        if relationship_types:
                            edges = self.graph.get_edge_data(node, neighbor)
                            if not any(
                                edge_data.get('relationship_type') in relationship_types
                                for edge_data in edges.values()
                            ):
                                continue

                        next_level.add(neighbor)
                        visited.add(neighbor)

            if next_level:
                neighbors_by_level[f"depth_{level}"] = [
                    {
                        "id": nid,
                        **self.graph.nodes[nid]
                    }
                    for nid in next_level
                ]

            current_level = next_level

        return neighbors_by_level

    def get_entity_context(self, entity_id: str, depth: int = 2) -> Dict[str, Any]:
        """
        Get full context around an entity including neighbors and relationships.

        Args:
            entity_id: Entity to get context for
            depth: Depth to traverse

        Returns:
            Dictionary with entity info, neighbors, and relationships
        """
        if entity_id not in self.graph:
            return {}

        # Get entity info
        entity_info = dict(self.graph.nodes[entity_id])

        # Get neighbors
        neighbors = self.get_neighbors(entity_id, depth)

        # Get outgoing relationships
        out_edges = []
        for target in self.graph.successors(entity_id):
            for key, edge_data in self.graph.get_edge_data(entity_id, target).items():
                out_edges.append({
                    "target_id": target,
                    "target_name": self.graph.nodes[target]["name"],
                    "relationship_type": edge_data.get("relationship_type"),
                    "confidence": edge_data.get("confidence"),
                    "properties": edge_data.get("properties", {})
                })

        # Get incoming relationships
        in_edges = []
        for source in self.graph.predecessors(entity_id):
            for key, edge_data in self.graph.get_edge_data(source, entity_id).items():
                in_edges.append({
                    "source_id": source,
                    "source_name": self.graph.nodes[source]["name"],
                    "relationship_type": edge_data.get("relationship_type"),
                    "confidence": edge_data.get("confidence"),
                    "properties": edge_data.get("properties", {})
                })

        return {
            "entity": entity_info,
            "neighbors": neighbors,
            "outgoing_relationships": out_edges,
            "incoming_relationships": in_edges,
            "stats": {
                "out_degree": self.graph.out_degree(entity_id),
                "in_degree": self.graph.in_degree(entity_id),
                "total_degree": self.graph.degree(entity_id)
            }
        }

    def find_related_entities(
        self,
        entity_id: str,
        entity_type: Optional[str] = None,
        max_distance: int = 2
    ) -> List[Dict[str, Any]]:
        """
        Find entities related to a given entity.

        Args:
            entity_id: Starting entity
            entity_type: Filter by entity type
            max_distance: Maximum graph distance

        Returns:
            List of related entities with distance scores
        """
        if entity_id not in self.graph:
            return []

        # Use shortest path lengths
        try:
            distances = nx.single_source_shortest_path_length(
                self.graph.to_undirected(),
                entity_id,
                cutoff=max_distance
            )
        except nx.NetworkXError:
            return []

        related = []
        for target_id, distance in distances.items():
            if target_id == entity_id:
                continue

            node_data = self.graph.nodes[target_id]

            # Apply entity type filter
            if entity_type and node_data.get("entity_type") != entity_type:
                continue

            related.append({
                "id": target_id,
                "name": node_data.get("name"),
                "entity_type": node_data.get("entity_type"),
                "distance": distance,
                "confidence": node_data.get("confidence", 0.0)
            })

        # Sort by distance, then confidence
        related.sort(key=lambda x: (x["distance"], -x["confidence"]))

        return related

    def get_connected_components(self) -> List[Set[str]]:
        """
        Get weakly connected components in the graph.

        Returns:
            List of sets, each containing entity IDs in a component
        """
        return list(nx.weakly_connected_components(self.graph))

    def get_centrality_scores(self, limit: int = 10) -> Dict[str, float]:
        """
        Get centrality scores to find most important entities.

        Args:
            limit: Number of top entities to return

        Returns:
            Dictionary mapping entity IDs to centrality scores
        """
        if self.graph.number_of_nodes() == 0:
            return {}

        # Use PageRank for centrality
        scores = nx.pagerank(self.graph)

        # Sort and limit
        sorted_scores = sorted(
            scores.items(),
            key=lambda x: x[1],
            reverse=True
        )[:limit]

        return dict(sorted_scores)

    def visualize_mermaid(
        self,
        entity_ids: Optional[List[str]] = None,
        max_nodes: int = 50
    ) -> str:
        """
        Generate Mermaid diagram for graph visualization.

        Args:
            entity_ids: Specific entities to include (None = all)
            max_nodes: Maximum nodes to include

        Returns:
            Mermaid diagram as string
        """
        if entity_ids:
            # Create subgraph with specified entities
            subgraph = self.graph.subgraph(entity_ids)
        else:
            # Use full graph but limit size
            nodes = list(self.graph.nodes())[:max_nodes]
            subgraph = self.graph.subgraph(nodes)

        lines = ["graph TD"]

        # Add nodes
        for node_id in subgraph.nodes():
            node_data = subgraph.nodes[node_id]
            name = node_data.get("name", node_id)
            entity_type = node_data.get("entity_type", "unknown")

            # Sanitize for Mermaid
            safe_id = node_id.replace("-", "_")
            safe_name = name.replace('"', "'")

            # Different shapes for different entity types
            if entity_type == "person":
                lines.append(f'    {safe_id}(["{safe_name}"])')
            elif entity_type in ("file", "code"):
                lines.append(f'    {safe_id}[/"{safe_name}"\\]')
            elif entity_type == "concept":
                lines.append(f'    {safe_id}{"{" + safe_name + "}"}')
            else:
                lines.append(f'    {safe_id}["{safe_name}"]')

        # Add edges
        for source, target, data in subgraph.edges(data=True):
            safe_source = source.replace("-", "_")
            safe_target = target.replace("-", "_")
            rel_type = data.get("relationship_type", "related")

            lines.append(f'    {safe_source} -->|{rel_type}| {safe_target}')

        return "\n".join(lines)

    def get_graph_stats(self) -> Dict[str, Any]:
        """
        Get statistics about the knowledge graph.

        Returns:
            Dictionary with graph statistics
        """
        stats = {
            "num_nodes": self.graph.number_of_nodes(),
            "num_edges": self.graph.number_of_edges(),
            "num_components": nx.number_weakly_connected_components(self.graph),
            "last_refresh": self._last_refresh.isoformat() if self._last_refresh else None
        }

        if stats["num_nodes"] > 0:
            stats["density"] = nx.density(self.graph)
            stats["avg_degree"] = sum(dict(self.graph.degree()).values()) / stats["num_nodes"]

            # Entity type distribution
            entity_types = {}
            for node_id in self.graph.nodes():
                entity_type = self.graph.nodes[node_id].get("entity_type", "unknown")
                entity_types[entity_type] = entity_types.get(entity_type, 0) + 1
            stats["entity_type_distribution"] = entity_types

        return stats
