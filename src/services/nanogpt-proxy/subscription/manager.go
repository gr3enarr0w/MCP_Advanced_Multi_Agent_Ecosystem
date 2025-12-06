package subscription

import (
	"context"
	"encoding/json"
	"errors"
	"fmt"
	"io"
	"log"
	"net/http"
	"strings"
	"sync"
	"time"
)

var ErrNoSubscriptionModels = errors.New("no available subscription models")

const defaultCacheTTL = 2 * time.Minute

// ManagerOption configures the subscription manager during creation.
type ManagerOption func(*Manager)

// WithCacheTTL sets a custom TTL for the subscription cache.
func WithCacheTTL(ttl time.Duration) ManagerOption {
	return func(m *Manager) {
		if ttl > 0 {
			m.ttl = ttl
		}
	}
}

// WithHTTPClient overrides the default HTTP client used to contact the subscription API.
func WithHTTPClient(client *http.Client) ManagerOption {
	return func(m *Manager) {
		if client != nil {
			m.client = client
		}
	}
}

// Manager keeps subscription models cached and exposes helpers for exhaustion tracking.
type Manager struct {
	baseURL string
	ttl     time.Duration
	client  *http.Client

	cacheMu   sync.RWMutex
	cached    []ModelDefinition
	lastFetch time.Time

	exhaustedMu sync.RWMutex
	exhausted   map[string]struct{}
}

// NewManager creates a subscription manager that targets the given base URL.
func NewManager(baseURL string, opts ...ManagerOption) *Manager {
	cleanURL := strings.TrimRight(baseURL, "/")
	if cleanURL == "" {
		cleanURL = "https://nano-gpt.com/api/v1"
	}

	mgr := &Manager{
		baseURL:    cleanURL,
		ttl:        defaultCacheTTL,
		client:     http.DefaultClient,
		exhausted:  make(map[string]struct{}),
		lastFetch:  time.Time{},
		cached:     nil,
	}

	for _, opt := range opts {
		opt(mgr)
	}

	return mgr
}

// GetNextModel selects the next available model for a role using cached or fallback data.
func (m *Manager) GetNextModel(role string) (*ModelSelection, error) {
	return m.getNextModel(context.Background(), role)
}

// GetNextModelWithContext allows callers to provide a context for cache refreshes.
func (m *Manager) GetNextModelWithContext(ctx context.Context, role string) (*ModelSelection, error) {
	return m.getNextModel(ctx, role)
}

// MarkExhausted marks a subscription model as exhausted so it is no longer returned.
func (m *Manager) MarkExhausted(modelID string) {
	if modelID == "" {
		return
	}

	m.exhaustedMu.Lock()
	defer m.exhaustedMu.Unlock()
	m.exhausted[modelID] = struct{}{}
	log.Printf("[SUBSCRIPTION] Model marked exhausted: %s", modelID)
}

// Refresh forces an immediate refresh of cached data from the subscription API.
func (m *Manager) Refresh(ctx context.Context) error {
	log.Println("[SUBSCRIPTION] Manual cache refresh requested")
	return m.fetch(ctx)
}

func (m *Manager) getNextModel(ctx context.Context, role string) (*ModelSelection, error) {
	if err := m.ensureCache(ctx); err != nil {
		return nil, err
	}

	m.cacheMu.RLock()
	models := append([]ModelDefinition{}, m.cached...)
	m.cacheMu.RUnlock()

	for _, candidate := range models {
		if !candidate.SupportsRole(role) {
			continue
		}
		if !candidate.IsAvailable() {
			continue
		}
		if m.isExhausted(candidate.ID) {
			continue
		}
		return &ModelSelection{
			Model: candidate,
			Role:  role,
		}, nil
	}

	log.Println("[SUBSCRIPTION] All subscription models exhausted or unavailable")
	return nil, ErrNoSubscriptionModels
}

func (m *Manager) ensureCache(ctx context.Context) error {
	m.cacheMu.RLock()
	hasCache := len(m.cached) > 0
	stale := time.Since(m.lastFetch) >= m.ttl
	m.cacheMu.RUnlock()

	if hasCache && !stale {
		log.Println("[SUBSCRIPTION] Cache hit")
		return nil
	}

	log.Println("[SUBSCRIPTION] Cache miss or stale; fetching from subscription API")
	if err := m.fetch(ctx); err != nil {
		m.cacheMu.RLock()
		defer m.cacheMu.RUnlock()
		if len(m.cached) > 0 {
			log.Printf("[SUBSCRIPTION] Fetch error (%v) — falling back to cached data", err)
			return nil
		}
		return err
	}

	return nil
}

func (m *Manager) isExhausted(modelID string) bool {
	m.exhaustedMu.RLock()
	defer m.exhaustedMu.RUnlock()
	_, ok := m.exhausted[modelID]
	return ok
}

func (m *Manager) fetch(ctx context.Context) error {
	endpoint := fmt.Sprintf("%s/api/subscription/v1/models", m.baseURL)
	req, err := http.NewRequestWithContext(ctx, http.MethodGet, endpoint, nil)
	if err != nil {
		return fmt.Errorf("failed to build subscription fetch request: %w", err)
	}

	resp, err := m.client.Do(req)
	if err != nil {
		return fmt.Errorf("request to subscription API failed: %w", err)
	}
	defer resp.Body.Close()

	if resp.StatusCode != http.StatusOK {
		body, _ := io.ReadAll(io.LimitReader(resp.Body, 1024))
		return fmt.Errorf("subscription API responded with status %d: %s", resp.StatusCode, strings.TrimSpace(string(body)))
	}

	var payload ModelListResponse
	if err := json.NewDecoder(resp.Body).Decode(&payload); err != nil {
		return fmt.Errorf("failed to decode subscription response: %w", err)
	}

	m.cacheMu.Lock()
	m.cached = payload.Models
	m.lastFetch = time.Now()
	m.cacheMu.Unlock()

	log.Printf("[SUBSCRIPTION] Cache refreshed with %d models", len(payload.Models))
	return nil
}