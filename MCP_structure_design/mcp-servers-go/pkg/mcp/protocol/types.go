// Package protocol provides MCP (Model Context Protocol) message types and protocol implementation
package protocol

import (
	"encoding/json"
	"fmt"
	"time"
)

// JSONRPCVersion represents the JSON-RPC version
const JSONRPCVersion = "2.0"

// MCPVersion represents the MCP protocol version
const MCPVersion = "2024-11-05"

// Message types for MCP protocol
const (
	MessageTypeRequest  = "request"
	MessageTypeResponse = "response"
	MessageTypeNotification = "notification"
)

// Request represents a JSON-RPC request
type Request struct {
	JSONRPC string          `json:"jsonrpc"`
	ID      interface{}     `json:"id,omitempty"`
	Method  string          `json:"method"`
	Params  json.RawMessage `json:"params,omitempty"`
}

// Response represents a JSON-RPC response
type Response struct {
	JSONRPC string          `json:"jsonrpc"`
	ID      interface{}     `json:"id"`
	Result  json.RawMessage `json:"result,omitempty"`
	Error   *Error          `json:"error,omitempty"`
}

// Error represents a JSON-RPC error
type Error struct {
	Code    int             `json:"code"`
	Message string          `json:"message"`
	Data    json.RawMessage `json:"data,omitempty"`
}

// Notification represents a JSON-RPC notification (request without ID)
type Notification struct {
	JSONRPC string          `json:"jsonrpc"`
	Method  string          `json:"method"`
	Params  json.RawMessage `json:"params,omitempty"`
}

// Error codes as defined by JSON-RPC 2.0 and MCP
const (
	ParseErrorCode     = -32700
	InvalidRequestCode = -32600
	MethodNotFoundCode = -32601
	InvalidParamsCode  = -32602
	InternalErrorCode  = -32603
)

// MCP-specific error codes
const (
	InvalidParamsCodeMCP = -32000
	InvalidResultCodeMCP = -32001
)

// NewError creates a new JSON-RPC error
func NewError(code int, message string, data interface{}) *Error {
	err := &Error{
		Code:    code,
		Message: message,
	}
	if data != nil {
		dataBytes, _ := json.Marshal(data)
		err.Data = dataBytes
	}
	return err
}

// NewParseError creates a parse error
func NewParseError(data interface{}) *Error {
	return NewError(ParseErrorCode, "Parse error", data)
}

// NewInvalidRequestError creates an invalid request error
func NewInvalidRequestError(data interface{}) *Error {
	return NewError(InvalidRequestCode, "Invalid request", data)
}

// NewMethodNotFoundError creates a method not found error
func NewMethodNotFoundError(method string) *Error {
	return NewError(MethodNotFoundCode, fmt.Sprintf("Method not found: %s", method), nil)
}

// NewInvalidParamsError creates an invalid params error
func NewInvalidParamsError(data interface{}) *Error {
	return NewError(InvalidParamsCode, "Invalid params", data)
}

// NewInternalError creates an internal error
func NewInternalError(data interface{}) *Error {
	return NewError(InternalErrorCode, "Internal error", data)
}

// MCP Protocol Messages

// InitializeRequest represents the initialize request
type InitializeRequest struct {
	ProtocolVersion string                 `json:"protocolVersion"`
	Capabilities    ClientCapabilities     `json:"capabilities"`
	ClientInfo      Implementation         `json:"clientInfo"`
}

// InitializeResponse represents the initialize response
type InitializeResponse struct {
	ProtocolVersion string                 `json:"protocolVersion"`
	Capabilities    ServerCapabilities     `json:"capabilities"`
	ServerInfo      Implementation         `json:"serverInfo"`
}

// ClientCapabilities represents client capabilities
type ClientCapabilities struct {
	Experimental map[string]interface{} `json:"experimental,omitempty"`
}

// ServerCapabilities represents server capabilities
type ServerCapabilities struct {
	Tools *ToolsCapability `json:"tools,omitempty"`
	Experimental map[string]interface{} `json:"experimental,omitempty"`
}

// ToolsCapability represents tools capability
type ToolsCapability struct {
	ListChanged bool `json:"listChanged,omitempty"`
}

// Implementation represents client/server implementation info
type Implementation struct {
	Name    string `json:"name"`
	Version string `json:"version"`
}

// Tool represents an MCP tool
type Tool struct {
	Name        string                 `json:"name"`
	Description string                 `json:"description"`
	InputSchema map[string]interface{} `json:"inputSchema"`
}

// CallToolRequest represents a tool call request
type CallToolRequest struct {
	Name      string                 `json:"name"`
	Arguments map[string]interface{} `json:"arguments,omitempty"`
}

// CallToolResult represents a tool call result
type CallToolResult struct {
	Content []Content `json:"content"`
	IsError bool      `json:"isError,omitempty"`
}

// Content represents content in a result
type Content struct {
	Type string `json:"type"`
	Text string `json:"text,omitempty"`
}

// ListToolsResult represents the result of listing tools
type ListToolsResult struct {
	Tools []Tool `json:"tools"`
}

// Progress notification
type ProgressNotification struct {
	ProgressToken interface{} `json:"progressToken"`
	Progress      float64     `json:"progress"`
	Total         float64     `json:"total,omitempty"`
}

// Logging message
type LoggingMessageNotification struct {
	Level   string      `json:"level"`
	Data    interface{} `json:"data"`
	Logger  string      `json:"logger,omitempty"`
}

// Log levels
const (
	LogLevelDebug = "debug"
	LogLevelInfo  = "info"
	LogLevelWarn  = "warn"
	LogLevelError = "error"
)

// Resource messages
type ResourceContents struct {
	URI      string `json:"uri"`
	MIMEType string `json:"mimeType,omitempty"`
	Text     string `json:"text,omitempty"`
	Blob     string `json:"blob,omitempty"`
}

// Prompt messages
type PromptMessage struct {
	Role    string      `json:"role"`
	Content interface{} `json:"content"`
}

// Completion request
type CompleteRequest struct {
	Ref      interface{} `json:"ref"`
	Argument map[string]interface{} `json:"argument"`
}

// Completion result
type CompleteResult struct {
	Completion *Completion `json:"completion"`
}

// Completion represents completion options
type Completion struct {
	Values  []string `json:"values"`
	Total   int      `json:"total,omitempty"`
	HasMore bool     `json:"hasMore,omitempty"`
}

// Ping request (for connection testing)
type PingRequest struct{}

// Ping response
type PingResponse struct{}

// Message represents a generic MCP message
type Message struct {
	ID        interface{}     `json:"id,omitempty"`
	JSONRPC   string          `json:"jsonrpc"`
	Method    string          `json:"method,omitempty"`
	Params    json.RawMessage `json:"params,omitempty"`
	Result    json.RawMessage `json:"result,omitempty"`
	Error     *Error          `json:"error,omitempty"`
	Timestamp time.Time       `json:"timestamp,omitempty"`
}

// NewRequest creates a new JSON-RPC request
func NewRequest(id interface{}, method string, params interface{}) (*Request, error) {
	req := &Request{
		JSONRPC: JSONRPCVersion,
		ID:      id,
		Method:  method,
	}
	
	if params != nil {
		paramsBytes, err := json.Marshal(params)
		if err != nil {
			return nil, fmt.Errorf("failed to marshal params: %w", err)
		}
		req.Params = paramsBytes
	}
	
	return req, nil
}

// NewResponse creates a new JSON-RPC response
func NewResponse(id interface{}, result interface{}) (*Response, error) {
	resp := &Response{
		JSONRPC: JSONRPCVersion,
		ID:      id,
	}
	
	if result != nil {
		resultBytes, err := json.Marshal(result)
		if err != nil {
			return nil, fmt.Errorf("failed to marshal result: %w", err)
		}
		resp.Result = resultBytes
	}
	
	return resp, nil
}

// NewNotification creates a new JSON-RPC notification
func NewNotification(method string, params interface{}) (*Notification, error) {
	notif := &Notification{
		JSONRPC: JSONRPCVersion,
		Method:  method,
	}
	
	if params != nil {
		paramsBytes, err := json.Marshal(params)
		if err != nil {
			return nil, fmt.Errorf("failed to marshal params: %w", err)
		}
		notif.Params = paramsBytes
	}
	
	return notif, nil
}

// ParseMessage parses a raw JSON message into a Message struct
func ParseMessage(data []byte) (*Message, error) {
	var msg Message
	if err := json.Unmarshal(data, &msg); err != nil {
		return nil, fmt.Errorf("failed to parse message: %w", err)
	}
	msg.Timestamp = time.Now()
	return &msg, nil
}

// IsRequest returns true if the message is a request
func (m *Message) IsRequest() bool {
	return m.Method != "" && m.ID != nil && m.Error == nil
}

// IsResponse returns true if the message is a response
func (m *Message) IsResponse() bool {
	return m.ID != nil && (m.Result != nil || m.Error != nil) && m.Method == ""
}

// IsNotification returns true if the message is a notification
func (m *Message) IsNotification() bool {
	return m.Method != "" && m.ID == nil
}