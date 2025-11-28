package backends

import (
	"context"
	"fmt"
	"time"

	aiplatform "cloud.google.com/go/aiplatform/apiv1"
	"cloud.google.com/go/aiplatform/apiv1/aiplatformpb"
	"google.golang.org/api/option"
	"google.golang.org/protobuf/types/known/structpb"
)

// VertexBackend implements the Backend interface for Google Vertex AI
type VertexBackend struct {
	projectID  string
	location   string
	client     *aiplatform.PredictionClient
}

// NewVertexBackend creates a new Vertex AI backend
func NewVertexBackend(projectID, location string) (*VertexBackend, error) {
	ctx := context.Background()

	// Create prediction client
	client, err := aiplatform.NewPredictionClient(ctx, option.WithEndpoint(location+"-aiplatform.googleapis.com:443"))
	if err != nil {
		return nil, fmt.Errorf("failed to create vertex client: %w", err)
	}

	return &VertexBackend{
		projectID: projectID,
		location:  location,
		client:    client,
	}, nil
}

// ChatCompletion sends a chat completion request to Vertex AI
func (v *VertexBackend) ChatCompletion(ctx context.Context, req ChatRequest) (*ChatResponse, error) {
	// Map model name to Vertex AI endpoint
	modelName := v.mapModelName(req.Model)
	endpoint := fmt.Sprintf("projects/%s/locations/%s/publishers/google/models/%s",
		v.projectID, v.location, modelName)

	// Convert messages to Vertex AI format
	// Note: Vertex AI has a different message format than OpenAI
	// This is a simplified conversion
	var contents []*aiplatformpb.Content
	for _, msg := range req.Messages {
		role := msg.Role
		if role == "system" {
			role = "user" // Vertex treats system messages as user messages
		}

		contents = append(contents, &aiplatformpb.Content{
			Role: role,
			Parts: []*aiplatformpb.Part{
				{
					Data: &aiplatformpb.Part_Text{
						Text: msg.Content,
					},
				},
			},
		})
	}

	// Build prediction request
	predReq := &aiplatformpb.PredictRequest{
		Endpoint: endpoint,
		Instances: []*structpb.Value{
			// Vertex AI expects specific format per model
			// This is a placeholder - actual implementation depends on model
		},
	}

	// Send request
	resp, err := v.client.Predict(ctx, predReq)
	if err != nil {
		return nil, fmt.Errorf("vertex prediction failed: %w", err)
	}

	// Convert Vertex response to OpenAI format
	// This is a simplified conversion
	chatResp := &ChatResponse{
		ID:      fmt.Sprintf("vertex-%d", time.Now().Unix()),
		Object:  "chat.completion",
		Created: time.Now().Unix(),
		Model:   req.Model,
		Choices: []Choice{
			{
				Index: 0,
				Message: ChatMessage{
					Role:    "assistant",
					Content: v.extractContent(resp.Predictions),
				},
				FinishReason: "stop",
			},
		},
		Usage: TokenUsage{
			// Vertex doesn't provide token counts directly
			PromptTokens:     0,
			CompletionTokens: 0,
			TotalTokens:      0,
		},
	}

	return chatResp, nil
}

// ListModels returns available models from Vertex AI
func (v *VertexBackend) ListModels(ctx context.Context) ([]Model, error) {
	// Vertex AI model list
	models := []Model{
		{
			ID:      "gemini-2.0-flash",
			Object:  "model",
			Created: time.Now().Unix(),
			OwnedBy: "google",
		},
		{
			ID:      "gemini-2.5-pro",
			Object:  "model",
			Created: time.Now().Unix(),
			OwnedBy: "google",
		},
		{
			ID:      "gemini-1.5-pro",
			Object:  "model",
			Created: time.Now().Unix(),
			OwnedBy: "google",
		},
	}
	return models, nil
}

// Name returns the backend name
func (v *VertexBackend) Name() string {
	return "vertex"
}

// Tier returns the backend tier
func (v *VertexBackend) Tier() string {
	return "enterprise"
}

// HasModel checks if a model is available in Vertex AI
func (v *VertexBackend) HasModel(modelID string) bool {
	supportedModels := map[string]bool{
		"gemini-2.0-flash":   true,
		"gemini-2.5-pro":     true,
		"gemini-1.5-pro":     true,
		"gemini-1.5-flash":   true,
	}
	return supportedModels[modelID]
}

// GetUsage returns usage statistics (Vertex has different quota model)
func (v *VertexBackend) GetUsage() (*Usage, error) {
	// Vertex AI uses per-request quotas, not monthly tokens
	return &Usage{
		TokensUsed:      0,
		TokensRemaining: -1, // Unlimited in enterprise
		TokensLimit:     -1,
		ResetDate:       time.Time{},
	}, nil
}

// Helper methods

func (v *VertexBackend) mapModelName(openaiModel string) string {
	// Map OpenAI-style model names to Vertex AI model names
	mapping := map[string]string{
		"gemini-2.0-flash": "gemini-2.0-flash-001",
		"gemini-2.5-pro":   "gemini-2.5-pro-002",
		"gemini-1.5-pro":   "gemini-1.5-pro-001",
	}
	if vertexName, ok := mapping[openaiModel]; ok {
		return vertexName
	}
	return openaiModel
}

func (v *VertexBackend) extractContent(predictions []*structpb.Value) string {
	// Extract text content from Vertex AI predictions
	// This is a placeholder - actual implementation depends on model response format
	if len(predictions) > 0 {
		// Extract text from the first prediction
		return "Response from Vertex AI"
	}
	return ""
}
