package ctxmgr

import (
	"context"
	"encoding/json"
	"fmt"
	"log"

	"github.com/gr3enarr0w/mcp-ecosystem/nanogpt-proxy/backends"
	"github.com/gr3enarr0w/mcp-ecosystem/nanogpt-proxy/mcp"
)

// ContextManager enriches requests with conversation history and context
type ContextManager struct {
	mcpClients map[string]*mcp.MCPClient
}

// NewContextManager creates a new context manager
func NewContextManager(clients map[string]*mcp.MCPClient) *ContextManager {
	return &ContextManager{
		mcpClients: clients,
	}
}

// EnrichRequest adds conversation history and similar context to messages
func (cm *ContextManager) EnrichRequest(
	ctx context.Context,
	messages []backends.ChatMessage,
	role string,
	conversationID string,
) ([]backends.ChatMessage, error) {
	enrichedMessages := make([]backends.ChatMessage, 0)

	// Get context-persistence client
	contextClient, ok := cm.mcpClients["context-persistence"]
	if !ok || contextClient == nil {
		log.Println("[WARN] Context-persistence MCP client not available, skipping enrichment")
		return messages, nil
	}

	// Load conversation history
	if conversationID != "" {
		history, err := cm.loadConversationHistory(ctx, contextClient, conversationID)
		if err != nil {
			log.Printf("[WARN] Failed to load conversation history: %v", err)
		} else if len(history) > 0 {
			enrichedMessages = append(enrichedMessages, history...)
			log.Printf("[INFO] Added %d messages from conversation history", len(history))
		}
	}

	// Search for similar conversations
	if len(messages) > 0 {
		lastUserMessage := cm.getLastUserMessage(messages)
		if lastUserMessage != "" {
			similar, err := cm.searchSimilarConversations(ctx, contextClient, lastUserMessage)
			if err != nil {
				log.Printf("[WARN] Failed to search similar conversations: %v", err)
			} else if len(similar) > 0 {
				// Add similar conversations as context
				contextMsg := cm.buildSimilarContext(similar)
				enrichedMessages = append(enrichedMessages, backends.ChatMessage{
					Role:    "system",
					Content: contextMsg,
				})
				log.Printf("[INFO] Added %d similar conversations as context", len(similar))
			}
		}
	}

	// Add original messages
	enrichedMessages = append(enrichedMessages, messages...)

	return enrichedMessages, nil
}

// loadConversationHistory retrieves past messages from a conversation
func (cm *ContextManager) loadConversationHistory(
	ctx context.Context,
	client *mcp.MCPClient,
	conversationID string,
) ([]backends.ChatMessage, error) {
	result, err := client.CallTool(ctx, "load_conversation_history", map[string]interface{}{
		"conversation_id": conversationID,
		"limit":           10,
	})
	if err != nil {
		return nil, err
	}

	// Parse result
	var response struct {
		Content []struct {
			Type string `json:"type"`
			Text string `json:"text"`
		} `json:"content"`
	}

	if err := json.Unmarshal(result, &response); err != nil {
		return nil, fmt.Errorf("failed to parse history response: %w", err)
	}

	// Extract messages from response
	// Note: This is simplified - actual implementation depends on MCP server response format
	var messages []backends.ChatMessage
	for _, content := range response.Content {
		if content.Type == "text" {
			// Parse text content as JSON array of messages
			var historyMessages []backends.ChatMessage
			if err := json.Unmarshal([]byte(content.Text), &historyMessages); err == nil {
				messages = append(messages, historyMessages...)
			}
		}
	}

	return messages, nil
}

// searchSimilarConversations finds conversations similar to the current query
func (cm *ContextManager) searchSimilarConversations(
	ctx context.Context,
	client *mcp.MCPClient,
	query string,
) ([]map[string]interface{}, error) {
	result, err := client.CallTool(ctx, "search_similar_conversations", map[string]interface{}{
		"query": query,
		"limit": 3,
	})
	if err != nil {
		return nil, err
	}

	// Parse result
	var response struct {
		Content []struct {
			Type string `json:"type"`
			Text string `json:"text"`
		} `json:"content"`
	}

	if err := json.Unmarshal(result, &response); err != nil {
		return nil, fmt.Errorf("failed to parse similar conversations response: %w", err)
	}

	// Extract similar conversations
	var similar []map[string]interface{}
	for _, content := range response.Content {
		if content.Type == "text" {
			var conversations []map[string]interface{}
			if err := json.Unmarshal([]byte(content.Text), &conversations); err == nil {
				similar = append(similar, conversations...)
			}
		}
	}

	return similar, nil
}

// getLastUserMessage extracts the last user message from the conversation
func (cm *ContextManager) getLastUserMessage(messages []backends.ChatMessage) string {
	for i := len(messages) - 1; i >= 0; i-- {
		if messages[i].Role == "user" {
			return messages[i].Content
		}
	}
	return ""
}

// buildSimilarContext creates a context message from similar conversations
func (cm *ContextManager) buildSimilarContext(similar []map[string]interface{}) string {
	context := "Relevant past conversations:\n\n"

	for i, conv := range similar {
		if i >= 3 { // Limit to top 3
			break
		}

		summary, _ := conv["summary"].(string)
		if summary != "" {
			context += fmt.Sprintf("%d. %s\n", i+1, summary)
		}
	}

	context += "\nUse these past conversations to inform your response if relevant."
	return context
}

// SaveConversation saves the current conversation to persistence
func (cm *ContextManager) SaveConversation(
	ctx context.Context,
	conversationID string,
	messages []backends.ChatMessage,
) error {
	contextClient, ok := cm.mcpClients["context-persistence"]
	if !ok || contextClient == nil {
		return fmt.Errorf("context-persistence client not available")
	}

	// Convert messages to JSON
	messagesJSON, err := json.Marshal(messages)
	if err != nil {
		return fmt.Errorf("failed to marshal messages: %w", err)
	}

	// Call save_conversation tool
	_, err = contextClient.CallTool(ctx, "save_conversation", map[string]interface{}{
		"conversation_id": conversationID,
		"messages":        string(messagesJSON),
	})

	if err != nil {
		return fmt.Errorf("failed to save conversation: %w", err)
	}

	return nil
}
