package models

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
