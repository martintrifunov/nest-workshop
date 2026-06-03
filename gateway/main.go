package main

import (
	"fmt"
	"log"
	"net/http"
	"os"
	"time"

	"zoo-gateway/internal/handlers"
	gw "zoo-gateway/internal/middleware"
	"zoo-gateway/internal/models"
	"zoo-gateway/internal/proxy"
	"zoo-gateway/internal/store"

	"github.com/go-chi/chi/v5"
	"github.com/go-chi/chi/v5/middleware"
)

func main() {
	cfg := loadConfig()

	s, err := connectDB(cfg.dsn(), 15)
	if err != nil {
		log.Fatalf("database: %v", err)
	}
	defer s.Close()

	if err := s.Migrate(); err != nil {
		log.Fatalf("migrate: %v", err)
	}
	if err := s.Seed(cfg.seeds()); err != nil {
		log.Fatalf("seed: %v", err)
	}
	if err := s.Rebuild(); err != nil {
		log.Fatalf("rebuild route table: %v", err)
	}

	r := buildRouter(s, cfg)

	log.Printf("zoo-gateway listening on :%s", cfg.Port)
	log.Fatal(http.ListenAndServe(":"+cfg.Port, r))
}

// buildRouter wires all routes and middleware.
func buildRouter(s *store.Store, cfg *config) chi.Router {
	proxyHandler := proxy.New(s, []byte(cfg.JWTSecret), cfg.DockerInternalHost)
	svcHandler := handlers.NewServices(s)

	r := chi.NewRouter()
	r.Use(middleware.Logger)
	r.Use(middleware.Recoverer)
	r.Use(gw.CORS)

	r.Get("/health", handlers.Health)

	r.Route("/admin/services", func(r chi.Router) {
		r.Get("/", svcHandler.List)
		r.Post("/", svcHandler.Create)
		r.Get("/{name}/logs", svcHandler.GetLogs)
		r.Get("/{name}", svcHandler.Get)
		r.Put("/{name}", svcHandler.Update)
		r.Delete("/{name}", svcHandler.Delete)
	})

	// Dynamic proxy — collection and single-item paths
	r.Get("/api/service/{routePattern}", proxyHandler.ServeHTTP)
	r.Get("/api/service/{routePattern}/*", proxyHandler.ServeHTTP)

	return r
}

// connectDB retries calling store.New up to maxRetries times with a 2-second
// delay between attempts.
func connectDB(dsn string, maxRetries int) (*store.Store, error) {
	for i := 1; i <= maxRetries; i++ {
		s, err := store.New(dsn)
		if err == nil {
			return s, nil
		}
		log.Printf("main: waiting for postgres (%d/%d): %v", i, maxRetries, err)
		time.Sleep(2 * time.Second)
	}
	return nil, fmt.Errorf("could not connect after %d attempts", maxRetries)
}

// config holds all runtime configuration sourced from environment variables.
type config struct {
	Port               string
	JWTSecret          string
	DockerInternalHost string
	DBHost             string
	DBPort             string
	DBUser             string
	DBPassword         string
	DBName             string
	SeedAnimalsURL     string
	SeedEmployeesURL   string
	SeedScheduleURL    string
	SeedExhibitsURL    string
}

func loadConfig() *config {
	return &config{
		Port:               env("GATEWAY_PORT", "5555"),
		JWTSecret:          env("JWT_SECRET", ""),
		DockerInternalHost: env("DOCKER_INTERNAL_HOST", "host.docker.internal"),
		DBHost:             env("DB_HOST", "localhost"),
		DBPort:             env("DB_PORT", "5432"),
		DBUser:             env("DB_USER", "nest_user"),
		DBPassword:         env("DB_PASSWORD", "nest_password"),
		DBName:             env("DB_NAME", "nest_workshop"),
		SeedAnimalsURL:     env("SEED_ANIMALS_URL", ""),
		SeedEmployeesURL:   env("SEED_EMPLOYEES_URL", ""),
		SeedScheduleURL:    env("SEED_SCHEDULE_URL", ""),
		SeedExhibitsURL:    env("SEED_EXHIBITS_URL", ""),
	}
}

func (c *config) dsn() string {
	return fmt.Sprintf(
		"host=%s port=%s user=%s password=%s dbname=%s sslmode=disable",
		c.DBHost, c.DBPort, c.DBUser, c.DBPassword, c.DBName,
	)
}

func (c *config) seeds() []models.Service {
	return []models.Service{
		{Name: "animals", BaseURL: c.SeedAnimalsURL, ResponseFormat: "json",
			RoutePattern: "animals", AuthRequired: true, Spec: models.Spec{Fields: []models.FieldSpec{}}},
		{Name: "employees", BaseURL: c.SeedEmployeesURL, ResponseFormat: "json",
			RoutePattern: "employees", AuthRequired: true, Spec: models.Spec{Fields: []models.FieldSpec{}}},
		{Name: "schedule", BaseURL: c.SeedScheduleURL, ResponseFormat: "json",
			RoutePattern: "schedule", AuthRequired: true, Spec: models.Spec{Fields: []models.FieldSpec{}}},
		{Name: "exhibits", BaseURL: c.SeedExhibitsURL, ResponseFormat: "xml",
			RoutePattern: "exhibits", AuthRequired: true, Spec: models.Spec{Fields: []models.FieldSpec{}}},
	}
}

// env returns the value of the environment variable key, or fallback if unset.
func env(key, fallback string) string {
	if v, ok := os.LookupEnv(key); ok {
		return v
	}
	return fallback
}
