package schedules

import (
	"encoding/json"
	"net/http"
	"strconv"

	"github.com/go-chi/chi"
	"gorm.io/gorm"
)

type Schedule struct {
	ScheduleID int    `gorm:"column:f_schedule_id;primaryKey"`
	MovieID    int    `gorm:"column:f_movie_id"`
	ScreenID   int    `gorm:"column:f_screen_id"`
	ShowDate   string `gorm:"column:f_show_date"`
	StartTime  string `gorm:"column:f_start_time"`
	Status     int    `gorm:"column:f_status"`
}

func (Schedule) TableName() string { return "t_schedule" }

type SeatStock struct {
	StockID     int `gorm:"column:f_stock_id;primaryKey"`
	ScheduleID  int `gorm:"column:f_schedule_id"`
	SeatID      int `gorm:"column:f_seat_id"`
	StockStatus int `gorm:"column:f_stock_status"`
}

func (SeatStock) TableName() string { return "t_seat_stock" }

type Seat struct {
	SeatID     int    `gorm:"column:f_seat_id;primaryKey"`
	ScreenID   int    `gorm:"column:f_screen_id"`
	RowLabel   string `gorm:"column:f_row_label"`
	SeatNumber int    `gorm:"column:f_seat_number"`
	SeatType   string `gorm:"column:f_seat_type"`
}

func (Seat) TableName() string { return "t_seat" }

type Handler struct {
	db *gorm.DB
}

func NewHandler(db *gorm.DB) *Handler {
	return &Handler{db: db}
}

type scheduleRow struct {
	ScheduleID     int    `gorm:"column:f_schedule_id"`
	MovieID        int    `gorm:"column:f_movie_id"`
	MovieTitle     string `gorm:"column:movie_title"`
	ScreenID       int    `gorm:"column:f_screen_id"`
	ScreenName     string `gorm:"column:screen_name"`
	ScreenType     string `gorm:"column:screen_type"`
	ShowDate       string `gorm:"column:f_show_date"`
	StartTime      string `gorm:"column:f_start_time"`
	Status         int    `gorm:"column:f_status"`
	AvailableSeats int    `gorm:"column:available_seats"`
}

func (h *Handler) List(w http.ResponseWriter, r *http.Request) {
	q := r.URL.Query()

	rawSQL := `
		SELECT
			s.f_schedule_id, s.f_movie_id, m.f_title AS movie_title,
			s.f_screen_id, sc.f_screen_name AS screen_name, sc.f_screen_type AS screen_type,
			CAST(s.f_show_date AS TEXT) AS f_show_date,
			CAST(s.f_start_time AS TEXT) AS f_start_time,
			s.f_status,
			COUNT(CASE WHEN ss.f_stock_status = 0 THEN 1 END) AS available_seats
		FROM t_schedule s
		JOIN t_movie  m  ON m.f_movie_id  = s.f_movie_id
		JOIN t_screen sc ON sc.f_screen_id = s.f_screen_id
		LEFT JOIN t_seat_stock ss ON ss.f_schedule_id = s.f_schedule_id
		WHERE 1=1`

	args := []any{}

	if date := q.Get("date"); date != "" {
		rawSQL += " AND CAST(s.f_show_date AS TEXT) = ?"
		args = append(args, date)
	}
	if screenName := q.Get("screenName"); screenName != "" {
		rawSQL += " AND sc.f_screen_name = ?"
		args = append(args, screenName)
	}
	if startTime := q.Get("startTime"); startTime != "" {
		rawSQL += " AND CAST(s.f_start_time AS TEXT) LIKE ?"
		args = append(args, startTime+"%")
	}
	if movieID := q.Get("movieId"); movieID != "" {
		rawSQL += " AND s.f_movie_id = ?"
		args = append(args, movieID)
	}

	rawSQL += " GROUP BY s.f_schedule_id, m.f_title, sc.f_screen_name, sc.f_screen_type ORDER BY s.f_show_date, s.f_start_time"

	var rows []scheduleRow
	if err := h.db.Raw(rawSQL, args...).Scan(&rows).Error; err != nil {
		jsonError(w, "db error", http.StatusInternalServerError)
		return
	}

	result := make([]map[string]any, len(rows))
	for i, r := range rows {
		result[i] = map[string]any{
			"scheduleId":     r.ScheduleID,
			"movieId":        r.MovieID,
			"movieTitle":     r.MovieTitle,
			"screenId":       r.ScreenID,
			"screenName":     r.ScreenName,
			"screenType":     r.ScreenType,
			"showDate":       r.ShowDate,
			"startTime":      r.StartTime,
			"status":         r.Status,
			"availableSeats": r.AvailableSeats,
		}
	}

	w.Header().Set("Content-Type", "application/json")
	json.NewEncoder(w).Encode(result)
}

type seatWithStock struct {
	SeatID      int    `gorm:"column:f_seat_id"`
	RowLabel    string `gorm:"column:f_row_label"`
	SeatNumber  int    `gorm:"column:f_seat_number"`
	SeatType    string `gorm:"column:f_seat_type"`
	StockStatus int    `gorm:"column:f_stock_status"`
}

func (h *Handler) GetSeats(w http.ResponseWriter, r *http.Request) {
	idStr := chi.URLParam(r, "id")
	scheduleID, err := strconv.Atoi(idStr)
	if err != nil {
		jsonError(w, "invalid id", http.StatusBadRequest)
		return
	}

	var sched Schedule
	if err := h.db.First(&sched, scheduleID).Error; err != nil {
		jsonError(w, "schedule not found", http.StatusNotFound)
		return
	}

	var rows []seatWithStock
	h.db.Raw(`
		SELECT t.f_seat_id, t.f_row_label, t.f_seat_number, t.f_seat_type,
		       COALESCE(ss.f_stock_status, 0) AS f_stock_status
		FROM t_seat t
		LEFT JOIN t_seat_stock ss
		       ON ss.f_seat_id = t.f_seat_id AND ss.f_schedule_id = ?
		WHERE t.f_screen_id = ?
		ORDER BY t.f_row_label, t.f_seat_number
	`, scheduleID, sched.ScreenID).Scan(&rows)

	seats := make([]map[string]any, len(rows))
	for i, s := range rows {
		seats[i] = map[string]any{
			"seatId":     s.SeatID,
			"rowLabel":   s.RowLabel,
			"seatNumber": s.SeatNumber,
			"seatType":   s.SeatType,
			"status":     s.StockStatus,
		}
	}

	w.Header().Set("Content-Type", "application/json")
	json.NewEncoder(w).Encode(map[string]any{
		"scheduleId": scheduleID,
		"seats":      seats,
	})
}

func jsonError(w http.ResponseWriter, msg string, code int) {
	w.Header().Set("Content-Type", "application/json")
	w.WriteHeader(code)
	json.NewEncoder(w).Encode(map[string]string{"error": msg})
}
