package proxy

import (
	"encoding/json"
	"fmt"
	"io"
	"net/http"
	"net/url"
	"strings"

	"zoo-gateway/internal/models"
	"zoo-gateway/internal/store"

	"github.com/go-chi/chi/v5"
	"github.com/golang-jwt/jwt/v5"
)

// Handler proxies incoming requests to the appropriate upstream service,
// enforcing JWT auth and applying response normalisation per the service spec.
type Handler struct {
	store             *store.Store
	jwtSecret         []byte
	dockerInternalHost string
}

// New creates a proxy Handler.
func New(s *store.Store, jwtSecret []byte, dockerInternalHost string) *Handler {
	return &Handler{
		store:              s,
		jwtSecret:          jwtSecret,
		dockerInternalHost: dockerInternalHost,
	}
}

// ServeHTTP satisfies http.Handler so Handler can be registered directly on a router.
func (h *Handler) ServeHTTP(w http.ResponseWriter, r *http.Request) {
	routePattern := chi.URLParam(r, "routePattern")

	svc, ok := h.store.Lookup(routePattern)
	if !ok {
		writeError(w, http.StatusNotFound, "service not registered")
		return
	}

	if svc.AuthRequired {
		if err := h.enforceJWT(r); err != nil {
			writeError(w, http.StatusUnauthorized, err.Error())
			return
		}
	}

	upstreamURL := h.buildUpstreamURL(svc.BaseURL, chi.URLParam(r, "*"))

	resp, err := http.Get(upstreamURL) //nolint:noctx // simple proxy, no timeout required here
	if err != nil {
		writeError(w, http.StatusBadGateway, "upstream unreachable")
		return
	}
	defer resp.Body.Close()

	body, err := io.ReadAll(resp.Body)
	if err != nil {
		writeError(w, http.StatusInternalServerError, "failed to read upstream response")
		return
	}

	result, err := normalise(body, svc.Spec)
	if err != nil {
		writeError(w, http.StatusInternalServerError, "normalisation error")
		return
	}

	writeJSON(w, http.StatusOK, result)
}

// enforceJWT validates the Bearer token in the Authorization header.
func (h *Handler) enforceJWT(r *http.Request) error {
	parts := strings.SplitN(r.Header.Get("Authorization"), " ", 2)
	if len(parts) != 2 || !strings.EqualFold(parts[0], "bearer") {
		return fmt.Errorf("missing or invalid authorization header")
	}
	token, err := jwt.Parse(parts[1], func(t *jwt.Token) (interface{}, error) {
		if _, ok := t.Method.(*jwt.SigningMethodHMAC); !ok {
			return nil, fmt.Errorf("unexpected signing method: %v", t.Header["alg"])
		}
		return h.jwtSecret, nil
	})
	if err != nil || !token.Valid {
		return fmt.Errorf("invalid token")
	}
	return nil
}

// buildUpstreamURL combines the registered baseURL with an optional wildcard
// path suffix, and rewrites localhost to host.docker.internal when configured.
func (h *Handler) buildUpstreamURL(baseURL, wildcard string) string {
	resolved := h.resolveLocalhost(strings.TrimRight(baseURL, "/"))
	if wildcard != "" {
		return resolved + "/" + wildcard
	}
	return resolved
}

// resolveLocalhost rewrites localhost/127.0.0.1 hosts to h.dockerInternalHost
// so that services registered from the browser UI still reach the host machine
// when the gateway is running inside a Docker container.
func (h *Handler) resolveLocalhost(rawURL string) string {
	if h.dockerInternalHost == "" {
		return rawURL
	}
	u, err := url.Parse(rawURL)
	if err != nil {
		return rawURL
	}
	if host := u.Hostname(); host == "localhost" || host == "127.0.0.1" {
		if port := u.Port(); port != "" {
			u.Host = h.dockerInternalHost + ":" + port
		} else {
			u.Host = h.dockerInternalHost
		}
		return u.String()
	}
	return rawURL
}

// --- Response normalisation ---

// normalise parses raw JSON and applies field-mapping rules from spec.
// If spec has no fields the raw value is returned unchanged.
func normalise(data []byte, spec models.Spec) (any, error) {
	var raw any
	if err := json.Unmarshal(data, &raw); err != nil {
		return nil, err
	}
	if len(spec.Fields) == 0 {
		return raw, nil
	}
	return applySpec(raw, spec), nil
}

func applySpec(raw any, spec models.Spec) any {
	switch v := raw.(type) {
	case []any:
		out := make([]map[string]any, 0, len(v))
		for _, item := range v {
			if m, ok := item.(map[string]any); ok {
				out = append(out, mapFields(m, spec.Fields))
			}
		}
		return out
	case map[string]any:
		return mapFields(v, spec.Fields)
	default:
		return raw
	}
}

func mapFields(src map[string]any, fields []models.FieldSpec) map[string]any {
	out := make(map[string]any, len(fields))
	for _, f := range fields {
		if val, ok := src[f.Source]; ok {
			out[f.Target] = coerce(val, f.Type)
		}
	}
	return out
}

func coerce(v any, typ string) any {
	if typ == "string" {
		return fmt.Sprintf("%v", v)
	}
	return v
}

// --- HTTP helpers ---

func writeJSON(w http.ResponseWriter, status int, v any) {
	w.Header().Set("Content-Type", "application/json")
	w.WriteHeader(status)
	json.NewEncoder(w).Encode(v) //nolint:errcheck
}

func writeError(w http.ResponseWriter, status int, msg string) {
	writeJSON(w, status, map[string]string{"error": msg})
}
