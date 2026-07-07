package main

import (
	"log/slog"
	"os"

	"github.com/joho/godotenv"
	"github.com/miyaarekkusu/halcinema/backend/internal/config"
)

func main() {
	_ = godotenv.Load()

	logger := slog.New(slog.NewTextHandler(os.Stdout, nil))
	slog.SetDefault(logger)

	db, err := config.NewDB()
	if err != nil {
		slog.Error("DB接続失敗", "error", err)
		os.Exit(1)
	}

	sqlDB, err := db.DB()
	if err != nil {
		slog.Error("DB取得失敗", "error", err)
		os.Exit(1)
	}
	defer sqlDB.Close()

	addr := ":8080"
	if port := os.Getenv("PORT"); port != "" {
		addr = ":" + port
	}

	app := application{
		config: appConfig{addr: addr},
		db:     db,
	}

	if err := app.run(app.mount()); err != nil {
		slog.Error("サーバー起動失敗", "error", err)
		os.Exit(1)
	}
}
