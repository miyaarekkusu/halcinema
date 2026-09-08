package chat

import (
	"fmt"

	"gorm.io/gorm"
)

// このファイルのDBクエリは、既存の movies / schedules / cards パッケージが
// t_movie / t_schedule / t_seat / t_seat_stock / t_member_card に対して行っている
// クエリと同じ条件・同じテーブルを使う（本プロジェクトの既存の流儀として、
// 各パッケージが同じテーブルに対する軽量なGORMモデルをそれぞれ持つ）。

type movieRow struct {
	MovieID   int    `gorm:"column:f_movie_id"`
	Title     string `gorm:"column:f_title"`
	Genre     string `gorm:"column:f_genre"`
	Duration  *int   `gorm:"column:f_duration"`
	Rating    string `gorm:"column:f_rating"`
	Synopsis  string `gorm:"column:f_synopsis"`
	IsShowing int    `gorm:"column:f_is_showing"`
}

func (movieRow) TableName() string { return "t_movie" }

func listShowingMovies(db *gorm.DB) ([]MovieInfo, error) {
	var rows []movieRow
	if err := db.Where("f_is_showing = 1").Order("f_movie_id").Find(&rows).Error; err != nil {
		return nil, err
	}
	movies := make([]MovieInfo, len(rows))
	for i, r := range rows {
		duration := 0
		if r.Duration != nil {
			duration = *r.Duration
		}
		movies[i] = MovieInfo{
			MovieID:  r.MovieID,
			Title:    r.Title,
			Genre:    r.Genre,
			Duration: duration,
			Rating:   r.Rating,
			Synopsis: r.Synopsis,
		}
	}
	return movies, nil
}

func movieExists(db *gorm.DB, movieID int) bool {
	var count int64
	db.Table("t_movie").Where("f_movie_id = ?", movieID).Count(&count)
	return count > 0
}

type scheduleRow struct {
	ScheduleID     int    `gorm:"column:f_schedule_id"`
	ScreenID       int    `gorm:"column:f_screen_id"`
	ScreenName     string `gorm:"column:screen_name"`
	ShowDate       string `gorm:"column:f_show_date"`
	StartTime      string `gorm:"column:f_start_time"`
	AvailableSeats int    `gorm:"column:available_seats"`
}

// listSchedulesForMovie は指定映画の販売中(f_status=0)の上映回一覧を、
// 直近のものから最大20件だけ返す（上映期間が長い映画だと数十〜数百件になり、
// そのままDeepSeekのプロンプトに載せるとコンテキストが肥大化するため）。
// schedules.Handler.List と同じJOIN構成（t_schedule + t_screen + t_seat_stock集計）。
func listSchedulesForMovie(db *gorm.DB, movieID int) ([]ScheduleInfo, error) {
	var rows []scheduleRow
	err := db.Raw(`
		SELECT
			s.f_schedule_id, s.f_screen_id, sc.f_screen_name AS screen_name,
			CAST(s.f_show_date AS TEXT) AS f_show_date,
			CAST(s.f_start_time AS TEXT) AS f_start_time,
			COUNT(CASE WHEN ss.f_stock_status = 0 THEN 1 END) AS available_seats
		FROM t_schedule s
		JOIN t_screen sc ON sc.f_screen_id = s.f_screen_id
		LEFT JOIN t_seat_stock ss ON ss.f_schedule_id = s.f_schedule_id
		WHERE s.f_movie_id = ? AND s.f_status = 0
		GROUP BY s.f_schedule_id, sc.f_screen_name
		ORDER BY s.f_show_date, s.f_start_time
		LIMIT 20
	`, movieID).Scan(&rows).Error
	if err != nil {
		return nil, err
	}
	schedules := make([]ScheduleInfo, len(rows))
	for i, r := range rows {
		schedules[i] = ScheduleInfo{
			ScheduleID:     r.ScheduleID,
			ScreenName:     r.ScreenName,
			ShowDate:       r.ShowDate,
			StartTime:      r.StartTime,
			AvailableSeats: r.AvailableSeats,
		}
	}
	return schedules, nil
}

// scheduleBelongsToMovie は scheduleId が実在し、かつ movieId の上映回であることを確認する。
func scheduleBelongsToMovie(db *gorm.DB, scheduleID, movieID int) bool {
	var count int64
	db.Table("t_schedule").
		Where("f_schedule_id = ? AND f_movie_id = ?", scheduleID, movieID).
		Count(&count)
	return count > 0
}

func scheduleScreenID(db *gorm.DB, scheduleID int) (int, error) {
	var screenID int
	err := db.Table("t_schedule").Select("f_screen_id").
		Where("f_schedule_id = ?", scheduleID).Scan(&screenID).Error
	return screenID, err
}

type cardRow struct {
	CardID    int    `gorm:"column:f_card_id"`
	CardBrand string `gorm:"column:f_card_brand"`
	CardLast4 string `gorm:"column:f_card_last4"`
	IsDefault int    `gorm:"column:f_is_default"`
}

func (cardRow) TableName() string { return "t_member_card" }

// listPaymentOptions は支払い方法の選択肢を返す。会員は保存カード＋QR/窓口、
// ゲストは保存カードがないためQR/窓口のみ（cards.Handler.List と同じクエリ条件）。
func listPaymentOptions(db *gorm.DB, memberID int) ([]PaymentOptionInfo, error) {
	var options []PaymentOptionInfo

	if memberID > 0 {
		var cards []cardRow
		if err := db.Where("f_member_id = ?", memberID).
			Order("f_is_default DESC, f_card_id DESC").Find(&cards).Error; err != nil {
			return nil, err
		}
		for _, c := range cards {
			label := fmt.Sprintf("%s •••• %s", c.CardBrand, c.CardLast4)
			if c.IsDefault == 1 {
				label += "（デフォルト）"
			}
			options = append(options, PaymentOptionInfo{Label: label, Method: 1, CardID: c.CardID})
		}
	}

	options = append(options,
		PaymentOptionInfo{Label: "QRコード決済", Method: 2},
		PaymentOptionInfo{Label: "劇場窓口で支払い", Method: 3},
	)
	return options, nil
}

func cardBelongsToMember(db *gorm.DB, cardID, memberID int) bool {
	if cardID <= 0 || memberID <= 0 {
		return false
	}
	var count int64
	db.Table("t_member_card").
		Where("f_card_id = ? AND f_member_id = ?", cardID, memberID).
		Count(&count)
	return count > 0
}

type seatWithStockRow struct {
	SeatID      int    `gorm:"column:f_seat_id"`
	RowLabel    string `gorm:"column:f_row_label"`
	SeatNumber  int    `gorm:"column:f_seat_number"`
	SeatType    string `gorm:"column:f_seat_type"`
	StockStatus int    `gorm:"column:f_stock_status"`
}

type priceRow struct {
	PriceCategoryID int    `gorm:"column:f_price_category_id"`
	CategoryName    string `gorm:"column:f_category_name"`
	Price           int    `gorm:"column:f_price"`
}

// buildSeatPickerAction は座席選択UI(uiAction.type=seat_picker)用のデータを組み立てる。
// schedules.Handler.GetSeats と同じJOIN構成に加え、t_screen_price/t_price_categoryを
// 結合して料金区分も返す（GetSeatsにはない情報）。
func buildSeatPickerAction(db *gorm.DB, scheduleID int) (*UIAction, error) {
	screenID, err := scheduleScreenID(db, scheduleID)
	if err != nil {
		return nil, err
	}

	var seatRows []seatWithStockRow
	if err := db.Raw(`
		SELECT t.f_seat_id, t.f_row_label, t.f_seat_number, t.f_seat_type,
		       COALESCE(ss.f_stock_status, 0) AS f_stock_status
		FROM t_seat t
		LEFT JOIN t_seat_stock ss
		       ON ss.f_seat_id = t.f_seat_id AND ss.f_schedule_id = ?
		WHERE t.f_screen_id = ?
		ORDER BY t.f_row_label, t.f_seat_number
	`, scheduleID, screenID).Scan(&seatRows).Error; err != nil {
		return nil, err
	}

	seats := make([]map[string]any, len(seatRows))
	for i, s := range seatRows {
		seats[i] = map[string]any{
			"seatId":     s.SeatID,
			"rowLabel":   s.RowLabel,
			"seatNumber": s.SeatNumber,
			"seatType":   s.SeatType,
			"status":     s.StockStatus,
		}
	}

	var priceRows []priceRow
	db.Raw(`
		SELECT sp.f_price_category_id, pc.f_category_name, sp.f_price
		FROM t_screen_price sp
		JOIN t_price_category pc ON pc.f_price_category_id = sp.f_price_category_id
		WHERE sp.f_schedule_id = ?
		ORDER BY sp.f_price_category_id
	`, scheduleID).Scan(&priceRows)

	prices := make([]map[string]any, len(priceRows))
	for i, p := range priceRows {
		prices[i] = map[string]any{
			"priceCategoryId": p.PriceCategoryID,
			"label":           p.CategoryName,
			"price":           p.Price,
		}
	}

	return &UIAction{
		Type:       "seat_picker",
		ScheduleID: scheduleID,
		Seats:      seats,
		Prices:     prices,
	}, nil
}

type scheduleSummaryRow struct {
	MovieTitle string `gorm:"column:movie_title"`
	ShowDate   string `gorm:"column:f_show_date"`
	StartTime  string `gorm:"column:f_start_time"`
	ScreenName string `gorm:"column:screen_name"`
}

// scheduleSummary は予約確定サマリー表示用に映画名・日時・スクリーン名をまとめて取得する。
func scheduleSummary(db *gorm.DB, scheduleID int) (scheduleSummaryRow, error) {
	var row scheduleSummaryRow
	err := db.Raw(`
		SELECT m.f_title AS movie_title,
		       CAST(s.f_show_date AS TEXT) AS f_show_date,
		       CAST(s.f_start_time AS TEXT) AS f_start_time,
		       sc.f_screen_name AS screen_name
		FROM t_schedule s
		JOIN t_movie  m  ON m.f_movie_id  = s.f_movie_id
		JOIN t_screen sc ON sc.f_screen_id = s.f_screen_id
		WHERE s.f_schedule_id = ?
	`, scheduleID).Scan(&row).Error
	return row, err
}
