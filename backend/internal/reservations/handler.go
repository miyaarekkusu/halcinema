package reservations

import (
	"encoding/json"
	"errors"
	"fmt"
	"net/http"
	"strconv"
	"time"

	"github.com/go-chi/chi"
	"github.com/google/uuid"
	"github.com/miyaarekkusu/halcinema/backend/internal/ctxkeys"
	"gorm.io/gorm"
	"gorm.io/gorm/clause"
)

type Reservation struct {
	ReservationID     int       `gorm:"column:f_reservation_id;primaryKey;autoIncrement"`
	MemberID          *int      `gorm:"column:f_member_id"`
	ScheduleID        int       `gorm:"column:f_schedule_id"`
	ReservedAt        time.Time `gorm:"column:f_reserved_at"`
	ReservationCode   string    `gorm:"column:f_reservation_code"`
	TotalAmount       int       `gorm:"column:f_total_amount"`
	PaymentMethod     int       `gorm:"column:f_payment_method"`
	PaymentStatus     int       `gorm:"column:f_payment_status"`
	ReservationStatus int       `gorm:"column:f_reservation_status"`
}

func (Reservation) TableName() string { return "t_reservation" }

type ReservationDetail struct {
	DetailID        int `gorm:"column:f_detail_id;primaryKey;autoIncrement"`
	ReservationID   int `gorm:"column:f_reservation_id"`
	SeatID          int `gorm:"column:f_seat_id"`
	PriceCategoryID int `gorm:"column:f_price_category_id"`
	TicketPrice     int `gorm:"column:f_ticket_price"`
}

func (ReservationDetail) TableName() string { return "t_reservation_detail" }

type Ticket struct {
	TicketID     int       `gorm:"column:f_ticket_id;primaryKey;autoIncrement"`
	DetailID     int       `gorm:"column:f_detail_id"`
	QRCode       string    `gorm:"column:f_qr_code"`
	TicketStatus int       `gorm:"column:f_ticket_status"`
	IssuedAt     time.Time `gorm:"column:f_issued_at"`
}

func (Ticket) TableName() string { return "t_ticket" }

type SeatStock struct {
	StockID     int `gorm:"column:f_stock_id;primaryKey"`
	ScheduleID  int `gorm:"column:f_schedule_id"`
	SeatID      int `gorm:"column:f_seat_id"`
	StockStatus int `gorm:"column:f_stock_status"`
}

func (SeatStock) TableName() string { return "t_seat_stock" }

type ScreenPrice struct {
	PriceID         int `gorm:"column:f_price_id;primaryKey"`
	ScheduleID      int `gorm:"column:f_schedule_id"`
	PriceCategoryID int `gorm:"column:f_price_category_id"`
	Price           int `gorm:"column:f_price"`
}

func (ScreenPrice) TableName() string { return "t_screen_price" }

type Handler struct {
	db *gorm.DB
}

func NewHandler(db *gorm.DB) *Handler {
	return &Handler{db: db}
}

type seatReq struct {
	SeatID          int `json:"seatId"`
	PriceCategoryID int `json:"priceCategoryId"`
}

type createReq struct {
	ScheduleID    int       `json:"scheduleId"`
	Seats         []seatReq `json:"seats"`
	PaymentMethod int       `json:"paymentMethod"`
}

func (h *Handler) Create(w http.ResponseWriter, r *http.Request) {
	var req createReq
	if err := json.NewDecoder(r.Body).Decode(&req); err != nil {
		jsonError(w, "invalid request", http.StatusBadRequest)
		return
	}
	if req.ScheduleID == 0 || len(req.Seats) == 0 {
		jsonError(w, "scheduleId and seats are required", http.StatusBadRequest)
		return
	}
	if req.PaymentMethod < 1 || req.PaymentMethod > 3 {
		req.PaymentMethod = 1
	}

	memberID := memberIDFromCtx(r)

	// JWTのmember_idが実在しない場合（DBリセット後の古いトークン等）、
	// そのままINSERTするとt_reservationの外部キー制約違反(23503)でクラッシュするため
	// 事前に存在確認し、ゲスト扱いに倒せるよう明示的なエラーを返す。
	if memberID > 0 {
		var memberCount int64
		if err := h.db.Table("t_member").Where("f_member_id = ?", memberID).Count(&memberCount).Error; err != nil {
			jsonError(w, "internal error", http.StatusInternalServerError)
			return
		}
		if memberCount == 0 {
			jsonError(w, "session expired, please log in again", http.StatusUnauthorized)
			return
		}
	}

	var reservationID int
	var reservationCode string
	var totalAmount int
	var ticketsOut []map[string]any

	seatIDs := make([]int, len(req.Seats))
	for i, s := range req.Seats {
		seatIDs[i] = s.SeatID
	}

	err := h.db.Transaction(func(tx *gorm.DB) error {
		// 排他ロックで空席確認（GORM clause.Locking + IN ?）
		var lockedStocks []SeatStock
		if err := tx.Clauses(clause.Locking{Strength: "UPDATE"}).
			Where("f_schedule_id = ? AND f_seat_id IN ? AND f_stock_status = 0",
				req.ScheduleID, seatIDs).
			Find(&lockedStocks).Error; err != nil {
			return err
		}
		if len(lockedStocks) != len(req.Seats) {
			return errors.New("seat not available")
		}

		// 合計金額計算
		for _, s := range req.Seats {
			catID := s.PriceCategoryID
			if catID == 0 {
				catID = 1
			}
			var sp ScreenPrice
			price := 1900
			if err := tx.Where("f_schedule_id = ? AND f_price_category_id = ?",
				req.ScheduleID, catID).First(&sp).Error; err == nil {
				price = sp.Price
			}
			totalAmount += price
		}

		reservationCode = fmt.Sprintf("HAL%s", time.Now().Format("20060102150405"))

		resv := Reservation{
			ScheduleID:        req.ScheduleID,
			ReservationCode:   reservationCode,
			TotalAmount:       totalAmount,
			PaymentMethod:     req.PaymentMethod,
			PaymentStatus:     1,
			ReservationStatus: 0,
			ReservedAt:        time.Now(),
		}
		if memberID > 0 {
			resv.MemberID = &memberID
		}
		if err := tx.Create(&resv).Error; err != nil {
			return err
		}
		reservationID = resv.ReservationID

		for _, s := range req.Seats {
			catID := s.PriceCategoryID
			if catID == 0 {
				catID = 1
			}
			price := 1900
			var sp ScreenPrice
			if err := tx.Where("f_schedule_id = ? AND f_price_category_id = ?",
				req.ScheduleID, catID).First(&sp).Error; err == nil {
				price = sp.Price
			}

			detail := ReservationDetail{
				ReservationID:   reservationID,
				SeatID:          s.SeatID,
				PriceCategoryID: catID,
				TicketPrice:     price,
			}
			if err := tx.Create(&detail).Error; err != nil {
				return err
			}

			ticket := Ticket{
				DetailID:     detail.DetailID,
				QRCode:       uuid.New().String(),
				TicketStatus: 1,
				IssuedAt:     time.Now(),
			}
			if err := tx.Create(&ticket).Error; err != nil {
				return err
			}

			var seatRow struct {
				RowLabel   string `gorm:"column:f_row_label"`
				SeatNumber int    `gorm:"column:f_seat_number"`
			}
			tx.Table("t_seat").Select("f_row_label, f_seat_number").
				Where("f_seat_id = ?", s.SeatID).Scan(&seatRow)

			ticketsOut = append(ticketsOut, map[string]any{
				"seatId":     s.SeatID,
				"rowLabel":   seatRow.RowLabel,
				"seatNumber": seatRow.SeatNumber,
				"qrCode":     ticket.QRCode,
				"price":      price,
			})
		}

		// 座席在庫を予約済みに更新
		if err := tx.Model(&SeatStock{}).
			Where("f_schedule_id = ? AND f_seat_id IN ?", req.ScheduleID, seatIDs).
			Update("f_stock_status", 1).Error; err != nil {
			return err
		}

		return nil
	})

	if err != nil {
		if err.Error() == "seat not available" {
			jsonError(w, "seat not available", http.StatusConflict)
		} else {
			jsonError(w, "reservation failed: "+err.Error(), http.StatusInternalServerError)
		}
		return
	}

	w.Header().Set("Content-Type", "application/json")
	w.WriteHeader(http.StatusCreated)
	json.NewEncoder(w).Encode(map[string]any{
		"reservationId":   reservationID,
		"reservationCode": reservationCode,
		"totalAmount":     totalAmount,
		"reservedAt":      time.Now().Format(time.RFC3339),
		"tickets":         ticketsOut,
	})
}

type ticketDetailRow struct {
	SeatID       int    `gorm:"column:f_seat_id"`
	RowLabel     string `gorm:"column:f_row_label"`
	SeatNumber   int    `gorm:"column:f_seat_number"`
	QRCode       string `gorm:"column:f_qr_code"`
	TicketStatus int    `gorm:"column:f_ticket_status"`
	TicketPrice  int    `gorm:"column:f_ticket_price"`
}

// GetOne は予約1件分の詳細（座席ごとのチケット・QRコード一覧）を返す。
// マイページで複数座席予約時に複数チケットを表示するために使う。
func (h *Handler) GetOne(w http.ResponseWriter, r *http.Request) {
	id, err := strconv.Atoi(chi.URLParam(r, "id"))
	if err != nil {
		jsonError(w, "invalid id", http.StatusBadRequest)
		return
	}

	memberID := memberIDFromCtx(r)

	var resv Reservation
	if err := h.db.First(&resv, id).Error; err != nil {
		jsonError(w, "not found", http.StatusNotFound)
		return
	}
	if resv.MemberID == nil || *resv.MemberID != memberID {
		jsonError(w, "forbidden", http.StatusForbidden)
		return
	}

	var rows []ticketDetailRow
	h.db.Raw(`
		SELECT s.f_seat_id, s.f_row_label, s.f_seat_number,
		       t.f_qr_code, t.f_ticket_status, d.f_ticket_price
		FROM t_reservation_detail d
		JOIN t_seat s   ON s.f_seat_id = d.f_seat_id
		JOIN t_ticket t ON t.f_detail_id = d.f_detail_id
		WHERE d.f_reservation_id = ?
		ORDER BY s.f_row_label, s.f_seat_number
	`, id).Scan(&rows)

	tickets := make([]map[string]any, len(rows))
	for i, row := range rows {
		tickets[i] = map[string]any{
			"seatId":     row.SeatID,
			"rowLabel":   row.RowLabel,
			"seatNumber": row.SeatNumber,
			"qrCode":     row.QRCode,
			"status":     row.TicketStatus,
			"price":      row.TicketPrice,
		}
	}

	w.Header().Set("Content-Type", "application/json")
	json.NewEncoder(w).Encode(map[string]any{
		"reservationId":   resv.ReservationID,
		"reservationCode": resv.ReservationCode,
		"totalAmount":     resv.TotalAmount,
		"tickets":         tickets,
	})
}

type myReservation struct {
	ReservationID   int    `gorm:"column:f_reservation_id"`
	ReservationCode string `gorm:"column:f_reservation_code"`
	TotalAmount     int    `gorm:"column:f_total_amount"`
	PaymentMethod   int    `gorm:"column:f_payment_method"`
	ReservedAt      string `gorm:"column:f_reserved_at"`
	MovieTitle      string `gorm:"column:movie_title"`
	ShowDate        string `gorm:"column:f_show_date"`
	StartTime       string `gorm:"column:f_start_time"`
	ScreenName      string `gorm:"column:screen_name"`
}

func (h *Handler) ListMine(w http.ResponseWriter, r *http.Request) {
	memberID := memberIDFromCtx(r)
	if memberID == 0 {
		jsonError(w, "unauthorized", http.StatusUnauthorized)
		return
	}

	var rows []myReservation
	h.db.Raw(`
		SELECT r.f_reservation_id, r.f_reservation_code, r.f_total_amount,
		       r.f_payment_method, CAST(r.f_reserved_at AS TEXT) AS f_reserved_at,
		       m.f_title AS movie_title,
		       CAST(s.f_show_date AS TEXT) AS f_show_date,
		       CAST(s.f_start_time AS TEXT) AS f_start_time,
		       sc.f_screen_name AS screen_name
		FROM t_reservation r
		JOIN t_schedule s  ON s.f_schedule_id = r.f_schedule_id
		JOIN t_movie m     ON m.f_movie_id    = s.f_movie_id
		JOIN t_screen sc   ON sc.f_screen_id  = s.f_screen_id
		WHERE r.f_member_id = ?
		ORDER BY r.f_reserved_at DESC
	`, memberID).Scan(&rows)

	result := make([]map[string]any, len(rows))
	for i, row := range rows {
		result[i] = map[string]any{
			"reservationId":   row.ReservationID,
			"reservationCode": row.ReservationCode,
			"totalAmount":     row.TotalAmount,
			"paymentMethod":   row.PaymentMethod,
			"reservedAt":      row.ReservedAt,
			"movieTitle":      row.MovieTitle,
			"showDate":        row.ShowDate,
			"startTime":       row.StartTime,
			"screenName":      row.ScreenName,
		}
	}

	w.Header().Set("Content-Type", "application/json")
	json.NewEncoder(w).Encode(result)
}

func memberIDFromCtx(r *http.Request) int {
	return ctxkeys.MemberID(r.Context())
}

func jsonError(w http.ResponseWriter, msg string, code int) {
	w.Header().Set("Content-Type", "application/json")
	w.WriteHeader(code)
	json.NewEncoder(w).Encode(map[string]string{"error": msg})
}
