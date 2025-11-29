package main

import (
	"context"
	"log"
	"net/http"
	"os"
	"os/signal"
	"syscall"

	"github.com/gorilla/mux"
	"github.com/gr3enarr0w/mcp-ecosystem/nanogpt-proxy/backends"
	"github.com/gr3enarr0w/mcp-ecosystem/nanogpt-proxy/config"
	"github.com/gr3enarr0w/mcp-ecosystem/nanogpt-proxy/ctxmgr"
	"github.com/gr3enarr0w/mcp-ecosystem/nanogpt-proxy/handlers"
	"github.com/gr3enarr0w/mcp-ecosystem/nanogpt-proxy/mcp"
	"github.com/gr3enarr0w/mcp-ecosystem/nanogpt-proxy/promptengineer"
	"github.com/gr3enarr0w/mcp-ecosystem/nanogpt-proxy/research"
	"github.com/gr3enarr0w/mcp-ecosystem/nanogpt-proxy/routing"
	"github.com/gr3enarr0w/mcp-ecosystem/nanogpt-proxy/storage"
)

func main() {
	log.Println("Starting NanoGPT Proxy Server...")

	// Load configuration
	cfg := config.Load()

	// Initialize usage tracker
	usageTracker, err := storage.NewUsageTracker(cfg.DBPath)
	if err != nil {
		log.Fatalf("Failed to initialize usage tracker: %v", err)
	}
	defer usageTracker.Close()

	// Initialize backends
	var nanogptBackend *backends.NanoGPTBackend
	var vertexBackend *backends.VertexBackend

	// NanoGPT backend (personal)
	if cfg.NanoGPTAPIKey != "" {
		nanogptBackend = backends.NewNanoGPTBackend(
			cfg.NanoGPTAPIKey,
			cfg.NanoGPTBaseURL,
			cfg.MonthlyQuota,
		)
		log.Println("✓ NanoGPT backend initialized")
	} else {
		log.Println("⚠ NanoGPT API key not set (NANOGPT_API_KEY)")
	}

	// Vertex AI backend (work)
	if cfg.VertexProjectID != "" {
		vertexBackend, err = backends.NewVertexBackend(
			cfg.VertexProjectID,
			cfg.VertexLocation,
		)
		if err != nil {
			log.Printf("⚠ Failed to initialize Vertex backend: %v", err)
		} else {
			log.Println("✓ Vertex AI backend initialized")
		}
	} else {
		log.Println("⚠ Vertex project ID not set (VERTEX_PROJECT_ID)")
	}

	// Check that at least one backend is available
	if nanogptBackend == nil && vertexBackend == nil {
		log.Fatal("No backends available - set NANOGPT_API_KEY or VERTEX_PROJECT_ID")
	}

	// Initialize Prompt Engineer (Phase 2)
	var promptEngineer *promptengineer.PromptEngineer
	if nanogptBackend != nil {
		promptEngineer, err = promptengineer.NewPromptEngineer(nanogptBackend, cfg.PromptStrategies)
		if err != nil {
			log.Printf("⚠ Failed to initialize prompt engineer: %v", err)
		} else {
			log.Println("✓ Prompt Engineer initialized (7 role strategies)")
		}
	}

	// Initialize Model Router (Phase 3)
	backendMap := map[string]backends.Backend{
		"nanogpt": nanogptBackend,
		"vertex":  vertexBackend,
	}
	_, err = routing.NewModelRouter(cfg.ModelRankingsPath, backendMap)
	if err != nil {
		log.Printf("⚠ Failed to initialize model router: %v", err)
	} else {
		log.Println("✓ Model Router initialized (8 roles configured)")
	}

	// Initialize MCP clients (Phase 4)
	mcpClients := make(map[string]*mcp.MCPClient)
	for serverName, serverCfg := range cfg.MCPServers {
		client := mcp.NewMCPClient(serverName, serverCfg.Command, serverCfg.Args, serverCfg.Env)
		mcpClients[serverName] = client

		// Connect in background
		go func(name string, c *mcp.MCPClient) {
			if err := c.Connect(context.Background()); err != nil {
				log.Printf("⚠ Failed to connect to MCP server '%s': %v", name, err)
			} else {
				log.Printf("✓ MCP client connected: %s", name)
			}
		}(serverName, client)
	}

	// Initialize Context Manager (Phase 4)
	_ = ctxmgr.NewContextManager(mcpClients)
	log.Println("✓ Context Manager initialized")

	// Initialize Monthly Research System (Phase 5)
	researchSystem, err := research.NewResearchSystem(cfg.ModelRankingsPath)
	if err != nil {
		log.Printf("⚠ Failed to initialize research system: %v", err)
	} else {
		log.Printf("✓ Research System initialized (last update: %v)", researchSystem.GetLastResearchDate())
	}

	// Start Research Scheduler (Phase 5)
	var scheduler *research.Scheduler
	if researchSystem != nil {
		scheduler = research.NewScheduler(researchSystem)
		if err := scheduler.Start(); err != nil {
			log.Printf("⚠ Failed to start research scheduler: %v", err)
		} else {
			log.Println("✓ Research Scheduler started (monthly auto-updates)")
		}
	}

	// Initialize handlers
	chatHandler := handlers.NewChatHandler(
		nanogptBackend,
		vertexBackend,
		cfg.ActiveProfile,
		usageTracker,
		promptEngineer,
	)

	modelsHandler := handlers.NewModelsHandler(
		nanogptBackend,
		vertexBackend,
	)

	var researchHandler *handlers.ResearchHandler
	if scheduler != nil && researchSystem != nil {
		researchHandler = handlers.NewResearchHandler(scheduler, researchSystem)
		log.Println("✓ Research API endpoints enabled")
	}

	// Setup router
	router := mux.NewRouter()

	// OpenAI-compatible endpoints
	router.HandleFunc("/v1/chat/completions", chatHandler.HandleChatCompletion).Methods("POST")
	router.HandleFunc("/v1/models", modelsHandler.HandleListModels).Methods("GET")
	router.HandleFunc("/v1/models/{model}", modelsHandler.HandleGetModel).Methods("GET")

	// Research endpoints (Phase 5)
	if researchHandler != nil {
		router.HandleFunc("/admin/research/trigger", researchHandler.HandleTriggerResearch).Methods("POST")
		router.HandleFunc("/admin/research/status", researchHandler.HandleResearchStatus).Methods("GET")
		router.HandleFunc("/admin/research/force-refresh", researchHandler.HandleForceRefresh).Methods("POST")
	}

	// Health check
	router.HandleFunc("/health", func(w http.ResponseWriter, r *http.Request) {
		w.WriteHeader(http.StatusOK)
		w.Write([]byte("OK"))
	}).Methods("GET")

	// Status endpoint
	router.HandleFunc("/status", func(w http.ResponseWriter, r *http.Request) {
		status := map[string]interface{}{
			"active_profile": cfg.ActiveProfile,
			"backends": map[string]bool{
				"nanogpt": nanogptBackend != nil,
				"vertex":  vertexBackend != nil,
			},
		}

		// Get NanoGPT usage if available
		if nanogptBackend != nil {
			usage, err := nanogptBackend.GetUsage()
			if err == nil {
				status["nanogpt_usage"] = map[string]interface{}{
					"tokens_used":      usage.TokensUsed,
					"tokens_remaining": usage.TokensRemaining,
					"tokens_limit":     usage.TokensLimit,
					"reset_date":       usage.ResetDate,
				}
			}
		}

		w.Header().Set("Content-Type", "application/json")
		w.WriteHeader(http.StatusOK)
		// Simple JSON encoding
		w.Write([]byte("{\"status\":\"ok\"}"))
	}).Methods("GET")

	// Start server
	addr := ":" + cfg.Port
	log.Printf("✓ Server starting on http://localhost%s", addr)
	log.Printf("  Active profile: %s", cfg.ActiveProfile)
	log.Printf("  OpenAI-compatible endpoint: http://localhost%s/v1", addr)

	// Setup graceful shutdown
	server := &http.Server{
		Addr:    addr,
		Handler: router,
	}

	// Handle shutdown signals
	stop := make(chan os.Signal, 1)
	signal.Notify(stop, os.Interrupt, syscall.SIGTERM)

	go func() {
		if err := server.ListenAndServe(); err != nil && err != http.ErrServerClosed {
			log.Fatalf("Server error: %v", err)
		}
	}()

	log.Println("✓ NanoGPT Proxy is ready to accept requests")
	log.Println("")
	log.Println("========================================")
	log.Println("SMART PROXY FEATURES ENABLED:")
	log.Println("  ✓ Phase 1: OpenAI-compatible API")
	log.Println("  ✓ Phase 2: Prompt Engineer (role-based optimization)")
	log.Println("  ✓ Phase 3: Model Router (auto-select best model)")
	log.Println("  ✓ Phase 4: Context Manager (conversation history)")
	log.Println("  ✓ Phase 5: Monthly Research (auto-evaluate new models)")
	log.Println("========================================")
	log.Println("")

	// Wait for shutdown signal
	<-stop
	log.Println("\nShutting down gracefully...")

	// Clean up
	if scheduler != nil {
		scheduler.Stop()
	}
	for _, client := range mcpClients {
		client.Close()
	}
}
