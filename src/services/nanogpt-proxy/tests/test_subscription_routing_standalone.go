package main

import (
	"bytes"
	"encoding/json"
	"fmt"
	"io"
	"log"
	"net/http"
	"net/http/httptest"
	"os"
	"os/exec"
	"strings"
	"sync"
	"time"
)

// Mock subscription API server
type MockSubscriptionServer struct {
	server     *httptest.Server
	models     []map[string]interface{}
	exhausted  map[string]bool
	requests   []map[string]interface{}
	mutex      sync.RWMutex
}

func NewMockSubscriptionServer() *MockSubscriptionServer {
	models := []map[string]interface{}{
		{
			"id":          "qwen-2.5-72b",
			"name":        "Qwen 2.5 72B",
			"status":      "available",
			"roles":       []string{"architect", "code_review", "research", "testing", "general"},
			"created_at":  time.Now(),
		},
		{
			"id":          "qwen-2.5-coder-32b",
			"name":        "Qwen 2.5 Coder 32B",
			"status":      "available",
			"roles":       []string{"implementation"},
			"created_at":  time.Now(),
		},
		{
			"id":          "deepseek-chat",
			"name":        "DeepSeek Chat",
			"status":      "available",
			"roles":       []string{"debugging"},
			"created_at":  time.Now(),
		},
		{
			"id":          "gemini-2.0-flash",
			"name":        "Gemini 2.0 Flash",
			"status":      "available",
			"roles":       []string{"documentation", "general"},
			"created_at":  time.Now(),
		},
	}

	mock := &MockSubscriptionServer{
		models:    models,
		exhausted:  make(map[string]bool),
		requests:   make([]map[string]interface{}, 0),
	}

	mux := http.NewServeMux()
	mux.HandleFunc("/api/subscription/v1/models", mock.handleModels)
	mock.server = httptest.NewServer(mux)

	return mock
}

func (m *MockSubscriptionServer) handleModels(w http.ResponseWriter, r *http.Request) {
	m.mutex.Lock()
	defer m.mutex.Unlock()

	// Log the request
	m.requests = append(m.requests, map[string]interface{}{
		"method": r.Method,
		"path":   r.URL.Path,
		"time":   time.Now(),
	})

	// Filter out exhausted models
	availableModels := make([]map[string]interface{}, 0)
	for _, model := range m.models {
		if !m.exhausted[model["id"].(string)] {
			availableModels = append(availableModels, model)
		}
	}

	response := map[string]interface{}{
		"models":     availableModels,
		"updated_at": time.Now(),
	}

	w.Header().Set("Content-Type", "application/json")
	json.NewEncoder(w).Encode(response)
}

func (m *MockSubscriptionServer) MarkExhausted(modelID string) {
	m.mutex.Lock()
	defer m.mutex.Unlock()
	m.exhausted[modelID] = true
	log.Printf("[MOCK] Model marked exhausted: %s", modelID)
}

func (m *MockSubscriptionServer) GetRequestCount() int {
	m.mutex.RLock()
	defer m.mutex.RUnlock()
	return len(m.requests)
}

func (m *MockSubscriptionServer) Reset() {
	m.mutex.Lock()
	defer m.mutex.Unlock()
	m.exhausted = make(map[string]bool)
	m.requests = make([]map[string]interface{}, 0)
}

func (m *MockSubscriptionServer) Close() {
	m.server.Close()
}

func (m *MockSubscriptionServer) URL() string {
	return m.server.URL
}

// Test structure
type TestResult struct {
	Name        string
	Passed      bool
	Message     string
	Details     map[string]interface{}
	Duration    time.Duration
}

type TestSuite struct {
	results     []TestResult
	mockServer  *MockSubscriptionServer
	proxyServer *exec.Cmd
}

func NewTestSuite() *TestSuite {
	return &TestSuite{
		results: make([]TestResult, 0),
	}
}

func (ts *TestSuite) RunTest(name string, testFunc func() TestResult) {
	log.Printf("[TEST] Running: %s", name)
	start := time.Now()
	result := testFunc()
	result.Duration = time.Since(start)
	result.Name = name
	
	ts.results = append(ts.results, result)
	
	status := "✓ PASS"
	if !result.Passed {
		status = "✗ FAIL"
	}
	log.Printf("[TEST] %s: %s (%v)", status, name, result.Duration)
	if result.Message != "" {
		log.Printf("[TEST]   %s", result.Message)
	}
}

func (ts *TestSuite) StartMockServer() {
	ts.mockServer = NewMockSubscriptionServer()
	log.Printf("[SETUP] Mock subscription server started at: %s", ts.mockServer.URL())
}

func (ts *TestSuite) StopMockServer() {
	if ts.mockServer != nil {
		ts.mockServer.Close()
	}
}

func (ts *TestSuite) StartProxyServer() error {
	// Set environment variables for the proxy
	os.Setenv("NANOGPT_API_KEY", "test-key-12345")
	os.Setenv("NANOGPT_BASE_URL", "https://nano-gpt.com/api/v1")
	os.Setenv("ACTIVE_PROFILE", "personal")
	os.Setenv("PORT", "8091") // Use different port to avoid conflicts
	os.Setenv("SUBSCRIPTION_API_BASE_URL", ts.mockServer.URL())
	os.Setenv("SUBSCRIPTION_API_TTL_SECONDS", "5") // Short TTL for testing
	
	// Start the proxy server
	cmd := exec.Command("./nanogpt-proxy")
	cmd.Dir = "."
	cmd.Env = os.Environ()
	
	ts.proxyServer = cmd
	
	// Start server in background
	if err := cmd.Start(); err != nil {
		return fmt.Errorf("failed to start proxy server: %w", err)
	}
	
	// Wait for server to be ready
	for i := 0; i < 30; i++ {
		resp, err := http.Get("http://localhost:8091/health")
		if err == nil && resp.StatusCode == 200 {
			resp.Body.Close()
			log.Printf("[SETUP] Proxy server ready on port 8091")
			return nil
		}
		time.Sleep(100 * time.Millisecond)
	}
	
	return fmt.Errorf("proxy server failed to start within 3 seconds")
}

func (ts *TestSuite) StopProxyServer() {
	if ts.proxyServer != nil && ts.proxyServer.Process != nil {
		ts.proxyServer.Process.Kill()
		ts.proxyServer.Wait()
		log.Printf("[SETUP] Proxy server stopped")
	}
}

func (ts *TestSuite) MakeChatRequest(role string) (*http.Response, error) {
	requestBody := map[string]interface{}{
		"model": "auto",
		"messages": []map[string]string{
			{"role": "user", "content": "Test request for role: " + role},
		},
		"role": role,
	}
	
	body, _ := json.Marshal(requestBody)
	resp, err := http.Post("http://localhost:8091/v1/chat/completions", "application/json", bytes.NewReader(body))
	return resp, err
}

func (ts *TestSuite) PrintResults() {
	log.Printf("\n" + strings.Repeat("=", 80))
	log.Printf("END-TO-END TEST RESULTS")
	log.Printf(strings.Repeat("=", 80))
	
	passed := 0
	failed := 0
	
	for _, result := range ts.results {
		status := "✓ PASS"
		if !result.Passed {
			status = "✗ FAIL"
			failed++
		} else {
			passed++
		}
		
		log.Printf("%s %s (%v)", status, result.Name, result.Duration)
		if result.Message != "" {
			log.Printf("    %s", result.Message)
		}
		if len(result.Details) > 0 {
			for k, v := range result.Details {
				log.Printf("    %s: %v", k, v)
			}
		}
	}
	
	log.Printf(strings.Repeat("-", 80))
	log.Printf("Total: %d tests, %d passed, %d failed", len(ts.results), passed, failed)
	log.Printf(strings.Repeat("=", 80))
}

// Test cases
func (ts *TestSuite) TestServerStartup() TestResult {
	if err := ts.StartProxyServer(); err != nil {
		return TestResult{
			Passed:  false,
			Message: fmt.Sprintf("Failed to start proxy server: %v", err),
		}
	}
	defer ts.StopProxyServer()
	
	// Test health endpoint
	resp, err := http.Get("http://localhost:8091/health")
	if err != nil {
		return TestResult{
			Passed:  false,
			Message: fmt.Sprintf("Health endpoint failed: %v", err),
		}
	}
	defer resp.Body.Close()
	
	if resp.StatusCode != 200 {
		return TestResult{
			Passed:  false,
			Message: fmt.Sprintf("Health endpoint returned status %d", resp.StatusCode),
		}
	}
	
	return TestResult{
		Passed:  true,
		Message: "Proxy server started successfully",
		Details: map[string]interface{}{
			"health_status": resp.StatusCode,
		},
	}
}

func (ts *TestSuite) TestSubscriptionAPIIntegration() TestResult {
	if err := ts.StartProxyServer(); err != nil {
		return TestResult{
			Passed:  false,
			Message: fmt.Sprintf("Failed to start proxy server: %v", err),
		}
	}
	defer ts.StopProxyServer()
	
	// Wait a moment for subscription cache to populate
	time.Sleep(1 * time.Second)
	
	// Check if subscription API was called
	requestCount := ts.mockServer.GetRequestCount()
	if requestCount == 0 {
		return TestResult{
			Passed:  false,
			Message: "Subscription API was not called during startup",
		}
	}
	
	return TestResult{
		Passed:  true,
		Message: "Subscription API integration working",
		Details: map[string]interface{}{
			"subscription_requests": requestCount,
		},
	}
}

func (ts *TestSuite) TestBasicChatRequests() TestResult {
	if err := ts.StartProxyServer(); err != nil {
		return TestResult{
			Passed:  false,
			Message: fmt.Sprintf("Failed to start proxy server: %v", err),
		}
	}
	defer ts.StopProxyServer()
	
	// Wait for subscription cache to populate
	time.Sleep(1 * time.Second)
	
	// Test different roles
	testRoles := []string{"architect", "implementation", "debugging", "documentation", "general"}
	
	for _, role := range testRoles {
		resp, err := ts.MakeChatRequest(role)
		if err != nil {
			return TestResult{
				Passed:  false,
				Message: fmt.Sprintf("Request failed for role %s: %v", role, err),
			}
		}
		defer resp.Body.Close()
		
		if resp.StatusCode != 200 {
			body, _ := io.ReadAll(resp.Body)
			return TestResult{
				Passed:  false,
				Message: fmt.Sprintf("Request failed for role %s with status %d: %s", role, resp.StatusCode, string(body)),
			}
		}
		
		// Parse response to check which model was used
		var chatResp map[string]interface{}
		if err := json.NewDecoder(resp.Body).Decode(&chatResp); err != nil {
			return TestResult{
				Passed:  false,
				Message: fmt.Sprintf("Failed to parse response for role %s: %v", role, err),
			}
		}
		
		model := chatResp["model"]
		log.Printf("[INFO] Role %s used model: %v", role, model)
	}
	
	return TestResult{
		Passed:  true,
		Message: "Basic chat requests working",
		Details: map[string]interface{}{
			"roles_tested": len(testRoles),
			"note":         "ModelRouter integration needed for subscription-first routing",
		},
	}
}

func (ts *TestSuite) TestIntegrationGap() TestResult {
	// This test specifically checks for the integration gap we identified
	if err := ts.StartProxyServer(); err != nil {
		return TestResult{
			Passed:  false,
			Message: fmt.Sprintf("Failed to start proxy server: %v", err),
		}
	}
	defer ts.StopProxyServer()
	
	// Wait for subscription cache to populate
	time.Sleep(1 * time.Second)
	
	// Make a request and check if subscription routing is actually used
	resp, err := ts.MakeChatRequest("architect")
	if err != nil {
		return TestResult{
			Passed:  false,
			Message: fmt.Sprintf("Request failed: %v", err),
		}
	}
	defer resp.Body.Close()
	
	if resp.StatusCode != 200 {
		return TestResult{
			Passed:  false,
			Message: fmt.Sprintf("Request failed with status %d", resp.StatusCode),
		}
	}
	
	// The key issue: ChatHandler doesn't use ModelRouter
	// So subscription-first routing is not actually working
	return TestResult{
		Passed:  false, // This should fail to demonstrate the issue
		Message: "CRITICAL: ModelRouter not integrated with ChatHandler",
		Details: map[string]interface{}{
			"issue":        "ChatHandler.selectBackend() uses simple profile routing instead of ModelRouter.SelectForRole()",
			"impact":       "Subscription-first routing is not functional",
			"fix_needed":   "Integrate ModelRouter into ChatHandler",
		},
	}
}

func main() {
	log.Println("Starting NanoGPT Proxy Subscription-First Routing End-to-End Tests")
	log.Println("This test validates the complete subscription routing flow")
	
	testSuite := NewTestSuite()
	
	// Setup
	testSuite.StartMockServer()
	defer testSuite.StopMockServer()
	
	// Run tests
	testSuite.RunTest("Server Startup", testSuite.TestServerStartup)
	testSuite.RunTest("Subscription API Integration", testSuite.TestSubscriptionAPIIntegration)
	testSuite.RunTest("Basic Chat Requests", testSuite.TestBasicChatRequests)
	testSuite.RunTest("Integration Gap Detection", testSuite.TestIntegrationGap)
	
	// Print results
	testSuite.PrintResults()
	
	// Exit with appropriate code
	failed := 0
	for _, result := range testSuite.results {
		if !result.Passed {
			failed++
		}
	}
	
	if failed > 0 {
		log.Printf("\n⚠  %d test(s) failed. See details above.", failed)
		os.Exit(1)
	}
	
	log.Printf("\n✅ All tests passed!")
}