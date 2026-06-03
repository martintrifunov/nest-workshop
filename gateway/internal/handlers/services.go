package handlers

import (
	"encoding/json"
	"errors"
	"net/http"

	"zoo-gateway/internal/models"
	"zoo-gateway/internal/store"

	"github.com/go-chi/chi/v5"
)

// Services handles CRUD for registered gateway services.
type Services struct {
	store *store.Store
}

// NewServices creates a Services handler.
func NewServices(s *store.Store) *Services {
	return &Services{store: s}
}

func (h *Services) Create(w http.ResponseWriter, r *http.Request) {
	var svc models.Service
	if err := json.NewDecoder(r.Body).Decode(&svc); err != nil {
		writeError(w, http.StatusBadRequest, "invalid request body")
		return
	}

	created, err := h.store.Create(svc)
	if err != nil {
		writeError(w, http.StatusConflict, err.Error())
		return
	}
	h.store.Rebuild() //nolint:errcheck

	writeJSON(w, http.StatusCreated, created)
}

func (h *Services) List(w http.ResponseWriter, r *http.Request) {
	services, err := h.store.List()
	if err != nil {
		writeError(w, http.StatusInternalServerError, err.Error())
		return
	}
	// Return [] not null for empty lists
	if services == nil {
		services = []models.Service{}
	}
	writeJSON(w, http.StatusOK, services)
}

func (h *Services) Get(w http.ResponseWriter, r *http.Request) {
	name := chi.URLParam(r, "name")
	svc, err := h.store.Get(name)
	if errors.Is(err, store.ErrNotFound) {
		writeError(w, http.StatusNotFound, "service not found")
		return
	}
	if err != nil {
		writeError(w, http.StatusInternalServerError, err.Error())
		return
	}
	writeJSON(w, http.StatusOK, svc)
}

func (h *Services) Update(w http.ResponseWriter, r *http.Request) {
	name := chi.URLParam(r, "name")
	var svc models.Service
	if err := json.NewDecoder(r.Body).Decode(&svc); err != nil {
		writeError(w, http.StatusBadRequest, "invalid request body")
		return
	}

	updated, err := h.store.Update(name, svc)
	if errors.Is(err, store.ErrNotFound) {
		writeError(w, http.StatusNotFound, "service not found")
		return
	}
	if err != nil {
		writeError(w, http.StatusInternalServerError, err.Error())
		return
	}
	h.store.Rebuild() //nolint:errcheck

	writeJSON(w, http.StatusOK, updated)
}

func (h *Services) Delete(w http.ResponseWriter, r *http.Request) {
	name := chi.URLParam(r, "name")
	err := h.store.Delete(name)
	if errors.Is(err, store.ErrNotFound) {
		writeError(w, http.StatusNotFound, "service not found")
		return
	}
	if err != nil {
		writeError(w, http.StatusInternalServerError, err.Error())
		return
	}
	h.store.Rebuild() //nolint:errcheck

	w.WriteHeader(http.StatusNoContent)
}

// Health returns a simple liveness response.
func Health(w http.ResponseWriter, _ *http.Request) {
	writeJSON(w, http.StatusOK, map[string]string{"status": "ok"})
}

// --- HTTP helpers shared within the handlers package ---

func writeJSON(w http.ResponseWriter, status int, v any) {
	w.Header().Set("Content-Type", "application/json")
	w.WriteHeader(status)
	json.NewEncoder(w).Encode(v) //nolint:errcheck
}

func writeError(w http.ResponseWriter, status int, msg string) {
	writeJSON(w, status, map[string]string{"error": msg})
}
