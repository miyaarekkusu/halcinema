package chat

// Slots はAI予約(reserve intent)で少しずつ埋まっていく予約条件。
// DBには保存せず、フロントとの往復（リクエスト/レスポンス）だけで状態を持ち回す。
// 0 / 空配列 = 未確定を表す（既存コードの memberID==0=ゲスト 等と同じ流儀）。
type Slots struct {
	MovieID       int   `json:"movieId"`
	ScheduleID    int   `json:"scheduleId"`
	SeatCount     int   `json:"seatCount"`
	SeatIDs       []int `json:"seatIds"`
	PaymentMethod int   `json:"paymentMethod"`
	CardID        int   `json:"cardId"`
}

// MovieInfo はDeepSeekへのコンテキスト注入・recommend応答の両方で使う映画情報。
type MovieInfo struct {
	MovieID  int    `json:"movieId"`
	Title    string `json:"title"`
	Genre    string `json:"genre"`
	Duration int    `json:"duration"`
	Rating   string `json:"rating"`
	Synopsis string `json:"synopsis"`
}

// ScheduleInfo はAI予約で上映回選択の材料としてDeepSeekへ渡す情報。
type ScheduleInfo struct {
	ScheduleID     int    `json:"scheduleId"`
	ScreenName     string `json:"screenName"`
	ShowDate       string `json:"showDate"`
	StartTime      string `json:"startTime"`
	AvailableSeats int    `json:"availableSeats"`
}

// PaymentOptionInfo は支払い方法の選択肢（会員の保存カード、またはQR/窓口）。
// CardID が 0 のものはカードではない支払い方法（Method のみ有効）。
type PaymentOptionInfo struct {
	Label  string `json:"label"`  // 例: "Visa •••• 4242（デフォルト）" / "QRコード決済"
	Method int    `json:"method"` // 1=カード / 2=QR決済 / 3=窓口支払い
	CardID int    `json:"cardId,omitempty"`
}

type chatRequest struct {
	Intent   string        `json:"intent"`
	Messages []chatMessage `json:"messages"`
	Slots    Slots         `json:"slots"`
}

// UIAction はチャットが決定的なUI（座席ピッカー・予約完了サマリー）を
// フロントに描画させるための指示。DeepSeekは関与しない。
type UIAction struct {
	Type            string           `json:"type"`
	ScheduleID      int              `json:"scheduleId,omitempty"`
	Seats           []map[string]any `json:"seats,omitempty"`
	Prices          []map[string]any `json:"prices,omitempty"`
	ReservationCode string           `json:"reservationCode,omitempty"`
	TotalAmount     int              `json:"totalAmount,omitempty"`
	Tickets         []map[string]any `json:"tickets,omitempty"`
	MovieTitle      string           `json:"movieTitle,omitempty"`
	ShowDate        string           `json:"showDate,omitempty"`
	StartTime       string           `json:"startTime,omitempty"`
	ScreenName      string           `json:"screenName,omitempty"`
}

type chatResponse struct {
	Reply             string        `json:"reply"`
	Messages          []chatMessage `json:"messages"`
	Slots             Slots         `json:"slots"`
	RecommendedMovies []MovieInfo   `json:"recommendedMovies,omitempty"`
	UIAction          *UIAction     `json:"uiAction,omitempty"`
}
