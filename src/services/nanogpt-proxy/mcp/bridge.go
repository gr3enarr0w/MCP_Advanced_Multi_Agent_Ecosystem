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
	"time"
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

	// Enhanced logging: Log environment variables
	log.Printf("[DEBUG] MCP Client '%s' environment setup:", c.serverName)
	if c.env != nil {
		for key, value := range c.env {
			log.Printf("[DEBUG]   ENV %s=%s", key, value)
		}
	} else {
		log.Printf("[DEBUG]   No environment variables set")
	}

	// Create command
	log.Printf("[DEBUG] Creating MCP command: %s %v", c.command, c.args)
	c.process = exec.CommandContext(ctx, c.command, c.args...)

	// Set environment variables
	if c.env != nil {
		for key, value := range c.env {
			c.process.Env = append(c.process.Env, fmt.Sprintf("%s=%s", key, value))
		}
	}

	// Setup stdio pipes
	var err error
	log.Printf("[DEBUG] Setting up stdio pipes for '%s'", c.serverName)
	c.stdin, err = c.process.StdinPipe()
	if err != nil {
		log.Printf("[ERROR] Failed to create stdin pipe for '%s': %v", c.serverName, err)
		return fmt.Errorf("failed to create stdin pipe: %w", err)
	}

	c.stdout, err = c.process.StdoutPipe()
	if err != nil {
		log.Printf("[ERROR] Failed to create stdout pipe for '%s': %v", c.serverName, err)
		return fmt.Errorf("failed to create stdout pipe: %w", err)
	}

	c.stderr, err = c.process.StderrPipe()
	if err != nil {
		log.Printf("[ERROR] Failed to create stderr pipe for '%s': %v", c.serverName, err)
		return fmt.Errorf("failed to create stderr pipe: %w", err)
	}
	log.Printf("[DEBUG] Stdio pipes created successfully for '%s'", c.serverName)

	// Start process
	log.Printf("[DEBUG] Starting MCP server '%s' with command: %s %v", c.serverName, c.command, c.args)
	if err := c.process.Start(); err != nil {
		log.Printf("[ERROR] Failed to start MCP server '%s': %v", c.serverName, err)
		return fmt.Errorf("failed to start MCP server: %w", err)
	}
	log.Printf("[DEBUG] MCP server '%s' process started with PID: %d", c.serverName, c.process.Process.Pid)

	// Enhanced logging: Check if process is still alive after startup
	go func() {
		time.Sleep(100 * time.Millisecond)
		if c.process != nil && c.process.ProcessState != nil && c.process.ProcessState.Exited() {
			log.Printf("[ERROR] MCP server '%s' exited immediately with code: %d", c.serverName, c.process.ProcessState.ExitCode())
		} else {
			log.Printf("[DEBUG] MCP server '%s' process is still running after startup", c.serverName)
		}
	}()

	// Start response readers
	log.Printf("[DEBUG] Starting response readers for '%s'", c.serverName)
	go c.readResponses()
	go c.readErrors()

	// Send initialization request with timeout
	log.Printf("[DEBUG] Attempting to initialize MCP connection to '%s' with 10-second timeout", c.serverName)
	
	// Create timeout context
	initCtx, cancel := context.WithTimeout(ctx, 10*time.Second)
	defer cancel()
	
	if err := c.initialize(initCtx); err != nil {
		log.Printf("[ERROR] Failed to initialize MCP connection to '%s': %v", c.serverName, err)
		if initCtx.Err() == context.DeadlineExceeded {
			log.Printf("[ERROR] MCP initialization to '%s' timed out after 10 seconds", c.serverName)
		}
		c.Close()
		return fmt.Errorf("failed to initialize MCP connection: %w", err)
	}
	log.Printf("[DEBUG] MCP connection to '%s' initialized successfully", c.serverName)

	c.connected = true
	log.Printf("[INFO] MCP client connected to %s", c.serverName)

	return nil
}

// initialize sends the MCP initialize request
func (c *MCPClient) initialize(ctx context.Context) error {
	log.Printf("[DEBUG] Preparing MCP initialize request for '%s'", c.serverName)
	
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

	log.Printf("[DEBUG] Sending MCP initialize request to '%s' (ID: %d)", c.serverName, req.ID)
	log.Printf("[DEBUG] Request details: protocolVersion=%s, clientInfo=%s",
		req.Params.(map[string]interface{})["protocolVersion"], req.Params.(map[string]interface{})["clientInfo"])
	
	resp, err := c.sendRequest(ctx, &req)
	if err != nil {
		log.Printf("[ERROR] Failed to send initialize request to '%s': %v", c.serverName, err)
		return err
	}

	log.Printf("[DEBUG] Received initialize response from '%s'", c.serverName)
	if resp.Error != nil {
		log.Printf("[ERROR] MCP initialization failed for '%s': %s (code: %d)",
			c.serverName, resp.Error.Message, resp.Error.Code)
		return fmt.Errorf("initialization failed: %s", resp.Error.Message)
	}

	log.Printf("[DEBUG] MCP initialization successful for '%s'", c.serverName)
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
	log.Printf("[DEBUG] Sending MCP request to '%s': method=%s, id=%d", c.serverName, req.Method, req.ID)
	
	// Create response channel
	respChan := make(chan *MCPResponse, 1)
	c.responseMu.Lock()
	c.responses[req.ID] = respChan
	c.responseMu.Unlock()
	log.Printf("[DEBUG] Registered response channel for request ID %d", req.ID)

	// Clean up after response
	defer func() {
		c.responseMu.Lock()
		delete(c.responses, req.ID)
		c.responseMu.Unlock()
		close(respChan)
		log.Printf("[DEBUG] Cleaned up response channel for request ID %d", req.ID)
	}()

	// Send request
	data, err := json.Marshal(req)
	if err != nil {
		log.Printf("[ERROR] Failed to marshal MCP request for '%s': %v", c.serverName, err)
		return nil, fmt.Errorf("failed to marshal request: %w", err)
	}

	log.Printf("[DEBUG] Sending JSON-RPC request to '%s': %s", c.serverName, string(data))
	if _, err := c.stdin.Write(append(data, '\n')); err != nil {
		log.Printf("[ERROR] Failed to write request to '%s' stdin: %v", c.serverName, err)
		return nil, fmt.Errorf("failed to write request: %w", err)
	}
	log.Printf("[DEBUG] Request sent successfully to '%s', waiting for response", c.serverName)

	// Wait for response or timeout
	select {
	case resp := <-respChan:
		log.Printf("[DEBUG] Received response from '%s' for request ID %d", c.serverName, req.ID)
		if resp.Error != nil {
			log.Printf("[DEBUG] Response contains error: %s (code: %d)", resp.Error.Message, resp.Error.Code)
		} else {
			log.Printf("[DEBUG] Response received successfully from '%s'", c.serverName)
		}
		return resp, nil
	case <-ctx.Done():
		log.Printf("[ERROR] Request timeout for '%s' (request ID %d)", c.serverName, req.ID)
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
	log.Printf("[DEBUG] Starting error reader for '%s'", c.serverName)
	scanner := bufio.NewScanner(c.stderr)
	for scanner.Scan() {
		log.Printf("[MCP %s STDERR] %s", c.serverName, scanner.Text())
	}
	if err := scanner.Err(); err != nil {
		log.Printf("[ERROR] MCP client %s stderr scanner error: %v", c.serverName, err)
	} else {
		log.Printf("[DEBUG] Error reader for '%s' finished normally", c.serverName)
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
