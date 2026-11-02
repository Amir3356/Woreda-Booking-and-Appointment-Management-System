// Package proxy builds reverse proxies to upstream services.
package proxy

import (
	"fmt"
	"log/slog"
	"net/http"
	"net/http/httputil"
	"net/url"

	"github.com/woreda/booking/api-gateway/middleware"
)

// New returns a reverse proxy that forwards requests unchanged (full /api/v1 path) to target.
func New(target string, logger *slog.Logger) (*httputil.ReverseProxy, error) {
	u, err := url.Parse(target)
	if err != nil {
		return nil, fmt.Errorf("parse upstream %q: %w", target, err)
	}
	p := &httputil.ReverseProxy{
		Rewrite: func(pr *httputil.ProxyRequest) {
			pr.SetURL(u)
			pr.SetXForwarded()
		},
		ErrorHandler: func(w http.ResponseWriter, r *http.Request, err error) {
			logger.Error("upstream error", "upstream", target, "path", r.URL.Path, "err", err)
			middleware.WriteError(w, r, http.StatusBadGateway, "BAD_GATEWAY", "Upstream service unavailable.")
		},
	}
	return p, nil
}
