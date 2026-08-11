package router

import (
	"bytes"
	"embed"
	"html"
	"net/http"
	"strings"

	"github.com/QuantumNous/new-api/common"
	"github.com/QuantumNous/new-api/controller"
	"github.com/QuantumNous/new-api/middleware"
	"github.com/gin-contrib/gzip"
	"github.com/gin-contrib/static"
	"github.com/gin-gonic/gin"
)

// WebAssets holds the embedded dashboard frontend assets.
type WebAssets struct {
	BuildFS   embed.FS
	IndexPage []byte
}

// injectFavicon rewrites the favicon <link> tags inside the served index HTML
// so they point at the admin-configured site Logo (common.Logo). Search-engine
// crawlers and link-preview bots read the favicon from the raw HTML response
// and do NOT execute the SPA's runtime favicon swap, so the static <link> tags
// must already carry the correct URL — otherwise Google keeps showing the
// bundled default icon. A fresh slice is always returned; the shared embedded
// page bytes are never mutated. When no custom Logo is configured the page is
// returned unchanged. common.Logo is updated live whenever the admin saves the
// Logo option (see model/option.go), so no restart is required.
func injectFavicon(page []byte) []byte {
	logo := strings.TrimSpace(common.Logo)
	if logo == "" || logo == "/logo.png" {
		return page
	}
	href := []byte(`href="` + html.EscapeString(logo) + `"`)
	// Point every bundled favicon reference at the configured logo.
	page = bytes.ReplaceAll(page, []byte(`href="/logo.png"`), href)
	page = bytes.ReplaceAll(page, []byte(`href="/favicon.ico"`), href)
	return page
}

func SetWebRouter(router *gin.Engine, assets WebAssets) {
	frontendFS := common.EmbedFolder(assets.BuildFS, "web/dist")

	router.Use(gzip.Gzip(gzip.DefaultCompression))
	router.Use(middleware.GlobalWebRateLimit())
	router.Use(middleware.Cache())
	router.Use(static.Serve("/", frontendFS))
	router.NoRoute(func(c *gin.Context) {
		c.Set(middleware.RouteTagKey, "web")
		if strings.HasPrefix(c.Request.RequestURI, "/v1") || strings.HasPrefix(c.Request.RequestURI, "/api") || strings.HasPrefix(c.Request.RequestURI, "/assets") {
			controller.RelayNotFound(c)
			return
		}
		c.Header("Cache-Control", "no-cache")
		c.Data(http.StatusOK, "text/html; charset=utf-8", injectFavicon(assets.IndexPage))
	})
}
