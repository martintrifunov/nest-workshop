package store

import (
	"database/sql"
	"encoding/json"
	"errors"
	"fmt"
	"log"
	"sync"

	"zoo-gateway/internal/models"

	"github.com/lib/pq"
)

// Store wraps a *sql.DB and an in-memory route table used for zero-lock-wait
// proxying. All writes to the route table go through Rebuild().
type Store struct {
	db *sql.DB

	mu         sync.RWMutex
	routeTable map[string]models.Service
}

// New opens and pings the database once. The caller is responsible for
// retrying with a delay between attempts (see connectDB in main.go).
func New(dsn string) (*Store, error) {
	db, err := sql.Open("postgres", dsn)
	if err != nil {
		return nil, fmt.Errorf("open db: %w", err)
	}
	if err = db.Ping(); err != nil {
		db.Close()
		return nil, err
	}
	return &Store{db: db, routeTable: make(map[string]models.Service)}, nil
}

// Close releases the underlying database connection.
func (s *Store) Close() error { return s.db.Close() }

// Migrate creates the gateway_services and request_logs tables if they do not
// already exist.
func (s *Store) Migrate() error {
	_, err := s.db.Exec(`
		CREATE TABLE IF NOT EXISTS gateway_services (
			id              SERIAL PRIMARY KEY,
			name            TEXT UNIQUE NOT NULL,
			base_url        TEXT NOT NULL,
			response_format TEXT NOT NULL DEFAULT 'json',
			route_pattern   TEXT NOT NULL,
			auth_required   BOOLEAN NOT NULL DEFAULT TRUE,
			spec            JSONB NOT NULL
		)
	`)
	if err != nil {
		return err
	}
	_, err = s.db.Exec(`
		CREATE TABLE IF NOT EXISTS request_logs (
			id           SERIAL PRIMARY KEY,
			service_name TEXT NOT NULL,
			method       TEXT NOT NULL,
			path         TEXT NOT NULL,
			status_code  INT NOT NULL,
			duration_ms  INT NOT NULL,
			created_at   TIMESTAMPTZ NOT NULL DEFAULT NOW()
		)
	`)
	return err
}

// Seed upserts the provided services, skipping any whose BaseURL is empty.
// This is used at startup to inject Docker-network hostnames from env vars.
func (s *Store) Seed(services []models.Service) error {
	for _, svc := range services {
		if svc.BaseURL == "" {
			continue
		}
		specJSON, err := json.Marshal(svc.Spec)
		if err != nil {
			return fmt.Errorf("seed marshal %s: %w", svc.Name, err)
		}
		_, err = s.db.Exec(`
			INSERT INTO gateway_services
			  (name, base_url, response_format, route_pattern, auth_required, spec)
			VALUES ($1, $2, $3, $4, $5, $6)
			ON CONFLICT (name) DO UPDATE
			  SET base_url        = EXCLUDED.base_url,
			      response_format = EXCLUDED.response_format,
			      route_pattern   = EXCLUDED.route_pattern,
			      auth_required   = EXCLUDED.auth_required,
			      spec            = EXCLUDED.spec
		`, svc.Name, svc.BaseURL, svc.ResponseFormat, svc.RoutePattern, svc.AuthRequired, specJSON)
		if err != nil {
			return fmt.Errorf("seed upsert %s: %w", svc.Name, err)
		}
		log.Printf("store: seeded service %q → %s", svc.Name, svc.BaseURL)
	}
	return nil
}

// Rebuild reloads all services from the database and atomically replaces the
// in-memory route table. Call after any write that changes registered services.
func (s *Store) Rebuild() error {
	rows, err := s.db.Query(`
		SELECT id, name, base_url, response_format, route_pattern, auth_required, spec
		FROM gateway_services
	`)
	if err != nil {
		return fmt.Errorf("rebuild query: %w", err)
	}
	defer rows.Close()

	next := make(map[string]models.Service)
	for rows.Next() {
		var svc models.Service
		var specJSON []byte
		if err := rows.Scan(
			&svc.ID, &svc.Name, &svc.BaseURL, &svc.ResponseFormat,
			&svc.RoutePattern, &svc.AuthRequired, &specJSON,
		); err != nil {
			return fmt.Errorf("rebuild scan: %w", err)
		}
		if err := json.Unmarshal(specJSON, &svc.Spec); err != nil {
			return fmt.Errorf("rebuild unmarshal spec for %q: %w", svc.Name, err)
		}
		next[svc.RoutePattern] = svc
	}
	if err := rows.Err(); err != nil {
		return fmt.Errorf("rebuild rows: %w", err)
	}

	s.mu.Lock()
	s.routeTable = next
	s.mu.Unlock()
	return nil
}

// Lookup returns the Service registered for routePattern, and whether it was found.
func (s *Store) Lookup(routePattern string) (models.Service, bool) {
	s.mu.RLock()
	svc, ok := s.routeTable[routePattern]
	s.mu.RUnlock()
	return svc, ok
}

// --- CRUD ---

// Create inserts a new service and returns it with the DB-assigned ID.
func (s *Store) Create(svc models.Service) (models.Service, error) {
	specJSON, err := json.Marshal(svc.Spec)
	if err != nil {
		return svc, fmt.Errorf("create marshal: %w", err)
	}
	err = s.db.QueryRow(`
		INSERT INTO gateway_services
		  (name, base_url, response_format, route_pattern, auth_required, spec)
		VALUES ($1, $2, $3, $4, $5, $6)
		RETURNING id
	`, svc.Name, svc.BaseURL, svc.ResponseFormat, svc.RoutePattern, svc.AuthRequired, specJSON,
	).Scan(&svc.ID)
	if err != nil {
		if isUniqueViolation(err) {
			return svc, ErrConflict
		}
		return svc, fmt.Errorf("create insert: %w", err)
	}
	return svc, nil
}

// List returns all registered services.
func (s *Store) List() ([]models.Service, error) {
	rows, err := s.db.Query(`
		SELECT id, name, base_url, response_format, route_pattern, auth_required, spec
		FROM gateway_services
		ORDER BY id
	`)
	if err != nil {
		return nil, fmt.Errorf("list query: %w", err)
	}
	defer rows.Close()

	var services []models.Service
	for rows.Next() {
		var svc models.Service
		var specJSON []byte
		if err := rows.Scan(
			&svc.ID, &svc.Name, &svc.BaseURL, &svc.ResponseFormat,
			&svc.RoutePattern, &svc.AuthRequired, &specJSON,
		); err != nil {
			return nil, fmt.Errorf("list scan: %w", err)
		}
		if err := json.Unmarshal(specJSON, &svc.Spec); err != nil {
			return nil, fmt.Errorf("list unmarshal spec: %w", err)
		}
		services = append(services, svc)
	}
	return services, rows.Err()
}

// Get returns a single service by name.
func (s *Store) Get(name string) (models.Service, error) {
	var svc models.Service
	var specJSON []byte
	err := s.db.QueryRow(`
		SELECT id, name, base_url, response_format, route_pattern, auth_required, spec
		FROM gateway_services WHERE name = $1
	`, name).Scan(
		&svc.ID, &svc.Name, &svc.BaseURL, &svc.ResponseFormat,
		&svc.RoutePattern, &svc.AuthRequired, &specJSON,
	)
	if err == sql.ErrNoRows {
		return svc, ErrNotFound
	}
	if err != nil {
		return svc, fmt.Errorf("get query: %w", err)
	}
	if err := json.Unmarshal(specJSON, &svc.Spec); err != nil {
		return svc, fmt.Errorf("get unmarshal spec: %w", err)
	}
	return svc, nil
}

// Update replaces the mutable fields of an existing service and returns the
// updated record (name is immutable).
func (s *Store) Update(name string, svc models.Service) (models.Service, error) {
	specJSON, err := json.Marshal(svc.Spec)
	if err != nil {
		return svc, fmt.Errorf("update marshal: %w", err)
	}
	res, err := s.db.Exec(`
		UPDATE gateway_services
		SET base_url=$1, response_format=$2, route_pattern=$3, auth_required=$4, spec=$5
		WHERE name=$6
	`, svc.BaseURL, svc.ResponseFormat, svc.RoutePattern, svc.AuthRequired, specJSON, name)
	if err != nil {
		return svc, fmt.Errorf("update exec: %w", err)
	}
	if n, _ := res.RowsAffected(); n == 0 {
		return svc, ErrNotFound
	}
	svc.Name = name
	return svc, nil
}

// Delete removes a service by name.
func (s *Store) Delete(name string) error {
	res, err := s.db.Exec(`DELETE FROM gateway_services WHERE name=$1`, name)
	if err != nil {
		return fmt.Errorf("delete exec: %w", err)
	}
	if n, _ := res.RowsAffected(); n == 0 {
		return ErrNotFound
	}
	return nil
}

// ErrNotFound is returned when a requested service does not exist.
var ErrNotFound = fmt.Errorf("service not found")

// ErrConflict is returned when a service name is already registered.
var ErrConflict = fmt.Errorf("service name already exists")

// isUniqueViolation reports whether err is a PostgreSQL unique-constraint
// violation (error code 23505).
func isUniqueViolation(err error) bool {
	var pqErr *pq.Error
	if errors.As(err, &pqErr) {
		return pqErr.Code == "23505"
	}
	return false
}

// --- Request logging ---

// LogRequest inserts a request log entry. Errors are non-fatal; callers
// should fire this in a goroutine and log any returned error.
func (s *Store) LogRequest(entry models.RequestLog) error {
	_, err := s.db.Exec(`
		INSERT INTO request_logs (service_name, method, path, status_code, duration_ms)
		VALUES ($1, $2, $3, $4, $5)
	`, entry.ServiceName, entry.Method, entry.Path, entry.StatusCode, entry.DurationMs)
	return err
}

// GetLogs returns the most recent limit log entries for the named service,
// newest first.
func (s *Store) GetLogs(serviceName string, limit int) ([]models.RequestLog, error) {
	rows, err := s.db.Query(`
		SELECT id, service_name, method, path, status_code, duration_ms, created_at
		FROM request_logs
		WHERE service_name = $1
		ORDER BY created_at DESC
		LIMIT $2
	`, serviceName, limit)
	if err != nil {
		return nil, fmt.Errorf("get logs: %w", err)
	}
	defer rows.Close()

	var logs []models.RequestLog
	for rows.Next() {
		var l models.RequestLog
		if err := rows.Scan(
			&l.ID, &l.ServiceName, &l.Method, &l.Path,
			&l.StatusCode, &l.DurationMs, &l.CreatedAt,
		); err != nil {
			return nil, fmt.Errorf("get logs scan: %w", err)
		}
		logs = append(logs, l)
	}
	if logs == nil {
		logs = []models.RequestLog{}
	}
	return logs, rows.Err()
}
