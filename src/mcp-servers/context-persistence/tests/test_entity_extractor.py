#!/usr/bin/env python3
"""
Comprehensive unit tests for EntityExtractor component.
Target: >80% code coverage for entity_extractor.py
"""

import pytest
from unittest.mock import Mock, patch, MagicMock
from datetime import datetime
from uuid import uuid4

from context_persistence.entity_extractor import EntityExtractor


class TestEntityExtractor:
    """Test suite for EntityExtractor class"""

    @pytest.fixture
    def mock_spacy_doc(self):
        """Create a mock spaCy document for testing"""
        doc = Mock()
        doc.ents = []
        doc.noun_chunks = []
        doc.text = "Test document"
        return doc

    @pytest.fixture
    def entity_extractor(self):
        """Create EntityExtractor instance for testing"""
        return EntityExtractor()

    @pytest.fixture
    def mock_nlp(self, mock_spacy_doc):
        """Create mock NLP model"""
        nlp = Mock(return_value=mock_spacy_doc)
        return nlp

    class TestInitialization:
        """Test EntityExtractor initialization"""

        def test_init_with_spacy_model_available(self):
            """Test successful initialization with spaCy model"""
            with patch('spacy.load') as mock_load:
                mock_nlp = Mock()
                mock_load.return_value = mock_nlp
                
                extractor = EntityExtractor()
                
                assert extractor.nlp == mock_nlp
                mock_load.assert_called_once_with("en_core_web_sm")

        def test_init_without_spacy_model(self):
            """Test initialization when spaCy model is not available"""
            with patch('spacy.load', side_effect=OSError("Model not found")):
                extractor = EntityExtractor()
                
                assert extractor.nlp is None

        def test_init_spacy_load_exception(self):
            """Test handling of spaCy load exceptions"""
            with patch('spacy.load', side_effect=Exception("Unexpected error")):
                # Should not raise exception, but set nlp to None
                extractor = EntityExtractor()
                assert extractor.nlp is None

    class TestEntityExtraction:
        """Test main entity extraction functionality"""

        def test_extract_entities_without_nlp(self, entity_extractor):
            """Test extraction when spaCy model is not available"""
            entity_extractor.nlp = None
            
            result = entity_extractor.extract_entities(
                "Test text", "conv-123", message_id=1
            )
            
            assert result == []

        @patch('context_persistence.entity_extractor.datetime')
        def test_extract_entities_with_defaults(self, mock_datetime, entity_extractor, mock_nlp):
            """Test entity extraction with default parameters"""
            mock_now = datetime(2023, 1, 1, 12, 0, 0)
            mock_datetime.utcnow.return_value = mock_now
            entity_extractor.nlp = mock_nlp
            
            # Mock entity
            mock_ent = Mock()
            mock_ent.text = "John Doe"
            mock_ent.label_ = "PERSON"
            mock_ent.start_char = 0
            mock_ent.end_char = 8
            mock_nlp.return_value.ents = [mock_ent]
            
            result = entity_extractor.extract_entities("John Doe is here", "conv-123")
            
            assert len(result) == 1
            assert result[0]["name"] == "John Doe"
            assert result[0]["entity_type"] == "person"
            assert result[0]["conversation_id"] == "conv-123"
            assert result[0]["event_time"] == mock_now
            assert result[0]["ingestion_time"] == mock_now

        @patch('context_persistence.entity_extractor.datetime')
        def test_extract_entities_with_custom_params(self, mock_datetime, entity_extractor, mock_nlp):
            """Test entity extraction with custom parameters"""
            mock_now = datetime(2023, 1, 1, 12, 0, 0)
            mock_event_time = datetime(2022, 12, 31, 23, 59, 59)
            mock_datetime.utcnow.return_value = mock_now
            entity_extractor.nlp = mock_nlp
            
            result = entity_extractor.extract_entities(
                "Test text", "conv-456", 
                message_id=42, 
                event_time=mock_event_time
            )
            
            # Should use custom event_time but current time for ingestion
            assert result[0]["event_time"] == mock_event_time
            assert result[0]["ingestion_time"] == mock_now
            assert result[0]["message_id"] == 42

    class TestEntityTypeMapping:
        """Test entity type mapping from spaCy labels"""

        @pytest.mark.parametrize("spacy_label,expected_type", [
            ("PERSON", "person"),
            ("ORG", "organization"),
            ("PRODUCT", "tool"),
            ("GPE", "location"),
            ("DATE", "temporal"),
            ("TIME", "temporal"),
            ("EVENT", "event"),
            ("WORK_OF_ART", "project"),
            ("LAW", "concept"),
            ("LANGUAGE", "tool"),
            ("UNKNOWN_LABEL", None),
            ("", None),
        ])
        def test_map_entity_type(self, entity_extractor, spacy_label, expected_type):
            """Test mapping of spaCy entity labels to our types"""
            result = entity_extractor._map_entity_type(spacy_label)
            assert result == expected_type

    class TestConfidenceCalculation:
        """Test confidence score calculation"""

        def test_calculate_confidence_short_entity(self, entity_extractor):
            """Test confidence for short entities"""
            mock_ent = Mock()
            mock_ent.text = "Bob"
            mock_ent.label_ = "PERSON"
            
            confidence = entity_extractor._calculate_confidence(mock_ent)
            
            assert 0.0 <= confidence <= 1.0
            assert confidence == 0.7  # Base confidence only

        def test_calculate_confidence_long_entity(self, entity_extractor):
            """Test confidence for long entities"""
            mock_ent = Mock()
            mock_ent.text = "Very Long Entity Name"
            mock_ent.label_ = "PERSON"
            
            confidence = entity_extractor._calculate_confidence(mock_ent)
            
            assert confidence == 0.8  # Base + length bonus

        def test_calculate_confidence_reliable_type(self, entity_extractor):
            """Test confidence for reliable entity types"""
            mock_ent = Mock()
            mock_ent.text = "Test"
            mock_ent.label_ = "ORG"
            
            confidence = entity_extractor._calculate_confidence(mock_ent)
            
            assert confidence == 0.8  # Base + type bonus

        def test_calculate_confidence_max_capped(self, entity_extractor):
            """Test confidence is capped at 1.0"""
            mock_ent = Mock()
            mock_ent.text = "Very Long Entity Name That Is Definitely Over Ten Characters"
            mock_ent.label_ = "PERSON"
            
            confidence = entity_extractor._calculate_confidence(mock_ent)
            
            assert confidence == 1.0  # Should be capped

    class TestCodeEntityExtraction:
        """Test code-related entity extraction"""

        @patch('context_persistence.entity_extractor.datetime')
        def test_extract_file_paths(self, mock_datetime, entity_extractor):
            """Test extraction of file path entities"""
            mock_now = datetime(2023, 1, 1, 12, 0, 0)
            mock_datetime.utcnow.return_value = mock_now
            
            text = "Check src/main.py and tests/test_app.js for implementation"
            
            with patch.object(entity_extractor, 'nlp') as mock_nlp:
                mock_doc = Mock()
                mock_doc.text = text
                mock_nlp.return_value = mock_doc
                
                entities = entity_extractor._extract_code_entities(
                    mock_doc, "conv-123", 1, mock_now
                )
                
                # Should extract both file paths
                file_entities = [e for e in entities if e["entity_type"] == "file"]
                assert len(file_entities) == 2
                assert any("src/main.py" in e["name"] for e in file_entities)
                assert any("tests/test_app.js" in e["name"] for e in file_entities)

        @patch('context_persistence.entity_extractor.datetime')
        def test_extract_function_calls(self, mock_datetime, entity_extractor):
            """Test extraction of function call entities"""
            mock_now = datetime(2023, 1, 1, 12, 0, 0)
            mock_datetime.utcnow.return_value = mock_now
            
            text = "Call calculate_total() and process_data() functions"
            
            with patch.object(entity_extractor, 'nlp') as mock_nlp:
                mock_doc = Mock()
                mock_doc.text = text
                mock_nlp.return_value = mock_doc
                
                entities = entity_extractor._extract_code_entities(
                    mock_doc, "conv-123", 1, mock_now
                )
                
                func_entities = [e for e in entities if e["entity_type"] == "function"]
                assert len(func_entities) == 2
                assert any("calculate_total" in e["name"] for e in func_entities)
                assert any("process_data" in e["name"] for e in func_entities)

        @patch('context_persistence.entity_extractor.datetime')
        def test_extract_class_names(self, mock_datetime, entity_extractor):
            """Test extraction of class name entities"""
            mock_now = datetime(2023, 1, 1, 12, 0, 0)
            mock_datetime.utcnow.return_value = mock_now
            
            text = "Create UserController and DataProcessor classes"
            
            with patch.object(entity_extractor, 'nlp') as mock_nlp:
                mock_doc = Mock()
                mock_doc.text = text
                mock_nlp.return_value = mock_doc
                
                entities = entity_extractor._extract_code_entities(
                    mock_doc, "conv-123", 1, mock_now
                )
                
                class_entities = [e for e in entities if e["entity_type"] == "class"]
                assert len(class_entities) == 2
                assert any("UserController" in e["name"] for e in class_entities)
                assert any("DataProcessor" in e["name"] for e in class_entities)

        def test_filter_common_function_names(self, entity_extractor):
            """Test that common words are filtered out from function extraction"""
            text = "Import with from and import statements"
            
            with patch.object(entity_extractor, 'nlp') as mock_nlp:
                mock_doc = Mock()
                mock_doc.text = text
                mock_nlp.return_value = mock_doc
                
                entities = entity_extractor._extract_code_entities(
                    mock_doc, "conv-123", 1, datetime.utcnow()
                )
                
                func_entities = [e for e in entities if e["entity_type"] == "function"]
                # Should not extract "with", "from", "import" as functions
                func_names = [e["name"] for e in func_entities]
                assert "with" not in func_names
                assert "from" not in func_names
                assert "import" not in func_names

    class TestConceptExtraction:
        """Test technical concept extraction"""

        @patch('context_persistence.entity_extractor.datetime')
        def test_extract_technical_concepts(self, mock_datetime, entity_extractor):
            """Test extraction of technical concepts"""
            mock_now = datetime(2023, 1, 1, 12, 0, 0)
            mock_datetime.utcnow.return_value = mock_now
            
            with patch.object(entity_extractor, 'nlp') as mock_nlp:
                mock_doc = Mock()
                mock_doc.text = "The API server uses database architecture patterns"
                mock_nlp.return_value = mock_doc
                
                # Mock noun chunks
                mock_chunk1 = Mock()
                mock_chunk1.text = "API server"
                mock_chunk1.start_char = 4
                mock_chunk1.end_char = 14
                
                mock_chunk2 = Mock()
                mock_chunk2.text = "database architecture"
                mock_chunk2.start_char = 24
                mock_chunk2.end_char = 46
                
                mock_doc.noun_chunks = [mock_chunk1, mock_chunk2]
                
                entities = entity_extractor._extract_concepts(
                    mock_doc, "conv-123", 1, mock_now
                )
                
                concept_entities = [e for e in entities if e["entity_type"] == "concept"]
                assert len(concept_entities) == 2
                assert any("API server" in e["name"] for e in concept_entities)
                assert any("database architecture" in e["name"] for e in concept_entities)

        def test_filter_non_technical_concepts(self, entity_extractor):
            """Test that non-technical concepts are filtered out"""
            with patch.object(entity_extractor, 'nlp') as mock_nlp:
                mock_doc = Mock()
                mock_doc.text = "The cat sat on the mat"
                mock_nlp.return_value = mock_doc
                
                # Mock noun chunks without technical terms
                mock_chunk = Mock()
                mock_chunk.text = "cat"
                mock_chunk.start_char = 4
                mock_chunk.end_char = 7
                mock_doc.noun_chunks = [mock_chunk]
                
                entities = entity_extractor._extract_concepts(
                    mock_doc, "conv-123", 1, datetime.utcnow()
                )
                
                # Should not extract "cat" as a technical concept
                concept_entities = [e for e in entities if e["entity_type"] == "concept"]
                assert len(concept_entities) == 0

        def test_filter_long_concepts(self, entity_extractor):
            """Test that very long noun chunks are filtered out"""
            with patch.object(entity_extractor, 'nlp') as mock_nlp:
                mock_doc = Mock()
                mock_doc.text = "This is a very long noun chunk that has more than three words"
                mock_nlp.return_value = mock_doc
                
                # Mock long noun chunk
                mock_chunk = Mock()
                mock_chunk.text = "very long noun chunk that has more than three words"
                mock_chunk.start_char = 10
                mock_chunk.end_char = 65
                mock_doc.noun_chunks = [mock_chunk]
                
                entities = entity_extractor._extract_concepts(
                    mock_doc, "conv-123", 1, datetime.utcnow()
                )
                
                # Should not extract very long concepts
                concept_entities = [e for e in entities if e["entity_type"] == "concept"]
                assert len(concept_entities) == 0

    class TestEntityMentions:
        """Test entity mention extraction"""

        def test_extract_entity_mentions_single_occurrence(self, entity_extractor):
            """Test extraction of single entity mention"""
            text = "The API design is important for the API implementation"
            entity_name = "API"
            conversation_id = "conv-123"
            message_id = 1
            
            mentions = entity_extractor.extract_entity_mentions(
                text, entity_name, conversation_id, message_id, context_window=10
            )
            
            assert len(mentions) == 2  # "API" appears twice
            assert all(m["entity_id"] is None for m in mentions)
            assert all(m["conversation_id"] == conversation_id for m in mentions)
            assert all(m["message_id"] == message_id for m in mentions)
            assert all(m["mention_text"] == "API" for m in mentions)
            assert all(m["confidence"] == 1.0 for m in mentions)

        def test_extract_entity_mentions_with_context(self, entity_extractor):
            """Test that context snippets are extracted correctly"""
            text = "The database server is running and the database client is connected"
            entity_name = "database"
            
            mentions = entity_extractor.extract_entity_mentions(
                text, entity_name, "conv-123", 1, context_window=5
            )
            
            assert len(mentions) == 2
            
            # Check first mention context
            first_mention = mentions[0]
            assert "database" in first_mention["context_snippet"]
            assert first_mention["position"] == 4
            
            # Check second mention context
            second_mention = mentions[1]
            assert "database" in second_mention["context_snippet"]
            assert second_mention["position"] == 42

        def test_extract_entity_mentions_case_insensitive(self, entity_extractor):
            """Test case-insensitive entity mention extraction"""
            text = "API and api and Api"
            entity_name = "api"
            
            mentions = entity_extractor.extract_entity_mentions(
                text, entity_name, "conv-123", 1
            )
            
            # Should find all case variations
            assert len(mentions) == 3

        def test_extract_entity_mentions_no_occurrences(self, entity_extractor):
            """Test extraction when entity is not found"""
            text = "This text contains no relevant terms"
            entity_name = "missing"
            
            mentions = entity_extractor.extract_entity_mentions(
                text, entity_name, "conv-123", 1
            )
            
            assert len(mentions) == 0

        def test_extract_entity_mentions_empty_text(self, entity_extractor):
            """Test extraction from empty text"""
            text = ""
            entity_name = "test"
            
            mentions = entity_extractor.extract_entity_mentions(
                text, entity_name, "conv-123", 1
            )
            
            assert len(mentions) == 0

    class TestEntityDeduplication:
        """Test entity deduplication functionality"""

        def test_deduplicate_entities_by_name_and_type(self, entity_extractor):
            """Test deduplication based on name and entity type"""
            entities = [
                {
                    "id": "1",
                    "name": "API",
                    "entity_type": "concept",
                    "confidence": 0.7
                },
                {
                    "id": "2", 
                    "name": "api",
                    "entity_type": "concept",
                    "confidence": 0.8
                },
                {
                    "id": "3",
                    "name": "API",
                    "entity_type": "tool",
                    "confidence": 0.9
                }
            ]
            
            deduplicated = entity_extractor.deduplicate_entities(entities)
            
            # Should keep 2 entities (concept with higher confidence, tool)
            assert len(deduplicated) == 2
            
            # Check that higher confidence concept was kept
            concept_entities = [e for e in deduplicated if e["entity_type"] == "concept"]
            assert len(concept_entities) == 1
            assert concept_entities[0]["confidence"] == 0.8
            assert concept_entities[0]["id"] == "2"

        def test_deduplicate_empty_list(self, entity_extractor):
            """Test deduplication of empty list"""
            result = entity_extractor.deduplicate_entities([])
            assert result == []

        def test_deduplicate_no_duplicates(self, entity_extractor):
            """Test deduplication when no duplicates exist"""
            entities = [
                {
                    "id": "1",
                    "name": "API",
                    "entity_type": "concept",
                    "confidence": 0.7
                },
                {
                    "id": "2",
                    "name": "Database",
                    "entity_type": "concept", 
                    "confidence": 0.8
                }
            ]
            
            deduplicated = entity_extractor.deduplicate_entities(entities)
            
            assert len(deduplicated) == 2
            assert deduplicated == entities

        def test_deduplicate_preserve_highest_confidence(self, entity_extractor):
            """Test that entity with highest confidence is preserved"""
            entities = [
                {"id": "1", "name": "Test", "entity_type": "concept", "confidence": 0.5},
                {"id": "2", "name": "test", "entity_type": "concept", "confidence": 0.9},
                {"id": "3", "name": "TEST", "entity_type": "concept", "confidence": 0.3}
            ]
            
            deduplicated = entity_extractor.deduplicate_entities(entities)
            
            assert len(deduplicated) == 1
            assert deduplicated[0]["confidence"] == 0.9
            assert deduplicated[0]["id"] == "2"

    class TestEdgeCases:
        """Test edge cases and error conditions"""

        def test_extract_entities_empty_text(self, entity_extractor):
            """Test extraction from empty text"""
            with patch.object(entity_extractor, 'nlp') as mock_nlp:
                mock_doc = Mock()
                mock_doc.ents = []
                mock_doc.noun_chunks = []
                mock_doc.text = ""
                mock_nlp.return_value = mock_doc
                
                result = entity_extractor.extract_entities("", "conv-123")
                
                assert result == []

        def test_extract_entities_special_characters(self, entity_extractor):
            """Test extraction with special characters"""
            text = "Check file.js! and test.py? for @special #chars"
            
            with patch.object(entity_extractor, 'nlp') as mock_nlp:
                mock_doc = Mock()
                mock_doc.text = text
                mock_doc.ents = []
                mock_doc.noun_chunks = []
                mock_nlp.return_value = mock_doc
                
                entities = entity_extractor._extract_code_entities(
                    mock_doc, "conv-123", 1, datetime.utcnow()
                )
                
                # Should still extract file patterns despite special chars
                file_entities = [e for e in entities if e["entity_type"] == "file"]
                assert len(file_entities) >= 1

        def test_extract_entities_unicode_text(self, entity_extractor):
            """Test extraction with Unicode characters"""
            text = "Café API uses naïve implementation"
            
            with patch.object(entity_extractor, 'nlp') as mock_nlp:
                mock_doc = Mock()
                mock_doc.text = text
                mock_doc.ents = []
                mock_doc.noun_chunks = []
                mock_nlp.return_value = mock_doc
                
                # Should not crash with Unicode text
                entities = entity_extractor._extract_code_entities(
                    mock_doc, "conv-123", 1, datetime.utcnow()
                )
                
                assert isinstance(entities, list)

        def test_extract_very_long_text(self, entity_extractor):
            """Test extraction with very long text"""
            text = "function " * 1000  # Very long text
            
            with patch.object(entity_extractor, 'nlp') as mock_nlp:
                mock_doc = Mock()
                mock_doc.text = text
                mock_doc.ents = []
                mock_doc.noun_chunks = []
                mock_nlp.return_value = mock_doc
                
                # Should handle long text without issues
                entities = entity_extractor._extract_code_entities(
                    mock_doc, "conv-123", 1, datetime.utcnow()
                )
                
                assert isinstance(entities, list)

    class TestPerformance:
        """Test performance-related scenarios"""

        @pytest.mark.slow
        def test_large_text_processing(self, entity_extractor):
            """Test processing of large text blocks"""
            # Create a large text with various patterns
            large_text = " ".join([
                f"function_{i}()" for i in range(100)
            ]) + " " + " ".join([
                f"Class{i}" for i in range(50)
            ]) + " " + " ".join([
                f"file_{i}.py" for i in range(75)
            ])
            
            with patch.object(entity_extractor, 'nlp') as mock_nlp:
                mock_doc = Mock()
                mock_doc.text = large_text
                mock_doc.ents = []
                mock_doc.noun_chunks = []
                mock_nlp.return_value = mock_doc
                
                import time
                start_time = time.time()
                
                entities = entity_extractor._extract_code_entities(
                    mock_doc, "conv-123", 1, datetime.utcnow()
                )
                
                end_time = time.time()
                processing_time = end_time - start_time
                
                # Should complete within reasonable time (adjust threshold as needed)
                assert processing_time < 5.0  # 5 seconds
                assert isinstance(entities, list)

    class TestIntegration:
        """Integration tests combining multiple features"""

        @patch('context_persistence.entity_extractor.datetime')
        def test_full_extraction_pipeline(self, mock_datetime, entity_extractor):
            """Test the complete entity extraction pipeline"""
            mock_now = datetime(2023, 1, 1, 12, 0, 0)
            mock_datetime.utcnow.return_value = mock_now
            
            text = """
            John Doe from Acme Corp is working on the UserController class.
            He needs to implement the calculate_total() function in src/main.py.
            The API server architecture uses a database component for data persistence.
            """
            
            with patch.object(entity_extractor, 'nlp') as mock_nlp:
                mock_doc = Mock()
                mock_doc.text = text
                
                # Mock named entities
                mock_ent1 = Mock()
                mock_ent1.text = "John Doe"
                mock_ent1.label_ = "PERSON"
                mock_ent1.start_char = 13
                mock_ent1.end_char = 21
                
                mock_ent2 = Mock()
                mock_ent2.text = "Acme Corp"
                mock_ent2.label_ = "ORG"
                mock_ent2.start_char = 27
                mock_ent2.end_char = 36
                
                mock_doc.ents = [mock_ent1, mock_ent2]
                
                # Mock noun chunks
                mock_chunk = Mock()
                mock_chunk.text = "API server architecture"
                mock_chunk.start_char = 120
                mock_chunk.end_char = 143
                mock_doc.noun_chunks = [mock_chunk]
                
                mock_nlp.return_value = mock_doc
                
                entities = entity_extractor.extract_entities(text, "conv-123", message_id=1)
                
                # Should extract multiple entity types
                entity_types = set(e["entity_type"] for e in entities)
                
                assert "person" in entity_types  # John Doe
                assert "organization" in entity_types  # Acme Corp
                assert "class" in entity_types  # UserController
                assert "function" in entity_types  # calculate_total
                assert "file" in entity_types  # src/main.py
                assert "concept" in entity_types  # API server architecture
                
                # All entities should have required fields
                for entity in entities:
                    assert "id" in entity
                    assert "name" in entity
                    assert "entity_type" in entity
                    assert "confidence" in entity
                    assert "conversation_id" in entity
                    assert entity["conversation_id"] == "conv-123"
                    assert entity["message_id"] == 1

        def test_deduplication_after_extraction(self, entity_extractor):
            """Test that deduplication works correctly after full extraction"""
            # Create entities that would cause duplicates
            with patch.object(entity_extractor, 'nlp') as mock_nlp:
                mock_doc = Mock()
                mock_doc.text = "API and api"
                mock_doc.ents = []
                mock_doc.noun_chunks = []
                mock_nlp.return_value = mock_doc
                
                # Mock extraction that creates duplicates
                entities1 = entity_extractor._extract_code_entities(
                    mock_doc, "conv-123", 1, datetime.utcnow()
                )
                
                entities2 = entity_extractor._extract_code_entities(
                    mock_doc, "conv-123", 1, datetime.utcnow()
                )
                
                all_entities = entities1 + entities2
                deduplicated = entity_extractor.deduplicate_entities(all_entities)
                
                # Should have fewer entities after deduplication
                assert len(deduplicated) <= len(all_entities)