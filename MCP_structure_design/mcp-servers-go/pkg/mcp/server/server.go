// Package server provides the MCP (Model Context Protocol) server framework
package server

import (
	"bufio"
	"context"
	"encoding/json"
	"fmt"
	"io"
	"log"
	"os"
	"sync"

	"github.com/ceverson/mcp-advanced-multi-agent-ecosystem/pkg/mcp/protocol"
)

// Server represents an MCP server
type Server struct {
	name         string
	version      string
	capabilities *Capabilities
	tools        map[string]*Tool
	toolsMu      sync.RWMutex
}

// Capabilities represents server capabilities
type Capabilities struct {
	Tools *ToolsCapability `json:"tools,omitempty"`
}

// ToolsCapability represents tools capability
type ToolsCapability struct {
	ListChanged bool `json:"listChanged,omitempty"`
}

// Tool represents a registered tool
type Tool struct {
	Name        string
	Description string
	Handler     ToolHandler
	InputSchema map[string]interface{}
}

// ToolHandler is the function signature for tool handlers
type ToolHandler func(ctx context.Context, args map[string]interface{}) (*protocol.CallToolResult, error)

// NewServer creates a new MCP server
func NewServer(name, version string, capabilities *Capabilities) *Server {
	if capabilities == nil {
		capabilities = &Capabilities{}
	}

	return &Server{
		name:         name,
		version:      version,
		capabilities: capabilities,
		tools:        make(map[string]*Tool),
	}
}

// RegisterTool registers a new tool with the server
func (s *Server) RegisterTool(name string, tool *Tool) {
	s.toolsMu.Lock()
	defer s.toolsMu.Unlock()

	tool.Name = name
	s.tools[name] = tool
	log.Printf("Registered tool: %s", name)
}

// GetTool returns a tool by name
func (s *Server) GetTool(name string) (*Tool, bool) {
	s.toolsMu.RLock()
	defer s.toolsMu.RUnlock()

	tool, ok := s.tools[name]
	return tool, ok
}

// ListTools returns all registered tools
func (s *Server) ListTools() []protocol.Tool {
	s.toolsMu.RLock()
	defer s.toolsMu.RUnlock()

	tools := make([]protocol.Tool, 0, len(s.tools))
	for _, tool := range s.tools {
		tools = append(tools, protocol.Tool{
			Name:        tool.Name,
			Description: tool.Description,
			InputSchema: tool.InputSchema,
		})
	}
	return tools
}

// Run starts the MCP server
func (s *Server) Run(ctx context.Context, stdin io.Reader, stdout io.Writer) error {
	log.Printf("Starting MCP server: %s v%s", s.name, s.version)

	// Handle incoming messages
	scanner := bufio.NewScanner(stdin)
	for scanner.Scan() {
		select {
		case <-ctx.Done():
			return ctx.Err()
		default:
		}

		line := scanner.Bytes()
		if len(line) == 0 {
			continue
		}

		// Parse the message
		var msg protocol.Message
		if err := json.Unmarshal(line, &msg); err != nil {
			log.Printf("Failed to parse message: %v", err)
			s.sendError(stdout, nil, protocol.NewParseError(err.Error()))
			continue
		}

		// Handle the message
		response, err := s.handleMessage(ctx, &msg)
		if err != nil {
			log.Printf("Error handling message: %v", err)
			s.sendError(stdout, msg.ID, protocol.NewInternalError(err.Error()))
			continue
		}

		// Send response if it's a request
		if msg.IsRequest() && response != nil {
			if err := s.sendResponse(stdout, response); err != nil {
				log.Printf("Failed to send response: %v", err)
			}
		}
	}

	if err := scanner.Err(); err != nil {
		return fmt.Errorf("scanner error: %w", err)
	}

	return nil
}

// handleMessage handles an incoming MCP message
func (s *Server) handleMessage(ctx context.Context, msg *protocol.Message) (*protocol.Response, error) {
	// Check if this is a notification (no ID)
	if msg.IsNotification() {
		return s.handleNotification(ctx, msg)
	}

	// Handle regular requests
	switch {
	case msg.Method == "initialize":
		return s.handleInitialize(msg)
	case msg.Method == "tools/list":
		return s.handleToolsList(msg)
	case msg.Method == "tools/call":
		return s.handleToolsCall(ctx, msg)
	case msg.Method == "ping":
		return s.handlePing(msg)
	default:
		return nil, fmt.Errorf("unknown method: %s", msg.Method)
	}
}

// handleNotification handles MCP notification messages (requests without IDs)
func (s *Server) handleNotification(ctx context.Context, msg *protocol.Message) (*protocol.Response, error) {
	// Notifications don't require responses, but we should handle known ones
	switch msg.Method {
	case "notifications/cancelled":
		// Handle cancellation notification - log it but don't error
		log.Printf("[INFO] Received cancellation notification for request")
		return nil, nil // Notifications don't send responses
	case "notifications/progress":
		// Progress notifications are typically server->client, but handle if client sends
		log.Printf("[INFO] Received progress notification")
		return nil, nil
	case "notifications/message":
		// Message notifications are typically server->client, but handle if client sends
		log.Printf("[INFO] Received message notification")
		return nil, nil
	default:
		// For unknown notifications, log but don't error - notifications are optional
		log.Printf("[DEBUG] Received unknown notification: %s", msg.Method)
		return nil, nil
	}
}

// handleInitialize handles the initialize request
func (s *Server) handleInitialize(msg *protocol.Message) (*protocol.Response, error) {
	var params protocol.InitializeRequest
	if err := json.Unmarshal(msg.Params, &params); err != nil {
		return nil, fmt.Errorf("failed to unmarshal initialize params: %w", err)
	}

	log.Printf("Client initialized: %s v%s", params.ClientInfo.Name, params.ClientInfo.Version)

	response := protocol.InitializeResponse{
		ProtocolVersion: protocol.MCPVersion,
		Capabilities: protocol.ServerCapabilities{
			Tools: &protocol.ToolsCapability{
				ListChanged: s.capabilities.Tools != nil && s.capabilities.Tools.ListChanged,
			},
		},
		ServerInfo: protocol.Implementation{
			Name:    s.name,
			Version: s.version,
		},
	}

	return protocol.NewResponse(msg.ID, response)
}

// handleToolsList handles the tools/list request
func (s *Server) handleToolsList(msg *protocol.Message) (*protocol.Response, error) {
	tools := s.ListTools()
	response := protocol.ListToolsResult{
		Tools: tools,
	}

	return protocol.NewResponse(msg.ID, response)
}

// handleToolsCall handles the tools/call request
func (s *Server) handleToolsCall(ctx context.Context, msg *protocol.Message) (*protocol.Response, error) {
	var params protocol.CallToolRequest
	if err := json.Unmarshal(msg.Params, &params); err != nil {
		return nil, fmt.Errorf("failed to unmarshal call tool params: %w", err)
	}

	// Get the tool
	tool, ok := s.GetTool(params.Name)
	if !ok {
		return nil, fmt.Errorf("tool not found: %s", params.Name)
	}

	// Call the tool handler
	result, err := tool.Handler(ctx, params.Arguments)
	if err != nil {
		errorResponse := protocol.NewError(protocol.InternalErrorCode, err.Error(), nil)
		return &protocol.Response{
			JSONRPC: protocol.JSONRPCVersion,
			ID:      msg.ID,
			Error:   errorResponse,
		}, nil
	}

	return protocol.NewResponse(msg.ID, result)
}

// handlePing handles the ping request
func (s *Server) handlePing(msg *protocol.Message) (*protocol.Response, error) {
	return protocol.NewResponse(msg.ID, protocol.PingResponse{})
}

// sendResponse sends a response to stdout
func (s *Server) sendResponse(stdout io.Writer, response *protocol.Response) error {
	data, err := json.Marshal(response)
	if err != nil {
		return fmt.Errorf("failed to marshal response: %w", err)
	}

	// Add newline for stdio transport
	data = append(data, '\n')

	if _, err := stdout.Write(data); err != nil {
		return fmt.Errorf("failed to write response: %w", err)
	}

	return nil
}

// sendError sends an error response to stdout
func (s *Server) sendError(stdout io.Writer, id interface{}, err *protocol.Error) error {
	response := &protocol.Response{
		JSONRPC: protocol.JSONRPCVersion,
		ID:      id,
		Error:   err,
	}

	data, errMarshal := json.Marshal(response)
	if errMarshal != nil {
		return fmt.Errorf("failed to marshal error response: %w", errMarshal)
	}

	// Add newline for stdio transport
	data = append(data, '\n')

	if _, err := stdout.Write(data); err != nil {
		return fmt.Errorf("failed to write error response: %w", err)
	}

	return nil
}

// RunStdioServer is a convenience function to run a server with stdio
func RunStdioServer(ctx context.Context, server *Server) error {
	return server.Run(ctx, os.Stdin, os.Stdout)
}