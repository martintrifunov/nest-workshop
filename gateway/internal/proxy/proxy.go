package proxy

import (
	"encoding/json"
	"encoding/xml"
	"fmt"
	"io"
	"log"
	"net/http"
	"net/url"
	"strconv"
	"strings"
	"time"

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

	start := time.Now()
	resp, err := http.Get(upstreamURL) //nolint:noctx
	durationMs := int(time.Since(start).Milliseconds())

	if err != nil {
		go h.logRequest(svc.Name, r, http.StatusBadGateway, durationMs)
		writeError(w, http.StatusBadGateway, "upstream unreachable")
		return
	}
	defer resp.Body.Close()

	go h.logRequest(svc.Name, r, resp.StatusCode, durationMs)

	body, err := io.ReadAll(resp.Body)
	if err != nil {
		writeError(w, http.StatusInternalServerError, "failed to read upstream response")
		return
	}

	result, err := normalise(body, svc.ResponseFormat, svc.Spec)
	if err != nil {
		writeError(w, http.StatusInternalServerError, "normalisation error")
		return
	}

	writeJSON(w, http.StatusOK, result)
}

func (h *Handler) logRequest(serviceName string, r *http.Request, statusCode, durationMs int) {
	if err := h.store.LogRequest(models.RequestLog{
		ServiceName: serviceName,
		Method:      r.Method,
		Path:        r.URL.Path,
		StatusCode:  statusCode,
		DurationMs:  durationMs,
	}); err != nil {
		log.Printf("proxy: log request: %v", err)
	}
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

// normalise parses raw response bytes according to responseFormat and applies
// field-mapping rules from spec. If spec has no fields the raw value is
// returned unchanged.
func normalise(data []byte, responseFormat string, spec models.Spec) (any, error) {
	var raw any
	var err error
	if responseFormat == "xml" {
		raw, err = parseXML(data)
	} else {
		err = json.Unmarshal(data, &raw)
	}
	if err != nil {
		return nil, err
	}
	if len(spec.Fields) == 0 {
		return raw, nil
	}
	return applySpec(raw, spec), nil
}

// --- XML parsing ---

// xmlNode is a generic container used to decode arbitrary XML trees.
type xmlNode struct {
	XMLName  xml.Name
	Content  string    `xml:",chardata"`
	Children []xmlNode `xml:",any"`
}

// parseXML converts raw XML bytes into a Go value suitable for spec processing.
// Root elements whose children all share a single tag name are treated as arrays.
func parseXML(data []byte) (any, error) {
	var root xmlNode
	if err := xml.Unmarshal(data, &root); err != nil {
		return nil, err
	}
	return nodeToAny(root), nil
}

func nodeToAny(n xmlNode) any {
	if len(n.Children) == 0 {
		return strings.TrimSpace(n.Content)
	}
	// Count distinct child tag names.
	tagCounts := make(map[string]int, len(n.Children))
	for _, c := range n.Children {
		tagCounts[c.XMLName.Local]++
	}
	// Single distinct tag → array (handles both single and multiple items).
	if len(tagCounts) == 1 {
		arr := make([]any, 0, len(n.Children))
		for _, c := range n.Children {
			arr = append(arr, nodeToAny(c))
		}
		return arr
	}
	// Multiple distinct tags → object.
	m := make(map[string]any, len(n.Children))
	for _, c := range n.Children {
		m[c.XMLName.Local] = nodeToAny(c)
	}
	return m
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
	switch typ {
	case "string":
		return fmt.Sprintf("%v", v)
	case "number":
		if s, ok := v.(string); ok {
			if n, err := strconv.ParseFloat(s, 64); err == nil {
				return n
			}
		}
		return v
	default:
		return v
	}
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
