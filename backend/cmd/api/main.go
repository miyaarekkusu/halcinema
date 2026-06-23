package main

import (
	"log"
	"net/http"
	"os"

	"github.com/gin-gonic/gin"
	"github.com/joho/godotenv"
	"github.com/miyaarekkusu/halcinema/backend/internal/config"
)

func main() {
	// Docker環境では環境変数が直接渡されるため、エラーは無視してOK
	_ = godotenv.Load()

	db, err := config.NewDB()
	if err != nil {
		log.Fatalf("DB接続失敗: %v", err)
	}

	sqlDB, err := db.DB()
	if err != nil {
		log.Fatalf("DB取得失敗: %v", err)
	}
	defer sqlDB.Close()

	r := gin.Default()

	r.GET("/api/health", func(c *gin.Context) {
		if err := sqlDB.Ping(); err != nil {
			c.JSON(http.StatusServiceUnavailable, gin.H{"status": "db error", "error": err.Error()})
			return
		}
		c.JSON(http.StatusOK, gin.H{"status": "ok"})
	})

	port := os.Getenv("PORT")
	if port == "" {
		port = "8080"
	}

	log.Printf("HAL Cinema API 起動 → http://localhost:%s", port)
	if err := r.Run(":" + port); err != nil {
		log.Fatalf("サーバー起動失敗: %v", err)
	}
}
