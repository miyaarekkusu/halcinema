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

	movieHandler := movies.NewHandler(app.db)
	r.Get("/api/movies", movieHandler.List)
	r.Get("/api/movies/{id}", movieHandler.Get)

	scheduleHandler := schedules.NewHandler(app.db)
	r.Get("/api/schedules", scheduleHandler.List)
	r.Get("/api/schedules/{id}/seats", scheduleHandler.GetSeats)

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
