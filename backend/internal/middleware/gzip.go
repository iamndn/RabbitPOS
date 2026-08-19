package middleware

import (
	"compress/gzip"
	"io"
	"strings"
	"sync"

	"github.com/gin-gonic/gin"
)

type gzipWriter struct {
	gin.ResponseWriter
	writer io.Writer
}

func (g *gzipWriter) Write(data []byte) (int, error) {
	return g.writer.Write(data)
}

func (g *gzipWriter) WriteString(s string) (int, error) {
	return g.writer.Write([]byte(s))
}

// GzipMiddleware compresses HTTP responses with gzip for clients supporting Accept-Encoding: gzip
func GzipMiddleware() gin.HandlerFunc {
	gzPool := sync.Pool{
		New: func() interface{} {
			gz, err := gzip.NewWriterLevel(io.Discard, gzip.DefaultCompression)
			if err != nil {
				return gzip.NewWriter(io.Discard)
			}
			return gz
		},
	}

	return func(c *gin.Context) {
		// Only compress if client accepts gzip
		if !strings.Contains(c.GetHeader("Accept-Encoding"), "gzip") {
			c.Next()
			return
		}

		// Skip compression for WebSocket upgrade requests or server-sent events
		if c.GetHeader("Sec-WebSocket-Key") != "" || c.GetHeader("Upgrade") == "websocket" {
			c.Next()
			return
		}

		gz := gzPool.Get().(*gzip.Writer)
		defer gzPool.Put(gz)
		gz.Reset(c.Writer)
		defer gz.Close()

		c.Header("Content-Encoding", "gzip")
		c.Header("Vary", "Accept-Encoding")

		c.Writer = &gzipWriter{
			ResponseWriter: c.Writer,
			writer:         gz,
		}

		c.Next()
	}
}
