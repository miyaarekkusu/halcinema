package chat

// Slots はAI予約(reserve intent)で少しずつ埋まっていく予約条件。
// DBには保存せず、フロントとの往復（リクエスト/レスポンス）だけで状態を持ち回す。
// 0 / 空配列 = 未確定を表す（既存コードの memberID==0=ゲスト 等と同じ流儀）。
type Slots struct {
	MovieID       int    `json:"movieId"`
	ShowDate      string `json:"showDate"` // YYYY-MM-DD。空文字=未確定（日にち選択→上映回選択の順で決める）
	ScheduleID    int    `json:"scheduleId"`
	SeatCount     int    `json:"seatCount"`
	SeatIDs       []int  `json:"seatIds"`
	// HoldToken はWeb予約(zaseki.js)と同じ座席仮押さえの本人確認トークン。
	// フロントが座席選択の確定時に /api/schedules/{id}/hold を呼んで取得し、
	// ここに保持して予約確定(CreateReservation)まで持ち回る。
	HoldToken     string `json:"holdToken"`
	PaymentMethod int    `json:"paymentMethod"`
	CardID        int    `json:"cardId"`
}

// MovieInfo はDeepSeekへのコンテキスト注入・recommend応答の両方で使う映画情報。
type MovieInfo struct {
	MovieID  int    `json:"movieId"`
	Title    string `json:"title"`
	Genre    string `json:"genre"`
	Duration int    `json:"duration"`
	Rating   string `json:"rating"`
	Synopsis string `json:"synopsis"`
	ImageURL string `json:"imageUrl,omitempty"`
}

// ScheduleInfo はAI予約で上映回選択の材料としてDeepSeekへ渡す情報。
type ScheduleInfo struct {
	ScheduleID     int    `json:"scheduleId"`
	ScreenName     string `json:"screenName"`
	ShowDate       string `json:"showDate"`
	StartTime      string `json:"startTime"`
	AvailableSeats int    `json:"availableSeats"`
}

// PaymentOptionInfo は支払い方法の選択肢（会員の保存カード、新規カード登録、QR/窓口）。
// IsNewCard が true の場合はカードがまだ無く、チャット内でカードを新規登録してから
// 支払う選択肢（CardID は 0 のまま）。
type PaymentOptionInfo struct {
	Label     string `json:"label"`  // 例: "Visa •••• 4242（デフォルト）" / "QRコード決済"
	Method    int    `json:"method"` // 1=カード / 2=QR決済 / 3=窓口支払い
	CardID    int    `json:"cardId,omitempty"`
	IsNewCard bool   `json:"isNewCard,omitempty"`
}

type chatRequest struct {
	Intent   string        `json:"intent"`
	Messages []chatMessage `json:"messages"`
	Slots    Slots         `json:"slots"`
	// ViewedMovieIds はフロント(localStorage)が持つ「最近閲覧した映画」の movieId 一覧
	// （新しい順）。intent=recommend のとき、予約履歴とあわせて初回ターンから
	// おすすめの材料にする。他のintentでは無視してよい。
	ViewedMovieIds []int `json:"viewedMovieIds,omitempty"`
}

// UIAction はチャットが決定的なUI（座席ピッカー・予約完了サマリー）を
// フロントに描画させるための指示。DeepSeekは関与しない。
type UIAction struct {
	Type            string           `json:"type"`
	Dates           []map[string]any `json:"dates,omitempty"`
	ScheduleID      int              `json:"scheduleId,omitempty"`
	Schedules       []map[string]any `json:"schedules,omitempty"`
	Seats           []map[string]any `json:"seats,omitempty"`
	Prices          []map[string]any `json:"prices,omitempty"`
	Payments        []map[string]any `json:"payments,omitempty"`
	ReservationID   int              `json:"reservationId,omitempty"`
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
