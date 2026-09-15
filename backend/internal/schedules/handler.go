package schedules

import (
	"encoding/json"
	"net/http"
	"strconv"
	"strings"
	"time"

	"github.com/go-chi/chi"
	"gorm.io/gorm"
	"gorm.io/gorm/clause"
)

// HoldDurationMinutes は座席の仮押さえ（次へ押下〜決済完了までのロック）の有効時間。
// この間に決済が完了しなければ自動的に空席へ戻る（バッチ不要、参照時に判定）。
const HoldDurationMinutes = 10

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
	StockID         int        `gorm:"column:f_stock_id;primaryKey"`
	ScheduleID      int        `gorm:"column:f_schedule_id"`
	SeatID          int        `gorm:"column:f_seat_id"`
	StockStatus     int        `gorm:"column:f_stock_status"`
	HoldToken       *string    `gorm:"column:f_hold_token"`
	HoldExpiresAt   *time.Time `gorm:"column:f_hold_expires_at"`
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

	// 仮押さえ（f_stock_status=3）は f_hold_expires_at を過ぎていれば
	// バッチを挟まずその場で空席（0）扱いにする。
	var rows []seatWithStock
	h.db.Raw(`
		SELECT t.f_seat_id, t.f_row_label, t.f_seat_number, t.f_seat_type,
		       CASE
		         WHEN ss.f_stock_status = 3 AND ss.f_hold_expires_at < CURRENT_TIMESTAMP THEN 0
		         ELSE COALESCE(ss.f_stock_status, 0)
		       END AS f_stock_status
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

type holdReq struct {
	SeatIDs   []int  `json:"seatIds"`
	HoldToken string `json:"holdToken"`
}

// Hold は座席選択画面で「次へ」を押した時点で対象の座席を一時的にロックする。
// 他のユーザーには「予約中」として見え、HoldDurationMinutes以内に決済が完了
// しなければ自動的に空席へ戻る。すでに自分自身（同じholdToken）が保持している
// 座席や、期限切れの仮押さえも取得対象にしてよい。
func (h *Handler) Hold(w http.ResponseWriter, r *http.Request) {
	scheduleID, err := strconv.Atoi(chi.URLParam(r, "id"))
	if err != nil {
		jsonError(w, "invalid id", http.StatusBadRequest)
		return
	}

	var req holdReq
	if err := json.NewDecoder(r.Body).Decode(&req); err != nil {
		jsonError(w, "invalid request", http.StatusBadRequest)
		return
	}
	req.HoldToken = strings.TrimSpace(req.HoldToken)
	if len(req.SeatIDs) == 0 || req.HoldToken == "" {
		jsonError(w, "seatIds and holdToken are required", http.StatusBadRequest)
		return
	}

	expiresAt := time.Now().Add(HoldDurationMinutes * time.Minute)
	var unavailable []int

	err = h.db.Transaction(func(tx *gorm.DB) error {
		var stocks []SeatStock
		if err := tx.Clauses(clause.Locking{Strength: "UPDATE"}).
			Where("f_schedule_id = ? AND f_seat_id IN ?", scheduleID, req.SeatIDs).
			Find(&stocks).Error; err != nil {
			return err
		}

		stockBySeat := make(map[int]SeatStock, len(stocks))
		for _, s := range stocks {
			stockBySeat[s.SeatID] = s
		}

		for _, seatID := range req.SeatIDs {
			s, exists := stockBySeat[seatID]
			acquirable := !exists || s.StockStatus == 0 ||
				(s.StockStatus == 3 && s.HoldToken != nil && *s.HoldToken == req.HoldToken) ||
				(s.StockStatus == 3 && s.HoldExpiresAt != nil && s.HoldExpiresAt.Before(time.Now()))
			if !acquirable {
				unavailable = append(unavailable, seatID)
			}
		}
		if len(unavailable) > 0 {
			return nil // ロールバック不要（何も更新しない）。呼び出し元にunavailableを返す
		}

		for _, seatID := range req.SeatIDs {
			if _, exists := stockBySeat[seatID]; exists {
				if err := tx.Model(&SeatStock{}).
					Where("f_schedule_id = ? AND f_seat_id = ?", scheduleID, seatID).
					Updates(map[string]any{
						"f_stock_status":    3,
						"f_hold_token":      req.HoldToken,
						"f_hold_expires_at": expiresAt,
					}).Error; err != nil {
					return err
				}
			} else {
				if err := tx.Create(&SeatStock{
					ScheduleID:    scheduleID,
					SeatID:        seatID,
					StockStatus:   3,
					HoldToken:     &req.HoldToken,
					HoldExpiresAt: &expiresAt,
				}).Error; err != nil {
					return err
				}
			}
		}
		return nil
	})
	if err != nil {
		jsonError(w, "hold failed: "+err.Error(), http.StatusInternalServerError)
		return
	}

	w.Header().Set("Content-Type", "application/json")
	if len(unavailable) > 0 {
		w.WriteHeader(http.StatusConflict)
		json.NewEncoder(w).Encode(map[string]any{
			"error":       "seat not available",
			"unavailable": unavailable,
		})
		return
	}
	json.NewEncoder(w).Encode(map[string]any{
		"ok":        true,
		"expiresAt": expiresAt.Format(time.RFC3339),
	})
}

// ReleaseHold は座席選択のやり直し等で仮押さえを明示的に解放する。
// 自分（同じholdToken）が保持している座席だけを空席に戻す。
func (h *Handler) ReleaseHold(w http.ResponseWriter, r *http.Request) {
	scheduleID, err := strconv.Atoi(chi.URLParam(r, "id"))
	if err != nil {
		jsonError(w, "invalid id", http.StatusBadRequest)
		return
	}

	var req holdReq
	if err := json.NewDecoder(r.Body).Decode(&req); err != nil {
		jsonError(w, "invalid request", http.StatusBadRequest)
		return
	}
	req.HoldToken = strings.TrimSpace(req.HoldToken)
	if req.HoldToken == "" {
		jsonError(w, "holdToken is required", http.StatusBadRequest)
		return
	}

	q := h.db.Model(&SeatStock{}).
		Where("f_schedule_id = ? AND f_stock_status = 3 AND f_hold_token = ?", scheduleID, req.HoldToken)
	if len(req.SeatIDs) > 0 {
		q = q.Where("f_seat_id IN ?", req.SeatIDs)
	}
	q.Updates(map[string]any{
		"f_stock_status":    0,
		"f_hold_token":      nil,
		"f_hold_expires_at": nil,
	})

	w.Header().Set("Content-Type", "application/json")
	json.NewEncoder(w).Encode(map[string]any{"ok": true})
}

func jsonError(w http.ResponseWriter, msg string, code int) {
	w.Header().Set("Content-Type", "application/json")
	w.WriteHeader(code)
	json.NewEncoder(w).Encode(map[string]string{"error": msg})
}
