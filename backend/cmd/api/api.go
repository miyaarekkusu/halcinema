package main

import (
	"log/slog"
	"net/http"
	"time"

	"github.com/go-chi/chi"
	"github.com/go-chi/chi/middleware"
	"gorm.io/gorm"

	"github.com/miyaarekkusu/halcinema/backend/internal/auth"
	"github.com/miyaarekkusu/halcinema/backend/internal/cards"
	"github.com/miyaarekkusu/halcinema/backend/internal/chat"
	"github.com/miyaarekkusu/halcinema/backend/internal/goodsorder"
	"github.com/miyaarekkusu/halcinema/backend/internal/movies"
	"github.com/miyaarekkusu/halcinema/backend/internal/reservations"
	"github.com/miyaarekkusu/halcinema/backend/internal/schedules"
)

type application struct {
	config appConfig
	db     *gorm.DB
}

type appConfig struct {
	addr string
}

func (app *application) mount() http.Handler {
	r := chi.NewRouter()

	r.Use(middleware.RequestID)
	r.Use(middleware.RealIP)
	r.Use(middleware.Logger)
	r.Use(middleware.Recoverer)
	r.Use(middleware.Timeout(60 * time.Second))
	r.Use(corsMiddleware)

	r.Get("/api/health", func(w http.ResponseWriter, r *http.Request) {
		w.Header().Set("Content-Type", "application/json")
		w.Write([]byte(`{"status":"ok"}`))
	})

	authHandler := auth.NewHandler(app.db)
	r.Post("/api/auth/register", authHandler.Register)
	r.Post("/api/auth/login", authHandler.Login)
	r.With(jwtMiddleware).Get("/api/me", authHandler.GetMe)
	r.With(jwtMiddleware).Patch("/api/me", authHandler.UpdateMe)
	r.With(jwtMiddleware).Patch("/api/me/password", authHandler.ChangePassword)

	movieHandler := movies.NewHandler(app.db)
	r.Get("/api/movies", movieHandler.List)
	r.Get("/api/movies/{id}", movieHandler.Get)

	scheduleHandler := schedules.NewHandler(app.db)
	r.Get("/api/schedules", scheduleHandler.List)
	r.Get("/api/schedules/{id}/seats", scheduleHandler.GetSeats)
	r.Post("/api/schedules/{id}/hold", scheduleHandler.Hold)
	r.Post("/api/schedules/{id}/release-hold", scheduleHandler.ReleaseHold)

	reservationHandler := reservations.NewHandler(app.db)
	r.With(optionalJWTMiddleware).Post("/api/reservations", reservationHandler.Create)
	r.With(jwtMiddleware).Get("/api/me/reservations", reservationHandler.ListMine)
	r.With(jwtMiddleware).Get("/api/me/reservations/{id}", reservationHandler.GetOne)

	cardHandler := cards.NewHandler(app.db)
	r.Route("/api/me/cards", func(r chi.Router) {
		r.Use(jwtMiddleware)
		r.Get("/", cardHandler.List)
		r.Post("/", cardHandler.Create)
		r.Delete("/{id}", cardHandler.Delete)
		r.Patch("/{id}/default", cardHandler.SetDefault)
	})

	chatHandler := chat.NewHandler(app.db)
	r.With(optionalJWTMiddleware).Post("/api/chat", chatHandler.Converse)

	goodsOrderHandler := goodsorder.NewHandler(app.db)
	// 座席予約とセットのフード注文（reservationId指定）はゲスト予約でも行えるよう
	// optionalJWTMiddleware にする。ログイン必須のオンライン単体注文はハンドラ内部で判定する。
	r.With(optionalJWTMiddleware).Post("/api/goods-orders", goodsOrderHandler.Create)
	r.With(jwtMiddleware).Get("/api/me/goods-orders", goodsOrderHandler.ListMine)
	r.With(jwtMiddleware).Get("/api/me/goods-orders/{id}", goodsOrderHandler.GetOne)

	return r
}

func (app *application) run(h http.Handler) error {
	srv := &http.Server{
		Addr:         app.config.addr,
		Handler:      h,
		WriteTimeout: 30 * time.Second,
		ReadTimeout:  10 * time.Second,
		IdleTimeout:  time.Minute,
	}
	slog.Info("HAL Cinema API 起動", "addr", app.config.addr)
	return srv.ListenAndServe()
}
