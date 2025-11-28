"""
Entity Extractor for Phase 6 - Context Persistence

Uses spaCy NLP to extract entities from conversations:
- Named entities (people, organizations, projects, tools)
- Code entities (files, functions, classes)
- Concept entities (technical terms, patterns)
- Confidence scoring
"""

import os
from datetime import datetime
from typing import List, Dict, Any, Optional, Tuple
from uuid import uuid4
import spacy
from spacy.tokens import Doc


class EntityExtractor:
    """
    Extracts structured entities from conversational text using NLP.
    """

    def __init__(self):
        """Initialize spaCy model with error handling"""
        try:
            self.nlp = spacy.load("en_core_web_sm")
        except OSError:
            # Fallback if model not available
            print("⚠️  spaCy model 'en_core_web_sm' not found. Run: python3 -m spacy download en_core_web_sm")
            self.nlp = None

    def extract_entities(
        self,
        text: str,
        conversation_id: str,
        message_id: Optional[int] = None,
        event_time: Optional[datetime] = None
    ) -> List[Dict[str, Any]]:
        """
        Extract entities from text using spaCy NER and custom patterns.

        Args:
            text: The text to extract entities from
            conversation_id: ID of the conversation
            message_id: Optional message ID for tracking
            event_time: When the event occurred (defaults to now)

        Returns:
            List of entity dictionaries with metadata
        """
        if not self.nlp:
            return []

        if event_time is None:
            event_time = datetime.utcnow()

        doc = self.nlp(text)
        entities = []

        # Extract standard named entities
        for ent in doc.ents:
            entity_type = self._map_entity_type(ent.label_)
            if entity_type:
                entities.append({
                    "id": str(uuid4()),
                    "name": ent.text,
                    "entity_type": entity_type,
                    "description": f"{ent.label_}: {ent.text}",
                    "event_time": event_time,
                    "ingestion_time": datetime.utcnow(),
                    "valid_from": event_time,
                    "valid_until": None,
                    "conversation_id": conversation_id,
                    "message_id": message_id,
                    "confidence": self._calculate_confidence(ent),
                    "meta_data": {
                        "label": ent.label_,
                        "start": ent.start_char,
                        "end": ent.end_char
                    }
                })

        # Extract code-related entities
        code_entities = self._extract_code_entities(doc, conversation_id, message_id, event_time)
        entities.extend(code_entities)

        # Extract technical concepts
        concept_entities = self._extract_concepts(doc, conversation_id, message_id, event_time)
        entities.extend(concept_entities)

        return entities

    def _map_entity_type(self, spacy_label: str) -> Optional[str]:
        """Map spaCy entity labels to our entity types"""
        mapping = {
            "PERSON": "person",
            "ORG": "organization",
            "PRODUCT": "tool",
            "GPE": "location",
            "DATE": "temporal",
            "TIME": "temporal",
            "EVENT": "event",
            "WORK_OF_ART": "project",
            "LAW": "concept",
            "LANGUAGE": "tool"
        }
        return mapping.get(spacy_label)

    def _calculate_confidence(self, ent) -> float:
        """
        Calculate confidence score for an entity.
        Based on:
        - Entity length (longer = more reliable)
        - Entity type (some types more reliable)
        - Presence in knowledge bases
        """
        base_confidence = 0.7

        # Longer entities tend to be more specific
        if len(ent.text) > 10:
            base_confidence += 0.1

        # Certain entity types are more reliable
        reliable_types = {"PERSON", "ORG", "GPE", "PRODUCT"}
        if ent.label_ in reliable_types:
            base_confidence += 0.1

        # Cap at 1.0
        return min(base_confidence, 1.0)

    def _extract_code_entities(
        self,
        doc: Doc,
        conversation_id: str,
        message_id: Optional[int],
        event_time: datetime
    ) -> List[Dict[str, Any]]:
        """
        Extract code-related entities using pattern matching.
        Looks for:
        - File paths (e.g., src/main.py)
        - Function calls (e.g., function_name())
        - Class names (e.g., ClassName)
        - Imports (e.g., import numpy)
        """
        entities = []
        text = doc.text

        # Pattern 1: File paths (simplified)
        import re
        file_patterns = [
            r'[\w/.-]+\.(py|js|ts|tsx|jsx|go|rs|java|cpp|c|h|md|json|yaml|yml)',
            r'src/[\w/.-]+',
            r'tests?/[\w/.-]+'
        ]

        for pattern in file_patterns:
            for match in re.finditer(pattern, text):
                entities.append({
                    "id": str(uuid4()),
                    "name": match.group(),
                    "entity_type": "file",
                    "description": f"File: {match.group()}",
                    "event_time": event_time,
                    "ingestion_time": datetime.utcnow(),
                    "valid_from": event_time,
                    "valid_until": None,
                    "conversation_id": conversation_id,
                    "message_id": message_id,
                    "confidence": 0.8,
                    "meta_data": {
                        "pattern": "file_path",
                        "start": match.start(),
                        "end": match.end()
                    }
                })

        # Pattern 2: Function calls (word followed by parentheses)
        function_pattern = r'\b([a-z_][a-z0-9_]*)\s*\('
        for match in re.finditer(function_pattern, text):
            func_name = match.group(1)
            # Filter out common words
            if len(func_name) > 3 and func_name not in {'with', 'from', 'import'}:
                entities.append({
                    "id": str(uuid4()),
                    "name": func_name,
                    "entity_type": "function",
                    "description": f"Function: {func_name}",
                    "event_time": event_time,
                    "ingestion_time": datetime.utcnow(),
                    "valid_from": event_time,
                    "valid_until": None,
                    "conversation_id": conversation_id,
                    "message_id": message_id,
                    "confidence": 0.7,
                    "meta_data": {
                        "pattern": "function_call",
                        "start": match.start(),
                        "end": match.end()
                    }
                })

        # Pattern 3: Class names (PascalCase)
        class_pattern = r'\b([A-Z][a-z]+(?:[A-Z][a-z]+)+)\b'
        for match in re.finditer(class_pattern, text):
            entities.append({
                "id": str(uuid4()),
                "name": match.group(),
                "entity_type": "class",
                "description": f"Class: {match.group()}",
                "event_time": event_time,
                "ingestion_time": datetime.utcnow(),
                "valid_from": event_time,
                "valid_until": None,
                "conversation_id": conversation_id,
                "message_id": message_id,
                "confidence": 0.75,
                "meta_data": {
                    "pattern": "class_name",
                    "start": match.start(),
                    "end": match.end()
                }
            })

        return entities

    def _extract_concepts(
        self,
        doc: Doc,
        conversation_id: str,
        message_id: Optional[int],
        event_time: datetime
    ) -> List[Dict[str, Any]]:
        """
        Extract technical concepts using noun chunks and patterns.
        """
        entities = []

        # Extract noun chunks as potential concepts
        for chunk in doc.noun_chunks:
            # Filter for technical-sounding terms
            if len(chunk.text.split()) <= 3 and len(chunk.text) > 3:
                # Check if it contains technical terms
                tech_terms = {'api', 'database', 'server', 'client', 'model', 'schema',
                             'service', 'component', 'module', 'package', 'library',
                             'framework', 'architecture', 'pattern', 'algorithm'}

                if any(term in chunk.text.lower() for term in tech_terms):
                    entities.append({
                        "id": str(uuid4()),
                        "name": chunk.text,
                        "entity_type": "concept",
                        "description": f"Technical concept: {chunk.text}",
                        "event_time": event_time,
                        "ingestion_time": datetime.utcnow(),
                        "valid_from": event_time,
                        "valid_until": None,
                        "conversation_id": conversation_id,
                        "message_id": message_id,
                        "confidence": 0.65,
                        "meta_data": {
                            "pattern": "noun_chunk",
                            "start": chunk.start_char,
                            "end": chunk.end_char
                        }
                    })

        return entities

    def extract_entity_mentions(
        self,
        text: str,
        entity_name: str,
        conversation_id: str,
        message_id: int,
        context_window: int = 50
    ) -> List[Dict[str, Any]]:
        """
        Find all mentions of a specific entity in text.

        Args:
            text: Text to search
            entity_name: Entity to find
            conversation_id: Conversation ID
            message_id: Message ID
            context_window: Characters to include in context snippet

        Returns:
            List of mention dictionaries
        """
        mentions = []
        name_lower = entity_name.lower()
        text_lower = text.lower()

        # Find all occurrences
        pos = 0
        while True:
            pos = text_lower.find(name_lower, pos)
            if pos == -1:
                break

            # Extract context snippet
            start = max(0, pos - context_window)
            end = min(len(text), pos + len(entity_name) + context_window)
            context = text[start:end]

            mentions.append({
                "entity_id": None,  # Will be set by caller
                "conversation_id": conversation_id,
                "message_id": message_id,
                "mention_text": text[pos:pos + len(entity_name)],
                "context_snippet": context,
                "position": pos,
                "timestamp": datetime.utcnow(),
                "confidence": 1.0  # Exact match
            })

            pos += len(entity_name)

        return mentions

    def deduplicate_entities(self, entities: List[Dict[str, Any]]) -> List[Dict[str, Any]]:
        """
        Remove duplicate entities based on name and type.
        Keeps the one with highest confidence.
        """
        seen = {}
        for entity in entities:
            key = (entity["name"].lower(), entity["entity_type"])
            if key not in seen or entity["confidence"] > seen[key]["confidence"]:
                seen[key] = entity

        return list(seen.values())
