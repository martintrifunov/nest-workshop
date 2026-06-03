package models

import "time"

// FieldSpec describes a single field rename/type-cast rule applied to
// upstream JSON responses before they are returned to the caller.
type FieldSpec struct {
	Source string `json:"source"`
	Target string `json:"target"`
	Type   string `json:"type"` // "string" | "number"
}

// Spec holds the normalisation rules for a registered service.
type Spec struct {
	Fields []FieldSpec `json:"fields"`
}

// Service is the canonical representation of a proxied upstream service.
type Service struct {
	ID             int    `json:"id"`
	Name           string `json:"name"`
	BaseURL        string `json:"baseUrl"`
	ResponseFormat string `json:"responseFormat"`
	RoutePattern   string `json:"routePattern"`
	AuthRequired   bool   `json:"authRequired"`
	Spec           Spec   `json:"spec"`
}

// RequestLog records a single proxied HTTP request through the gateway.
type RequestLog struct {
	ID          int       `json:"id"`
	ServiceName string    `json:"serviceName"`
	Method      string    `json:"method"`
	Path        string    `json:"path"`
	StatusCode  int       `json:"statusCode"`
	DurationMs  int       `json:"durationMs"`
	CreatedAt   time.Time `json:"createdAt"`
}
