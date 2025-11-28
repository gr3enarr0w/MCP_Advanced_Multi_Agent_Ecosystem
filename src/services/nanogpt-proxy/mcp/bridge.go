package mcp

import (
	"bufio"
	"context"
	"encoding/json"
	"fmt"
	"io"
	"log"
	"os/exec"
	"sync"
	"sync/atomic"
)

// MCPClient implements an MCP client for connecting to MCP servers
type MCPClient struct {
	serverName string
	command    string
	args       []string
	env        map[string]string

	process *exec.Cmd
	stdin   io.WriteCloser
	stdout  io.ReadCloser
	stderr  io.ReadCloser

	requestID  atomic.Int64
	responses  map[int64]chan *MCPResponse
	responseMu sync.RWMutex

	connected bool
	mu        sync.Mutex
}

// MCPRequest represents an MCP protocol request
type MCPRequest struct {
	JSONRPC string      `json:"jsonrpc"`
	ID      int64       `json:"id"`
	Method  string      `json:"method"`
	Params  interface{} `json:"params,omitempty"`
}

// MCPResponse represents an MCP protocol response
type MCPResponse struct {
	JSONRPC string          `json:"jsonrpc"`
	ID      int64           `json:"id"`
	Result  json.RawMessage `json:"result,omitempty"`
	Error   *MCPError       `json:"error,omitempty"`
}

// MCPError represents an MCP protocol error
type MCPError struct {
	Code    int    `json:"code"`
	Message string `json:"message"`
	Data    interface{} `json:"data,omitempty"`
}

// NewMCPClient creates a new MCP client
func NewMCPClient(serverName, command string, args []string, env map[string]string) *MCPClient {
	return &MCPClient{
		serverName: serverName,
		command:    command,
		args:       args,
		env:        env,
		responses:  make(map[int64]chan *MCPResponse),
	}
}

// Connect starts the MCP server and establishes connection
func (c *MCPClient) Connect(ctx context.Context) error {
	c.mu.Lock()
	defer c.mu.Unlock()

	if c.connected {
		return nil
	}

	// Create command
	c.process = exec.CommandContext(ctx, c.command, c.args...)

	// Set environment variables
	if c.env != nil {
		for key, value := range c.env {
			c.process.Env = append(c.process.Env, fmt.Sprintf("%s=%s", key, value))
		}
	}

	// Setup stdio pipes
	var err error
	c.stdin, err = c.process.StdinPipe()
	if err != nil {
		return fmt.Errorf("failed to create stdin pipe: %w", err)
	}

	c.stdout, err = c.process.StdoutPipe()
	if err != nil {
		return fmt.Errorf("failed to create stdout pipe: %w", err)
	}

	c.stderr, err = c.process.StderrPipe()
	if err != nil {
		return fmt.Errorf("failed to create stderr pipe: %w", err)
	}

	// Start process
	if err := c.process.Start(); err != nil {
		return fmt.Errorf("failed to start MCP server: %w", err)
	}

	// Start response reader
	go c.readResponses()
	go c.readErrors()

	// Send initialization request
	if err := c.initialize(ctx); err != nil {
		c.Close()
		return fmt.Errorf("failed to initialize MCP connection: %w", err)
	}

	c.connected = true
	log.Printf("[INFO] MCP client connected to %s", c.serverName)

	return nil
}

// initialize sends the MCP initialize request
func (c *MCPClient) initialize(ctx context.Context) error {
	req := MCPRequest{
		JSONRPC: "2.0",
		ID:      c.requestID.Add(1),
		Method:  "initialize",
		Params: map[string]interface{}{
			"protocolVersion": "2024-11-05",
			"capabilities":    map[string]interface{}{},
			"clientInfo": map[string]string{
				"name":    "nanogpt-proxy",
				"version": "1.0.0",
			},
		},
	}

	resp, err := c.sendRequest(ctx, &req)
	if err != nil {
		return err
	}

	if resp.Error != nil {
		return fmt.Errorf("initialization failed: %s", resp.Error.Message)
	}

	return nil
}

// CallTool invokes an MCP tool
func (c *MCPClient) CallTool(ctx context.Context, toolName string, params map[string]interface{}) (json.RawMessage, error) {
	if !c.connected {
		if err := c.Connect(ctx); err != nil {
			return nil, fmt.Errorf("failed to connect: %w", err)
		}
	}

	req := MCPRequest{
		JSONRPC: "2.0",
		ID:      c.requestID.Add(1),
		Method:  "tools/call",
		Params: map[string]interface{}{
			"name":      toolName,
			"arguments": params,
		},
	}

	resp, err := c.sendRequest(ctx, &req)
	if err != nil {
		return nil, err
	}

	if resp.Error != nil {
		return nil, fmt.Errorf("tool call failed: %s", resp.Error.Message)
	}

	return resp.Result, nil
}

// sendRequest sends an MCP request and waits for response
func (c *MCPClient) sendRequest(ctx context.Context, req *MCPRequest) (*MCPResponse, error) {
	// Create response channel
	respChan := make(chan *MCPResponse, 1)
	c.responseMu.Lock()
	c.responses[req.ID] = respChan
	c.responseMu.Unlock()

	// Clean up after response
	defer func() {
		c.responseMu.Lock()
		delete(c.responses, req.ID)
		c.responseMu.Unlock()
		close(respChan)
	}()

	// Send request
	data, err := json.Marshal(req)
	if err != nil {
		return nil, fmt.Errorf("failed to marshal request: %w", err)
	}

	if _, err := c.stdin.Write(append(data, '\n')); err != nil {
		return nil, fmt.Errorf("failed to write request: %w", err)
	}

	// Wait for response or timeout
	select {
	case resp := <-respChan:
		return resp, nil
	case <-ctx.Done():
		return nil, ctx.Err()
	}
}

// readResponses reads responses from stdout
func (c *MCPClient) readResponses() {
	scanner := bufio.NewScanner(c.stdout)
	for scanner.Scan() {
		line := scanner.Bytes()

		var resp MCPResponse
		if err := json.Unmarshal(line, &resp); err != nil {
			log.Printf("[ERROR] Failed to parse MCP response from %s: %v", c.serverName, err)
			continue
		}

		// Send to appropriate channel
		c.responseMu.RLock()
		respChan, ok := c.responses[resp.ID]
		c.responseMu.RUnlock()

		if ok {
			respChan <- &resp
		}
	}

	if err := scanner.Err(); err != nil {
		log.Printf("[ERROR] MCP client %s stdout scanner error: %v", c.serverName, err)
	}
}

// readErrors reads errors from stderr
func (c *MCPClient) readErrors() {
	scanner := bufio.NewScanner(c.stderr)
	for scanner.Scan() {
		log.Printf("[MCP %s STDERR] %s", c.serverName, scanner.Text())
	}
}

// Close closes the MCP connection
func (c *MCPClient) Close() error {
	c.mu.Lock()
	defer c.mu.Unlock()

	if !c.connected {
		return nil
	}

	if c.stdin != nil {
		c.stdin.Close()
	}

	if c.process != nil {
		c.process.Process.Kill()
		c.process.Wait()
	}

	c.connected = false
	log.Printf("[INFO] MCP client disconnected from %s", c.serverName)

	return nil
}
