# Python SDK for Context-Persistence

## Overview

The Context-Persistence Python SDK provides a comprehensive interface for managing conversations, entities, knowledge graphs, and hybrid search functionality. This SDK is designed for Python 3.12+ and integrates with spaCy for NLP, Qdrant for vector storage, and NetworkX for knowledge graph operations.

## Installation

### Prerequisites

- Python 3.12 or higher
- pip package manager
- Virtual environment (recommended)

### Install from Source

```bash
# Clone the repository
git clone https://github.com/your-org/mcp-advanced-multi-agent-ecosystem.git
cd mcp-advanced-multi-agent-ecosystem/src/mcp-servers/context-persistence

# Create virtual environment
python3.12 -m venv venv
source venv/bin/activate  # On Windows: venv\Scripts\activate

# Install dependencies
pip install -e .

# Install development dependencies (optional)
pip install -e ".[dev]"
```

### Install from PyPI (when available)

```bash
pip install mcp-context-persistence
```

### Dependencies

The SDK automatically installs these core dependencies:

- **Core**: `pydantic>=2.0`, `fastapi>=0.104`, `uvicorn>=0.24`
- **NLP**: `spacy>=3.7`, `nltk>=3.8`
- **Vector Storage**: `qdrant-client>=1.7`, `sentence-transformers>=2.2`
- **Graph**: `networkx>=3.2`, `numpy>=1.24`
- **Database**: `sqlite3` (built-in), `sqlalchemy>=2.0`
- **Utilities**: `python-dotenv>=1.0`, `click>=8.1`, `rich>=13.7`

## Quick Start

### Basic Usage

```python
from mcp_context_persistence import ContextPersistenceClient
from mcp_context_persistence.models import Conversation, Entity, Relationship

# Initialize client
client = ContextPersistenceClient(
    database_url="sqlite:///context.db",
    vector_db_url="localhost:6333",
    spacy_model="en_core_web_sm"
)

# Save a conversation
conversation = Conversation(
    conversation_id="conv-123",
    messages=[
        {"role": "user", "content": "Analyze this Python code"},
        {"role": "assistant", "content": "I'll analyze the code structure..."}
    ],
    metadata={"project": "code-analysis", "user_id": "user-456"}
)

result = client.save_conversation(conversation)
print(f"Saved conversation with {result.message_count} messages")

# Extract entities
entities = client.extract_entities(
    text="The DataProcessor class handles data transformation and cleanup.",
    conversation_id="conv-123"
)

for entity in entities.entities:
    print(f"Found {entity.type}: {entity.name} (confidence: {entity.confidence})")

# Create relationships
client.create_relationship(
    source_entity_id="DataProcessor",
    target_entity_id="data_transformation",
    relationship_type="implements",
    confidence=0.9
)

# Search conversations
similar = client.search_similar_conversations(
    query="Python code analysis",
    limit=5
)

print(f"Found {similar.total_results} similar conversations")
```

### Advanced Usage

```python
from mcp_context_persistence import ContextPersistenceClient
from mcp_context_persistence.models import SearchFilters, HybridSearchParams

# Initialize with custom configuration
client = ContextPersistenceClient(
    database_url="postgresql://user:pass@localhost/context_db",
    vector_db_url="http://localhost:6333",
    spacy_model="en_core_web_md",
    config={
        "vector_size": 384,
        "max_conversation_length": 10000,
        "entity_extraction_threshold": 0.7
    }
)

# Hybrid search with filters
search_params = HybridSearchParams(
    query="machine learning algorithms",
    mode="hybrid",
    filters={
        "conversation_id": ["conv-123", "conv-456"],
        "date_range": {"start": "2024-01-01", "end": "2024-12-31"},
        "entity_types": ["technology", "concept"]
    },
    limit=10,
    include_metadata=True
)

results = client.search_hybrid(search_params)

for result in results.results:
    print(f"{result.type}: {result.content[:100]}...")
    print(f"Similarity: {result.similarity_score}")
```

## API Reference

### Core Classes

#### `ContextPersistenceClient`

The main client class for interacting with the Context-Persistence system.

```python
class ContextPersistenceClient:
    def __init__(
        self,
        database_url: str = "sqlite:///context.db",
        vector_db_url: str = "localhost:6333",
        spacy_model: str = "en_core_web_sm",
        config: Optional[Dict[str, Any]] = None
    ):
        """Initialize the Context-Persistence client.
        
        Args:
            database_url: Database connection URL
            vector_db_url: Qdrant vector database URL
            spacy_model: spaCy model name for NLP processing
            config: Additional configuration options
        """
```

#### Methods

##### Conversation Management

###### `save_conversation`

```python
def save_conversation(
    self,
    conversation_id: str,
    messages: List[Dict[str, Any]],
    project_path: Optional[str] = None,
    mode: Optional[str] = None,
    metadata: Optional[Dict[str, Any]] = None
) -> SaveConversationResponse:
    """Save a conversation with messages and generate embeddings.
    
    Args:
        conversation_id: Unique conversation identifier
        messages: List of message dictionaries with role, content, and optional timestamp
        project_path: Optional project path for context
        mode: Storage mode ('conversation', 'knowledge', 'hybrid')
        metadata: Additional metadata for the conversation
        
    Returns:
        SaveConversationResponse with success status and metadata
        
    Raises:
        ValueError: If conversation_id is empty or messages is empty
        DatabaseError: If database operation fails
        VectorDBError: If vector operation fails
    """
```

**Example:**

```python
response = client.save_conversation(
    conversation_id="project-discussion-001",
    messages=[
        {"role": "user", "content": "What's the best approach for data validation?"},
        {"role": "assistant", "content": "For data validation, I recommend..."},
        {"role": "user", "content": "How about performance considerations?"}
    ],
    project_path="/projects/data-pipeline",
    mode="hybrid",
    metadata={
        "project": "data-pipeline",
        "topic": "data-validation",
        "priority": "high"
    }
)

if response.success:
    print(f"Saved {response.message_count} messages")
else:
    print(f"Failed to save: {response.error}")
```

###### `load_conversation_history`

```python
def load_conversation_history(
    self,
    conversation_id: str,
    limit: Optional[int] = None
) -> LoadConversationHistoryResponse:
    """Load conversation history from storage.
    
    Args:
        conversation_id: Conversation identifier to load
        limit: Maximum number of messages to return
        
    Returns:
        LoadConversationHistoryResponse with conversation data
        
    Raises:
        NotFoundError: If conversation doesn't exist
        DatabaseError: If database operation fails
    """
```

**Example:**

```python
history = client.load_conversation_history(
    conversation_id="project-discussion-001",
    limit=50
)

if history.success:
    print(f"Loaded {history.message_count} of {history.total_messages} messages")
    for message in history.messages[-5:]:  # Last 5 messages
        print(f"{message.role}: {message.content[:100]}...")
```

##### Entity Operations

###### `extract_entities`

```python
def extract_entities(
    self,
    text: str,
    conversation_id: Optional[str] = None,
    message_id: Optional[str] = None,
    entity_types: Optional[List[str]] = None,
    context: Optional[Dict[str, Any]] = None
) -> ExtractEntitiesResponse:
    """Extract entities from text using NLP.
    
    Args:
        text: Text to extract entities from
        conversation_id: Optional conversation identifier for context
        message_id: Optional specific message identifier
        entity_types: Optional list of entity types to extract
        context: Additional context for entity extraction
        
    Returns:
        ExtractEntitiesResponse with extracted entities
        
    Raises:
        NLPError: If NLP processing fails
        ValueError: If text is empty
    """
```

**Example:**

```python
text = """
The DataProcessor class in the data_processing module handles 
data transformation and cleanup operations. It uses pandas 
for data manipulation and numpy for numerical operations.
"""

entities = client.extract_entities(
    text=text,
    conversation_id="tech-discussion-001",
    entity_types=["class", "module", "library"],
    context={"domain": "data-engineering"}
)

if entities.success:
    for entity in entities.entities:
        print(f"{entity.type}: {entity.name}")
        print(f"  Description: {entity.description}")
        print(f"  Confidence: {entity.confidence}")
        print()
```

###### `create_relationship`

```python
def create_relationship(
    self,
    source_entity_id: str,
    target_entity_id: str,
    relationship_type: str,
    confidence: float = 1.0,
    properties: Optional[Dict[str, Any]] = None
) -> CreateRelationshipResponse:
    """Create a relationship between two entities in the knowledge graph.
    
    Args:
        source_entity_id: ID of source entity
        target_entity_id: ID of target entity
        relationship_type: Type of relationship
        confidence: Confidence score for the relationship (0.0-1.0)
        properties: Additional properties for the relationship
        
    Returns:
        CreateRelationshipResponse with relationship data
        
    Raises:
        NotFoundError: If entities don't exist
        GraphError: If graph operation fails
        ValueError: If confidence is not in valid range
    """
```

**Example:**

```python
# Create multiple relationships
relationships = [
    ("DataProcessor", "pandas", "uses", 0.9),
    ("DataProcessor", "numpy", "uses", 0.8),
    ("pandas", "data_manipulation", "provides", 0.95),
    ("numpy", "numerical_operations", "provides", 0.95)
]

for source, target, rel_type, conf in relationships:
    result = client.create_relationship(
        source_entity_id=source,
        target_entity_id=target,
        relationship_type=rel_type,
        confidence=conf,
        properties={"created_by": "entity_extraction", "timestamp": "2024-01-15"}
    )
    
    if result.success:
        print(f"Created relationship: {source} -> {rel_type} -> {target}")
```

##### Knowledge Graph Operations

###### `query_knowledge_graph`

```python
def query_knowledge_graph(
    self,
    entity_id: str,
    depth: int = 2,
    operation: str = "context"
) -> QueryKnowledgeGraphResponse:
    """Query the knowledge graph for entity information.
    
    Args:
        entity_id: Entity ID to query
        depth: Depth of graph traversal (default: 2)
        operation: Operation type ('context', 'neighbors', 'paths')
        
    Returns:
        QueryKnowledgeGraphResponse with graph data
        
    Raises:
        NotFoundError: If entity doesn't exist
        GraphError: If graph operation fails
        ValueError: If operation is not valid
    """
```

**Example:**

```python
# Get context around DataProcessor entity
context = client.query_knowledge_graph(
    entity_id="DataProcessor",
    depth=3,
    operation="context"
)

if context.success:
    print(f"Found {len(context.context)} related entities")
    
    # Display neighbors
    for neighbor in context.context.neighbors:
        print(f"  {neighbor.entity_id} ({neighbor.relationship_type})")
    
    # Display paths
    for path in context.context.paths:
        print(f"Path: {path.from_entity} -> {path.relationship_type} -> {path.to_entity}")
```

###### `update_knowledge_graph`

```python
def update_knowledge_graph(
    self,
    entities: List[Dict[str, Any]],
    relationships: List[Dict[str, Any]],
    merge_strategy: str = "upsert"
) -> UpdateKnowledgeGraphResponse:
    """Update the knowledge graph with entities and relationships.
    
    Args:
        entities: List of entity dictionaries
        relationships: List of relationship dictionaries
        merge_strategy: Strategy for handling conflicts ('upsert', 'merge', 'skip')
        
    Returns:
        UpdateKnowledgeGraphResponse with update statistics
        
    Raises:
        GraphError: If graph operation fails
        ValidationError: If data is invalid
    """
```

**Example:**

```python
entities = [
    {
        "id": "DataValidator",
        "type": "class",
        "name": "DataValidator",
        "description": "Validates data according to business rules",
        "metadata": {"module": "validation", "language": "python"}
    },
    {
        "id": "business_rules",
        "type": "concept",
        "name": "Business Rules",
        "description": "Rules for data validation and processing",
        "metadata": {"category": "concept"}
    }
]

relationships = [
    {
        "from_entity": "DataValidator",
        "to_entity": "business_rules",
        "relationship_type": "implements",
        "confidence": 0.9,
        "properties": {"validation_type": "business"}
    }
]

result = client.update_knowledge_graph(
    entities=entities,
    relationships=relationships,
    merge_strategy="upsert"
)

if result.success:
    print(f"Updated {result.updated_entities} entities and {result.updated_relationships} relationships")
```

##### Search Operations

###### `search_similar_conversations`

```python
def search_similar_conversations(
    self,
    query: str,
    limit: int = 5,
    min_score: float = 0.7,
    filters: Optional[Dict[str, Any]] = None
) -> SearchSimilarConversationsResponse:
    """Search for similar conversations using semantic search.
    
    Args:
        query: Search query text
        limit: Maximum number of results to return
        min_score: Minimum similarity score (0.0-1.0)
        filters: Optional filters for search results
        
    Returns:
        SearchSimilarConversationsResponse with similar conversations
        
    Raises:
        SearchError: If search operation fails
        ValueError: If query is empty or parameters are invalid
    """
```

**Example:**

```python
# Search for conversations about data validation
results = client.search_similar_conversations(
    query="data validation techniques and best practices",
    limit=10,
    min_score=0.6,
    filters={
        "date_range": {"start": "2024-01-01", "end": "2024-12-31"},
        "project": ["data-pipeline", "validation-system"],
        "tags": ["validation", "data-quality"]
    }
)

if results.success:
    print(f"Found {results.total_results} similar conversations")
    
    for result in results.results:
        print(f"\nConversation: {result.conversation_id}")
        print(f"Similarity: {result.similarity_score:.3f}")
        
        # Show preview of messages
        for msg in result.messages[:2]:
            print(f"  {msg.role}: {msg.content[:80]}...")
```

###### `search_hybrid`

```python
def search_hybrid(
    self,
    query: str,
    mode: str = "hybrid",
    filters: Optional[Dict[str, Any]] = None,
    limit: int = 10,
    include_metadata: bool = False
) -> SearchHybridResponse:
    """Perform hybrid search combining semantic and keyword search.
    
    Args:
        query: Search query
        mode: Search mode ('hybrid', 'semantic', 'keyword', 'graph')
        filters: Optional filters for search results
        limit: Maximum number of results to return
        include_metadata: Whether to include metadata in results
        
    Returns:
        SearchHybridResponse with search results
        
    Raises:
        SearchError: If search operation fails
        ValueError: If parameters are invalid
    """
```

**Example:**

```python
# Hybrid search across all data types
results = client.search_hybrid(
    query="machine learning model deployment",
    mode="hybrid",
    filters={
        "content_types": ["conversation", "entity", "document"],
        "date_range": {"start": "2024-06-01"},
        "confidence_min": 0.5
    },
    limit=15,
    include_metadata=True
)

if results.success:
    print(f"Found {results.total_results} results")
    
    for result in results.results:
        print(f"\n{result.type.upper()}: {result.similarity_score:.3f}")
        print(f"Content: {result.content[:150]}...")
        
        if include_metadata and result.metadata:
            print(f"Metadata: {result.metadata}")
```

##### Decision Management

###### `save_decision`

```python
def save_decision(
    self,
    conversation_id: str,
    decision_type: str,
    context: str,
    outcome: str,
    confidence: Optional[float] = None
) -> SaveDecisionResponse:
    """Save an important decision from the conversation.
    
    Args:
        conversation_id: Conversation identifier
        decision_type: Type of decision (e.g., "architecture", "implementation")
        context: Context leading to the decision
        outcome: Decision outcome or result
        confidence: Optional confidence score (0.0-1.0)
        
    Returns:
        SaveDecisionResponse with decision data
        
    Raises:
        DatabaseError: If database operation fails
        ValidationError: If data is invalid
    """
```

**Example:**

```python
decisions = [
    {
        "conversation_id": "architecture-discussion-001",
        "decision_type": "architecture",
        "context": "Team discussed microservices vs monolithic approach for the new payment system",
        "outcome": "Decided to use microservices architecture with API Gateway for better scalability",
        "confidence": 0.85
    },
    {
        "conversation_id": "tech-stack-discussion-002",
        "decision_type": "technology",
        "context": "Evaluation of database options for the analytics platform",
        "outcome": "Chose PostgreSQL with TimescaleDB for time-series data and Redis for caching",
        "confidence": 0.9
    }
]

for decision_data in decisions:
    result = client.save_decision(**decision_data)
    
    if result.success:
        print(f"Saved {decision_data['decision_type']} decision")
    else:
        print(f"Failed to save decision: {result.error}")
```

##### Statistics and Monitoring

###### `get_conversation_stats`

```python
def get_conversation_stats(self) -> GetConversationStatsResponse:
    """Get comprehensive statistics about stored conversations.
    
    Returns:
        GetConversationStatsResponse with system statistics
        
    Raises:
        DatabaseError: If database operation fails
    """
```

**Example:**

```python
stats = client.get_conversation_stats()

if stats.success:
    print("Context-Persistence Statistics:")
    print(f"  Total conversations: {stats.stats.total_conversations}")
    print(f"  Total messages: {stats.stats.total_messages}")
    print(f"  Total entities: {stats.stats.total_entities}")
    print(f"  Total relationships: {stats.stats.total_relationships}")
    
    storage = stats.stats.storage_usage
    print(f"  Storage usage:")
    print(f"    Conversations: {storage.conversations_size:,} bytes")
    print(f"    Entities: {storage.entities_count:,}")
    print(f"    Relationships: {storage.relationships_count:,}")
```

### Data Models

#### `Conversation`

```python
from pydantic import BaseModel, Field
from typing import List, Dict, Any, Optional
from datetime import datetime

class Message(BaseModel):
    role: str = Field(..., description="Message role (user, assistant, system)")
    content: str = Field(..., description="Message content")
    timestamp: Optional[datetime] = Field(None, description="Message timestamp")
    metadata: Optional[Dict[str, Any]] = Field(None, description="Additional metadata")

class Conversation(BaseModel):
    conversation_id: str = Field(..., description="Unique conversation identifier")
    messages: List[Message] = Field(..., description="List of messages in the conversation")
    project_path: Optional[str] = Field(None, description="Optional project path for context")
    mode: Optional[str] = Field("conversation", description="Storage mode")
    metadata: Optional[Dict[str, Any]] = Field(None, description="Additional metadata")
    created_at: Optional[datetime] = Field(None, description="Creation timestamp")
    updated_at: Optional[datetime] = Field(None, description="Last update timestamp")
```

#### `Entity`

```python
class Entity(BaseModel):
    id: str = Field(..., description="Unique entity identifier")
    type: str = Field(..., description="Entity type (class, function, concept, etc.)")
    name: str = Field(..., description="Entity name")
    description: str = Field(..., description="Entity description")
    confidence: float = Field(..., ge=0.0, le=1.0, description="Confidence score")
    metadata: Optional[Dict[str, Any]] = Field(None, description="Additional metadata")
    conversation_id: Optional[str] = Field(None, description="Related conversation ID")
    message_id: Optional[str] = Field(None, description="Related message ID")
    created_at: Optional[datetime] = Field(None, description="Creation timestamp")
```

#### `Relationship`

```python
class Relationship(BaseModel):
    id: str = Field(..., description="Unique relationship identifier")
    source_entity_id: str = Field(..., description="Source entity ID")
    target_entity_id: str = Field(..., description="Target entity ID")
    relationship_type: str = Field(..., description="Type of relationship")
    confidence: float = Field(default=1.0, ge=0.0, le=1.0, description="Confidence score")
    properties: Optional[Dict[str, Any]] = Field(None, description="Additional properties")
    created_at: Optional[datetime] = Field(None, description="Creation timestamp")
```

### Response Models

#### `SaveConversationResponse`

```python
class SaveConversationResponse(BaseModel):
    success: bool = Field(..., description="Operation success status")
    conversation_id: str = Field(..., description="Conversation identifier")
    message_count: int = Field(..., description="Number of messages saved")
    status: str = Field(..., description="Status message")
    error: Optional[str] = Field(None, description="Error message if failed")
    embeddings_generated: int = Field(..., description="Number of embeddings generated")
    processing_time: float = Field(..., description="Processing time in seconds")
```

#### `ExtractEntitiesResponse`

```python
class ExtractEntitiesResponse(BaseModel):
    success: bool = Field(..., description="Operation success status")
    entities: List[Entity] = Field(..., description="Extracted entities")
    conversation_id: Optional[str] = Field(None, description="Conversation ID")
    message_id: Optional[str] = Field(None, description="Message ID")
    total_entities: int = Field(..., description="Total number of entities")
    processing_time: float = Field(..., description="Processing time in seconds")
    error: Optional[str] = Field(None, description="Error message if failed")
```

## Configuration

### Environment Variables

```bash
# Database Configuration
CONTEXT_DB_URL=sqlite:///context.db
CONTEXT_DB_POOL_SIZE=10
CONTEXT_DB_MAX_OVERFLOW=20

# Vector Database Configuration
VECTOR_DB_URL=localhost:6333
VECTOR_DB_API_KEY=your-api-key
VECTOR_COLLECTION_NAME=context_vectors
VECTOR_SIZE=384

# NLP Configuration
SPACY_MODEL=en_core_web_sm
ENTITY_EXTRACTION_THRESHOLD=0.7
SENTENCE_TRANSFORMER_MODEL=all-MiniLM-L6-v2

# Search Configuration
DEFAULT_SEARCH_LIMIT=10
MIN_SIMILARITY_SCORE=0.5
MAX_SEARCH_RESULTS=100

# Performance Configuration
MAX_CONVERSATION_LENGTH=10000
BATCH_SIZE=100
CACHE_SIZE=1000
CACHE_TTL=3600

# Logging Configuration
LOG_LEVEL=INFO
LOG_FORMAT=json
LOG_FILE=context_persistence.log
```

### Configuration File

Create a `config.yaml` file:

```yaml
database:
  url: "sqlite:///context.db"
  pool_size: 10
  max_overflow: 20
  echo: false

vector_db:
  url: "localhost:6333"
  api_key: null
  collection_name: "context_vectors"
  vector_size: 384
  distance_metric: "cosine"

nlp:
  spacy_model: "en_core_web_sm"
  sentence_transformer_model: "all-MiniLM-L6-v2"
  entity_extraction_threshold: 0.7
  max_entities_per_text: 50

search:
  default_limit: 10
  min_similarity_score: 0.5
  max_results: 100
  enable_hybrid_search: true

performance:
  max_conversation_length: 10000
  batch_size: 100
  cache_size: 1000
  cache_ttl: 3600
  enable_parallel_processing: true

logging:
  level: "INFO"
  format: "json"
  file: "context_persistence.log"
  max_size: "100MB"
  backup_count: 5
```

## Advanced Features

### Batch Operations

```python
# Batch save conversations
conversations = [
    Conversation(conversation_id=f"conv-{i}", messages=messages)
    for i in range(10)
]

results = client.batch_save_conversations(conversations)
successful = sum(1 for r in results if r.success)
print(f"Successfully saved {successful}/{len(conversations)} conversations")

# Batch entity extraction
texts = [
    "The DataProcessor class handles data transformation",
    "We use pandas for data manipulation",
    "The validation module ensures data quality"
]

batch_results = client.batch_extract_entities(texts)
for i, result in enumerate(batch_results):
    if result.success:
        print(f"Text {i}: Found {len(result.entities)} entities")
```

### Custom Entity Types

```python
# Define custom entity types
custom_entity_patterns = {
    "technology": [
        r"\b(Python|JavaScript|TypeScript|React|Vue|Angular)\b",
        r"\b(pandas|numpy|scikit-learn|tensorflow|pytorch)\b"
    ],
    "file_type": [
        r"\b(\.py|\.js|\.ts|\.json|\.yaml|\.md)\b"
    ],
    "concept": [
        r"\b(microservices|API|REST|GraphQL|gRPC)\b"
    ]
}

client.configure_entity_patterns(custom_entity_patterns)

# Extract with custom patterns
entities = client.extract_entities(
    text="We built a React frontend using TypeScript and a Python backend with REST APIs",
    entity_types=["technology", "concept"]
)
```

### Custom Embedding Models

```python
from sentence_transformers import SentenceTransformer

# Use custom embedding model
custom_model = SentenceTransformer('paraphrase-MiniLM-L6-v2')

client.configure_embedding_model(
    model=custom_model,
    vector_size=384,
    batch_size=32
)

# Generate embeddings manually
embeddings = client.generate_embeddings([
    "This is a sample text",
    "Another sample text for embedding"
])

print(f"Generated embeddings with shape: {embeddings.shape}")
```

### Knowledge Graph Analytics

```python
# Analyze graph structure
analytics = client.get_graph_analytics()

print(f"Graph Statistics:")
print(f"  Nodes: {analytics.total_nodes}")
print(f"  Edges: {analytics.total_edges}")
print(f"  Density: {analytics.density:.4f}")
print(f"  Average degree: {analytics.avg_degree:.2f}")

# Find central entities
central_entities = client.find_central_entities(
    metric="betweenness_centrality",
    top_k=10
)

print("\nMost Central Entities:")
for entity in central_entities:
    print(f"  {entity.name}: {entity.centrality_score:.4f}")

# Detect communities
communities = client.detect_communities()
print(f"\nFound {len(communities)} communities:")
for i, community in enumerate(communities):
    print(f"  Community {i}: {len(community.entities)} entities")
    print(f"    Key entities: {[e.name for e in community.entities[:3]]}")
```

## Performance Optimization

### Caching

```python
# Configure caching
client.configure_cache(
    cache_type="redis",  # or "memory", "file"
    cache_size=1000,
    ttl=3600,
    redis_url="redis://localhost:6379"
)

# Cache-aware operations
# Results will be cached automatically
result1 = client.search_similar_conversations("data validation")
result2 = client.search_similar_conversations("data validation")  # From cache

# Clear cache
client.clear_cache()
```

### Parallel Processing

```python
# Enable parallel processing for large operations
client.configure_parallel_processing(
    max_workers=4,
    chunk_size=100
)

# Process large dataset in parallel
large_text_dataset = ["text1", "text2", ...]  # 1000+ texts

results = client.batch_extract_entities(
    texts=large_text_dataset,
    parallel=True,
    max_workers=4
)

print(f"Processed {len(results)} texts in parallel")
```

### Memory Management

```python
# Configure memory usage
client.configure_memory_management(
    max_memory_usage="2GB",
    cleanup_threshold=0.8,
    auto_cleanup=True
)

# Monitor memory usage
memory_stats = client.get_memory_stats()
print(f"Memory usage: {memory_stats.current_usage}")
print(f"Memory limit: {memory_stats.max_usage}")
print(f"Cleanup threshold: {memory_stats.cleanup_threshold}")
```

## Error Handling

### Exception Hierarchy

```python
from mcp_context_persistence.exceptions import (
    ContextPersistenceError,
    DatabaseError,
    VectorDBError,
    NLPError,
    GraphError,
    SearchError,
    ValidationError,
    NotFoundError
)

try:
    result = client.save_conversation(conversation)
except DatabaseError as e:
    print(f"Database error: {e}")
    # Handle database connection issues
except VectorDBError as e:
    print(f"Vector database error: {e}")
    # Handle vector database issues
except NLPError as e:
    print(f"NLP processing error: {e}")
    # Handle NLP processing issues
except ContextPersistenceError as e:
    print(f"General error: {e}")
    # Handle other errors
```

### Retry Logic

```python
import time
from mcp_context_persistence.exceptions import DatabaseError

def retry_operation(operation, max_retries=3, delay=1.0):
    for attempt in range(max_retries):
        try:
            return operation()
        except DatabaseError as e:
            if attempt == max_retries - 1:
                raise e
            print(f"Attempt {attempt + 1} failed, retrying in {delay} seconds...")
            time.sleep(delay)
            delay *= 2  # Exponential backoff

# Usage with retry
result = retry_operation(lambda: client.save_conversation(conversation))
```

## Testing

### Unit Tests

```python
import pytest
from mcp_context_persistence import ContextPersistenceClient
from mcp_context_persistence.models import Conversation

@pytest.fixture
def client():
    return ContextPersistenceClient(
        database_url="sqlite:///:memory:",
        vector_db_url=":memory:"
    )

def test_save_conversation(client):
    conversation = Conversation(
        conversation_id="test-001",
        messages=[
            {"role": "user", "content": "Hello"},
            {"role": "assistant", "content": "Hi there!"}
        ]
    )
    
    result = client.save_conversation(conversation)
    
    assert result.success
    assert result.conversation_id == "test-001"
    assert result.message_count == 2

def test_extract_entities(client):
    text = "The DataProcessor class handles data processing"
    result = client.extract_entities(text)
    
    assert result.success
    assert len(result.entities) > 0
    
    # Check for expected entities
    entity_names = [e.name for e in result.entities]
    assert "DataProcessor" in entity_names
```

### Integration Tests

```python
def test_full_workflow(client):
    # Save conversation
    conv_result = client.save_conversation(
        conversation_id="workflow-test",
        messages=[
            {"role": "user", "content": "Analyze Python code structure"},
            {"role": "assistant", "content": "I'll analyze the code..."}
        ]
    )
    assert conv_result.success
    
    # Extract entities
    entity_result = client.extract_entities(
        text="The DataProcessor class in Python handles data transformation",
        conversation_id="workflow-test"
    )
    assert entity_result.success
    
    # Create relationships
    if entity_result.entities:
        rel_result = client.create_relationship(
            source_entity_id=entity_result.entities[0].id,
            target_entity_id="data_transformation",
            relationship_type="implements"
        )
        assert rel_result.success
    
    # Search
    search_result = client.search_similar_conversations(
        query="Python code analysis",
        limit=5
    )
    assert search_result.success
    assert search_result.total_results >= 1
```

## Deployment

### Docker Deployment

```dockerfile
FROM python:3.12-slim

WORKDIR /app

# Install system dependencies
RUN apt-get update && apt-get install -y \
    gcc \
    g++ \
    && rm -rf /var/lib/apt/lists/*

# Copy requirements and install Python dependencies
COPY requirements.txt .
RUN pip install --no-cache-dir -r requirements.txt

# Copy application code
COPY . .

# Download spaCy model
RUN python -m spacy download en_core_web_sm

# Expose port
EXPOSE 8000

# Run the application
CMD ["uvicorn", "mcp_context_persistence.main:app", "--host", "0.0.0.0", "--port", "8000"]
```

### Kubernetes Deployment

```yaml
apiVersion: apps/v1
kind: Deployment
metadata:
  name: context-persistence
spec:
  replicas: 3
  selector:
    matchLabels:
      app: context-persistence
  template:
    metadata:
      labels:
        app: context-persistence
    spec:
      containers:
      - name: context-persistence
        image: your-registry/context-persistence:latest
        ports:
        - containerPort: 8000
        env:
        - name: DATABASE_URL
          value: "postgresql://user:pass@postgres:5432/context"
        - name: VECTOR_DB_URL
          value: "qdrant:6333"
        resources:
          requests:
            memory: "512Mi"
            cpu: "250m"
          limits:
            memory: "1Gi"
            cpu: "500m"
```

### Monitoring and Logging

```python
import logging
from mcp_context_persistence import ContextPersistenceClient

# Configure logging
logging.basicConfig(
    level=logging.INFO,
    format='%(asctime)s - %(name)s - %(levelname)s - %(message)s'
)

# Enable performance monitoring
client = ContextPersistenceClient(
    database_url="sqlite:///context.db",
    enable_metrics=True,
    metrics_port=9090
)

# Access metrics
metrics = client.get_metrics()
print(f"Total requests: {metrics.total_requests}")
print(f"Average response time: {metrics.avg_response_time:.3f}s")
print(f"Error rate: {metrics.error_rate:.2%}")
```

## Best Practices

### Performance

1. **Use Batch Operations**: Process multiple items together when possible
2. **Enable Caching**: Cache frequently accessed data
3. **Configure Connection Pooling**: Optimize database connections
4. **Monitor Memory Usage**: Set appropriate limits and cleanup thresholds
5. **Use Parallel Processing**: For large datasets, enable parallel operations

### Security

1. **Validate Input**: Always validate input data before processing
2. **Use Environment Variables**: Store sensitive configuration in environment variables
3. **Enable Logging**: Log operations for audit trails
4. **Handle Errors Gracefully**: Implement proper error handling and retry logic
5. **Secure Database Connections**: Use SSL/TLS for database connections

### Data Management

1. **Regular Backups**: Schedule regular database backups
2. **Data Retention**: Implement data retention policies
3. **Index Optimization**: Regularly optimize database indexes
4. **Monitor Storage**: Monitor storage usage and set limits
5. **Data Validation**: Validate data integrity regularly

This comprehensive Python SDK documentation provides developers with all the tools needed to effectively use the Context-Persistence MCP server in their applications.