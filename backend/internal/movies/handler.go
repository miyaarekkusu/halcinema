package movies

import (
	"encoding/json"
	"net/http"
	"strconv"
	"strings"

	"github.com/go-chi/chi"
	"gorm.io/gorm"
)

type Movie struct {
	MovieID     int    `gorm:"column:f_movie_id;primaryKey"`
	Title       string `gorm:"column:f_title"`
	TitleEn     string `gorm:"column:f_title_en"`
	Genre       string `gorm:"column:f_genre"`
	Duration    *int   `gorm:"column:f_duration"`
	Rating      string `gorm:"column:f_rating"`
	ReleaseDate string `gorm:"column:f_release_date"`
	Director    string `gorm:"column:f_director"`
	CastInfo    string `gorm:"column:f_cast_info"`
	Synopsis    string `gorm:"column:f_synopsis"`
	Formats     string `gorm:"column:f_formats"`
	IsShowing   int    `gorm:"column:f_is_showing"`
}

func (Movie) TableName() string { return "t_movie" }

type Handler struct {
	db *gorm.DB
}

func NewHandler(db *gorm.DB) *Handler {
	return &Handler{db: db}
}

func (h *Handler) List(w http.ResponseWriter, r *http.Request) {
	var movies []Movie
	q := h.db.Order("f_movie_id")
	if r.URL.Query().Get("showing") == "1" {
		q = q.Where("f_is_showing = 1")
	}
	if err := q.Find(&movies).Error; err != nil {
		jsonError(w, "db error", http.StatusInternalServerError)
		return
	}

	result := make([]map[string]any, len(movies))
	for i, m := range movies {
		result[i] = movieJSON(m)
	}

	w.Header().Set("Content-Type", "application/json")
	json.NewEncoder(w).Encode(result)
}

func (h *Handler) Get(w http.ResponseWriter, r *http.Request) {
	idStr := chi.URLParam(r, "id")
	id, err := strconv.Atoi(idStr)
	if err != nil {
		jsonError(w, "invalid id", http.StatusBadRequest)
		return
	}

	var m Movie
	if err := h.db.First(&m, id).Error; err != nil {
		jsonError(w, "not found", http.StatusNotFound)
		return
	}

	w.Header().Set("Content-Type", "application/json")
	json.NewEncoder(w).Encode(movieJSON(m))
}

func movieJSON(m Movie) map[string]any {
	var duration any
	if m.Duration != nil {
		duration = *m.Duration
	}

	formats := []string{}
	if m.Formats != "" {
		formats = strings.Split(m.Formats, ",")
	}

	return map[string]any{
		"movieId":     m.MovieID,
		"title":       m.Title,
		"titleEn":     m.TitleEn,
		"genre":       m.Genre,
		"duration":    duration,
		"rating":      m.Rating,
		"releaseDate": m.ReleaseDate,
		"director":    m.Director,
		"cast":        m.CastInfo,
		"synopsis":    m.Synopsis,
		"formats":     formats,
		"isShowing":   m.IsShowing,
	}
}

func jsonError(w http.ResponseWriter, msg string, code int) {
	w.Header().Set("Content-Type", "application/json")
	w.WriteHeader(code)
	json.NewEncoder(w).Encode(map[string]string{"error": msg})
}
