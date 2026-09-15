package chat

import (
	"context"
	"encoding/json"
	"errors"
	"fmt"
	"net/http"
	"os"
	"time"

	"github.com/miyaarekkusu/halcinema/backend/internal/ctxkeys"
	"github.com/miyaarekkusu/halcinema/backend/internal/reservations"
	"gorm.io/gorm"
)

type Handler struct {
	db       *gorm.DB
	deepseek *DeepSeekClient
}

func NewHandler(db *gorm.DB) *Handler {
	return &Handler{
		db:       db,
		deepseek: NewDeepSeekClient(os.Getenv("DEEPSEEK_API_KEY")),
	}
}

// Converse は POST /api/chat 本体。intentごとに固定プロンプトをDeepSeekへ1回投げて
// JSONを取得・処理する（tool callingは使わない）。座席選択・予約確定だけは
// DeepSeekを介さない決定的な処理として扱う。
func (h *Handler) Converse(w http.ResponseWriter, r *http.Request) {
	var req chatRequest
	if err := json.NewDecoder(r.Body).Decode(&req); err != nil {
		jsonError(w, "invalid request", http.StatusBadRequest)
		return
	}

	memberID := ctxkeys.MemberID(r.Context())

	switch req.Intent {
	case "assistant":
		h.handleAssistant(w, r.Context(), req)
	case "recommend":
		h.handleRecommend(w, r.Context(), req, memberID)
	case "reserve":
		h.handleReserve(w, r.Context(), req, memberID)
	default:
		jsonError(w, "invalid intent", http.StatusBadRequest)
	}
}

// requireLogin は「おすすめ映画」「AI予約」がログイン必須になったことに対する保険。
// フロント（AIチャットボットページ）は未ログインなら入口でログインへ誘導するが、
// /api/chat は optionalJWTMiddleware のままなので、直接APIを叩かれた場合に備えて
// ハンドラ側でも memberID を確認する。
func requireLogin(w http.ResponseWriter, req chatRequest, memberID int) bool {
	if memberID > 0 {
		return true
	}
	writeJSON(w, chatResponse{
		Reply:    "この機能はログイン会員向けです。マイページ上部の「ログイン」からログインしてから、もう一度お試しください。",
		Messages: req.Messages,
		Slots:    req.Slots,
	})
	return false
}

func (h *Handler) handleAssistant(w http.ResponseWriter, ctx context.Context, req chatRequest) {
	raw, err := h.deepseek.Complete(ctx, assistantPrompt, req.Messages)
	if err != nil {
		writeFallback(w, req, "只今混み合っております。少し時間をおいて再度お試しください。")
		return
	}

	var parsed struct {
		Reply string `json:"reply"`
	}
	if jsonErr := json.Unmarshal([]byte(raw), &parsed); jsonErr != nil || parsed.Reply == "" {
		writeFallback(w, req, "うまく処理できませんでした。もう一度お試しください。")
		return
	}

	writeJSON(w, chatResponse{
		Reply:    parsed.Reply,
		Messages: appendAssistantTurn(req.Messages, raw),
		Slots:    req.Slots,
	})
}

func (h *Handler) handleRecommend(w http.ResponseWriter, ctx context.Context, req chatRequest, memberID int) {
	if !requireLogin(w, req, memberID) {
		return
	}

	movies, err := listShowingMovies(h.db)
	if err != nil {
		writeFallback(w, req, "映画情報の取得に失敗しました。もう一度お試しください。")
		return
	}

	genreHistory, err := memberGenreHistory(h.db, memberID, 3)
	if err != nil {
		genreHistory = nil // 取得失敗してもレコメンド自体は続行する（参考情報でしかないため）
	}

	viewHistory, err := viewedGenres(h.db, req.ViewedMovieIds)
	if err != nil {
		viewHistory = nil // 同上
	}

	raw, err := h.deepseek.Complete(ctx, recommendPrompt(movies, genreHistory, viewHistory), req.Messages)
	if err != nil {
		writeFallback(w, req, "只今混み合っております。少し時間をおいて再度お試しください。")
		return
	}

	var parsed struct {
		Reply               string `json:"reply"`
		RecommendedMovieIDs []int  `json:"recommendedMovieIds"`
	}
	if jsonErr := json.Unmarshal([]byte(raw), &parsed); jsonErr != nil || parsed.Reply == "" {
		writeFallback(w, req, "うまく処理できませんでした。もう一度お試しください。")
		return
	}

	byID := make(map[int]MovieInfo, len(movies))
	for _, m := range movies {
		byID[m.MovieID] = m
	}
	var recommended []MovieInfo
	for _, id := range parsed.RecommendedMovieIDs {
		// リストに実在するIDだけを採用する（ハルシネーション対策）
		if m, ok := byID[id]; ok {
			recommended = append(recommended, m)
		}
	}

	writeJSON(w, chatResponse{
		Reply:             parsed.Reply,
		Messages:          appendAssistantTurn(req.Messages, raw),
		Slots:             req.Slots,
		RecommendedMovies: recommended,
	})
}

func (h *Handler) handleReserve(w http.ResponseWriter, ctx context.Context, req chatRequest, memberID int) {
	if !requireLogin(w, req, memberID) {
		return
	}

	slots := req.Slots

	// 決定的処理0a: 映画・人数は決まっているが日にちが未選択→今後14日間の日にちをその場で提示。DeepSeekは呼ばない。
	if slots.MovieID > 0 && slots.SeatCount > 0 && slots.ShowDate == "" && slots.ScheduleID == 0 {
		h.presentDatePicker(w, req.Messages, slots)
		return
	}

	// 決定的処理0b: 日にちは決まっているが上映回が未選択→その日の上映時間をその場で提示。DeepSeekは呼ばない。
	if slots.MovieID > 0 && slots.SeatCount > 0 && slots.ShowDate != "" && slots.ScheduleID == 0 {
		h.presentSchedulePicker(w, req.Messages, slots)
		return
	}

	// 決定的処理1: 映画・上映回・人数は決まっているが座席が未選択→(再)提示。DeepSeekは呼ばない。
	if slots.MovieID > 0 && slots.ScheduleID > 0 && slots.SeatCount > 0 && len(slots.SeatIDs) == 0 {
		h.presentSeatPicker(w, req.Messages, slots, "座席をお選びください（複数選択できます）。")
		return
	}

	// 決定的処理1.5: 座席は決まっているが支払い方法が未選択→その場で提示。DeepSeekは呼ばない。
	if slots.MovieID > 0 && slots.ScheduleID > 0 && len(slots.SeatIDs) > 0 && slots.PaymentMethod == 0 {
		if err := h.presentPaymentPicker(w, req.Messages, slots, memberID); err != nil {
			writeFallback(w, req, "支払い方法の取得に失敗しました。もう一度お試しください。")
		}
		return
	}

	// 決定的処理2: 全条件が揃った→予約確定。DeepSeekは呼ばない。
	if slots.MovieID > 0 && slots.ScheduleID > 0 && len(slots.SeatIDs) > 0 && slots.PaymentMethod > 0 {
		h.finalizeReservation(w, req.Messages, slots, memberID)
		return
	}

	// それ以外は、足りない条件に応じたコンテキストを注入してDeepSeekへ1回だけ投げる
	promptCtx := reservePromptContext{Slots: slots}
	var err error
	switch {
	case slots.MovieID == 0:
		promptCtx.Stage = reserveStageMovie
		promptCtx.Movies, err = listShowingMovies(h.db)
	case slots.SeatCount == 0:
		// 人数は日程より先に聞く（「何名か」→「いつ・今週のどの回か」の順）。
		// 上映回はここでは聞かない：人数が決まった時点で決定的処理0（presentSchedulePicker）に進む。
		promptCtx.Stage = reserveStageSeatCount
	}
	if err != nil {
		writeFallback(w, req, "情報の取得に失敗しました。もう一度お試しください。")
		return
	}

	raw, err := h.deepseek.Complete(ctx, reservePrompt(promptCtx), req.Messages)
	if err != nil {
		writeFallback(w, req, "只今混み合っております。少し時間をおいて再度お試しください。")
		return
	}

	var parsed struct {
		Reply string `json:"reply"`
		Slots Slots  `json:"slots"`
	}
	if jsonErr := json.Unmarshal([]byte(raw), &parsed); jsonErr != nil || parsed.Reply == "" {
		writeFallback(w, req, "うまく処理できませんでした。もう一度お試しください。")
		return
	}

	merged := mergeSlots(h.db, slots, parsed.Slots, memberID)
	messages := appendAssistantTurn(req.Messages, raw)

	// マージ後に映画・人数が揃ったら、ここでも日にちピッカーへ（LLM抜き）
	if merged.MovieID > 0 && merged.SeatCount > 0 && merged.ShowDate == "" && merged.ScheduleID == 0 {
		h.presentDatePicker(w, messages, merged)
		return
	}

	// マージ後に日にちも決まっていたら、ここでも上映回ピッカーへ（LLM抜き）
	if merged.MovieID > 0 && merged.SeatCount > 0 && merged.ShowDate != "" && merged.ScheduleID == 0 {
		h.presentSchedulePicker(w, messages, merged)
		return
	}

	// マージ後に映画・上映回・人数が揃ったら、ここでも座席ピッカーへ（LLM抜き）
	if merged.MovieID > 0 && merged.ScheduleID > 0 && merged.SeatCount > 0 && len(merged.SeatIDs) == 0 {
		h.presentSeatPicker(w, messages, merged, parsed.Reply)
		return
	}

	// マージ後に座席も決まっていたら、ここでも支払い方法ピッカーへ（LLM抜き）
	if merged.MovieID > 0 && merged.ScheduleID > 0 && len(merged.SeatIDs) > 0 && merged.PaymentMethod == 0 {
		if err := h.presentPaymentPicker(w, messages, merged, memberID); err != nil {
			writeFallback(w, req, "支払い方法の取得に失敗しました。もう一度お試しください。")
		}
		return
	}

	// マージ後に全条件が揃った（このターンで支払い方法が決まった等）→ここでも予約確定。DeepSeekは呼ばない。
	if merged.MovieID > 0 && merged.ScheduleID > 0 && len(merged.SeatIDs) > 0 && merged.PaymentMethod > 0 {
		h.finalizeReservation(w, messages, merged, memberID)
		return
	}

	writeJSON(w, chatResponse{Reply: parsed.Reply, Messages: messages, Slots: merged})
}

// presentDatePicker は今日から14日間のうち、この映画の上映がある日にちを
// その場で提示する。DeepSeekのプロース生成に頼らず決定的にリストを返す
// （座席選択・予約確定と同じ「決定的処理」の方針）。フロント側で1週間ずつ
// ページ送り表示する（movie-detail.htmlの日付タブと同じ操作感）。
// 日にちが決まったら presentSchedulePicker でその日の上映時間だけを
// 絞り込んで提示する。
func (h *Handler) presentDatePicker(w http.ResponseWriter, messages []chatMessage, slots Slots) {
	schedules, err := listSchedulesForMovie(h.db, slots.MovieID)
	if err != nil {
		writeJSON(w, chatResponse{
			Reply:    "上映スケジュールの取得に失敗しました。もう一度お試しください。",
			Messages: messages,
			Slots:    slots,
		})
		return
	}

	if len(schedules) == 0 {
		nextDate, dateErr := nextAvailableDate(h.db, slots.MovieID)
		reply := "今後の上映予定が見つかりませんでした。恐れ入りますが別の作品をお選びください。"
		switch {
		case dateErr != nil:
			reply = "上映スケジュールの取得に失敗しました。もう一度お試しください。"
		case nextDate != "":
			reply = fmt.Sprintf("直近2週間はこの映画の上映がありません。次に上映があるのは%sです。恐れ入りますが「上映スケジュール」ページまたは通常予約からお探しください。", nextDate)
		}
		writeJSON(w, chatResponse{Reply: reply, Messages: messages, Slots: slots})
		return
	}

	// 14日間の日にちを、上映がある日だけ・上映順のまま重複なく抽出する
	// （listSchedulesForMovie が日付・時刻順で返すため、初出順=日付順になる）。
	seen := map[string]bool{}
	var dates []string
	for _, s := range schedules {
		if !seen[s.ShowDate] {
			seen[s.ShowDate] = true
			dates = append(dates, s.ShowDate)
		}
	}

	datePayload := make([]map[string]any, len(dates))
	for i, d := range dates {
		datePayload[i] = map[string]any{"date": d}
	}

	writeJSON(w, chatResponse{
		Reply:    "ご希望の日にちをお選びください。",
		Messages: messages,
		Slots:    slots,
		UIAction: &UIAction{
			Type:  "date_picker",
			Dates: datePayload,
		},
	})
}

// presentSchedulePicker は presentDatePicker で選ばれた日にちの上映時間一覧を
// その場で提示する。DeepSeekは呼ばない（決定的処理）。
func (h *Handler) presentSchedulePicker(w http.ResponseWriter, messages []chatMessage, slots Slots) {
	all, err := listSchedulesForMovie(h.db, slots.MovieID)
	if err != nil {
		writeJSON(w, chatResponse{
			Reply:    "上映スケジュールの取得に失敗しました。もう一度お試しください。",
			Messages: messages,
			Slots:    slots,
		})
		return
	}

	var schedules []ScheduleInfo
	for _, s := range all {
		if s.ShowDate == slots.ShowDate {
			schedules = append(schedules, s)
		}
	}

	if len(schedules) == 0 {
		// 直前の日にち選択後に上映状況が変わった等のレアケース→日にち選択からやり直させる
		resetSlots := slots
		resetSlots.ShowDate = ""
		h.presentDatePicker(w, messages, resetSlots)
		return
	}

	schedulePayload := make([]map[string]any, len(schedules))
	for i, s := range schedules {
		schedulePayload[i] = map[string]any{
			"scheduleId":     s.ScheduleID,
			"screenName":     s.ScreenName,
			"showDate":       s.ShowDate,
			"startTime":      s.StartTime,
			"availableSeats": s.AvailableSeats,
		}
	}

	writeJSON(w, chatResponse{
		Reply:    fmt.Sprintf("%sの上映時間です。ご希望の回をお選びください。", formatDateJP(slots.ShowDate)),
		Messages: messages,
		Slots:    slots,
		UIAction: &UIAction{
			Type:      "schedule_picker",
			Schedules: schedulePayload,
		},
	})
}

// formatDateJP は "2026-09-17" を "9/17(木)" のような表示用文字列に変換する。
// パースに失敗した場合は元の文字列をそのまま返す。
func formatDateJP(dateStr string) string {
	t, err := time.Parse("2006-01-02", dateStr)
	if err != nil {
		return dateStr
	}
	weekdays := [...]string{"日", "月", "火", "水", "木", "金", "土"}
	return fmt.Sprintf("%d/%d(%s)", t.Month(), t.Day(), weekdays[t.Weekday()])
}

func (h *Handler) presentSeatPicker(w http.ResponseWriter, messages []chatMessage, slots Slots, reply string) {
	action, err := buildSeatPickerAction(h.db, slots.ScheduleID)
	if err != nil {
		writeJSON(w, chatResponse{
			Reply:    "座席情報の取得に失敗しました。もう一度お試しください。",
			Messages: messages,
			Slots:    slots,
		})
		return
	}
	writeJSON(w, chatResponse{Reply: reply, Messages: messages, Slots: slots, UIAction: action})
}

// presentPaymentPicker は支払い方法の選択肢（保存済みカード・新規カード登録・
// QRコード決済・窓口支払い）をその場で提示する。DeepSeekは呼ばない（決定的処理）。
// 通常予約(payment.html)と同様、カード未登録でもチャット内で新規登録してから
// クレジットカード払いを選べるようにする（listPaymentOptions が常に
// 「新しいクレジットカードを登録して支払う」を含めて返す）。
func (h *Handler) presentPaymentPicker(w http.ResponseWriter, messages []chatMessage, slots Slots, memberID int) error {
	options, err := listPaymentOptions(h.db, memberID)
	if err != nil {
		return err
	}

	payload := make([]map[string]any, len(options))
	for i, p := range options {
		payload[i] = map[string]any{
			"label":     p.Label,
			"method":    p.Method,
			"cardId":    p.CardID,
			"isNewCard": p.IsNewCard,
		}
	}

	writeJSON(w, chatResponse{
		Reply:    "お支払い方法をお選びください。",
		Messages: messages,
		Slots:    slots,
		UIAction: &UIAction{
			Type:     "payment_picker",
			Payments: payload,
		},
	})
	return nil
}

// finalizeReservation はDeepSeekを介さず、既存の CreateReservation
// （backend/internal/reservations）をそのまま呼んで予約を確定する。
// SELECT ... FOR UPDATE を含む同じトランザクションを通るため、Web予約と
// 完全に同じ二重予約防止・整合性保証を持つ。
func (h *Handler) finalizeReservation(w http.ResponseWriter, messages []chatMessage, slots Slots, memberID int) {
	seats := make([]reservations.SeatReq, len(slots.SeatIDs))
	for i, id := range slots.SeatIDs {
		// チャット予約では料金区分の細分化（学生/シニア等）は行わず、一般料金で統一する。
		seats[i] = reservations.SeatReq{SeatID: id, PriceCategoryID: 1}
	}

	guestName := ""
	if memberID <= 0 {
		guestName = "AI予約ゲスト"
	}

	result, err := reservations.CreateReservation(h.db, reservations.CreateReservationInput{
		ScheduleID:    slots.ScheduleID,
		Seats:         seats,
		PaymentMethod: slots.PaymentMethod,
		MemberID:      memberID,
		GuestName:     guestName,
	})

	if err != nil {
		if errors.Is(err, reservations.ErrSeatNotAvailable) {
			// 座席が埋まっていた→座席選択からやり直させる（スナップショットを信用しない）
			resetSlots := slots
			resetSlots.SeatIDs = nil
			resetSlots.PaymentMethod = 0
			resetSlots.CardID = 0
			h.presentSeatPicker(w, messages, resetSlots,
				"申し訳ございません、選択された座席が埋まってしまいました。お手数ですが座席を選び直してください。")
			return
		}
		if errors.Is(err, reservations.ErrTooManySeats) {
			// 通常は人数聞き取り時点(mergeSlots)で6席以下に絞られるため到達しないはずだが、
			// バックエンドを直接叩かれた場合等に備えた保険。座席選択からやり直させる。
			resetSlots := slots
			resetSlots.SeatIDs = nil
			resetSlots.PaymentMethod = 0
			resetSlots.CardID = 0
			h.presentSeatPicker(w, messages, resetSlots,
				fmt.Sprintf("申し訳ございません、1回のご予約は最大%d席までです。座席を選び直してください。", reservations.MaxSeatsPerReservation))
			return
		}
		writeJSON(w, chatResponse{
			Reply:    "予約処理に失敗しました。もう一度お試しください。",
			Messages: messages,
			Slots:    slots,
		})
		return
	}

	summary, _ := scheduleSummary(h.db, slots.ScheduleID)

	writeJSON(w, chatResponse{
		Reply:    fmt.Sprintf("ご予約ありがとうございます！予約番号は %s です。合計金額は %d円です。", result.ReservationCode, result.TotalAmount),
		Messages: messages,
		Slots:    Slots{}, // 予約完了。同じ会話で続けて別の予約もできるようリセット
		UIAction: &UIAction{
			Type:            "reservation_confirmed",
			ReservationID:   result.ReservationID,
			ReservationCode: result.ReservationCode,
			TotalAmount:     result.TotalAmount,
			Tickets:         result.Tickets,
			MovieTitle:      summary.MovieTitle,
			ShowDate:        summary.ShowDate,
			StartTime:       summary.StartTime,
			ScreenName:      summary.ScreenName,
		},
	})
}

// mergeSlots はDeepSeekが抽出したslotsを、実在チェックをしたうえで既存slotsへマージする。
// 上流の条件（映画・上映回）が変わったら下流（座席・支払い）はリセットする。
func mergeSlots(db *gorm.DB, current, incoming Slots, memberID int) Slots {
	merged := current

	if incoming.MovieID > 0 && movieExists(db, incoming.MovieID) {
		if incoming.MovieID != merged.MovieID {
			merged.ShowDate = ""
			merged.ScheduleID = 0
			merged.SeatIDs = nil
			merged.PaymentMethod = 0
			merged.CardID = 0
		}
		merged.MovieID = incoming.MovieID
	}

	if incoming.ScheduleID > 0 && merged.MovieID > 0 && scheduleBelongsToMovie(db, incoming.ScheduleID, merged.MovieID) {
		if incoming.ScheduleID != merged.ScheduleID {
			merged.SeatIDs = nil
			merged.PaymentMethod = 0
			merged.CardID = 0
		}
		merged.ScheduleID = incoming.ScheduleID
	}

	if incoming.SeatCount > 0 && incoming.SeatCount <= reservations.MaxSeatsPerReservation {
		merged.SeatCount = incoming.SeatCount
	}

	if incoming.PaymentMethod >= 1 && incoming.PaymentMethod <= 3 {
		merged.PaymentMethod = incoming.PaymentMethod
	}

	if incoming.CardID > 0 && cardBelongsToMember(db, incoming.CardID, memberID) {
		merged.CardID = incoming.CardID
		merged.PaymentMethod = 1 // カードを選んだ場合は支払い方法もカードに固定
	}

	return merged
}

func appendAssistantTurn(messages []chatMessage, raw string) []chatMessage {
	updated := make([]chatMessage, len(messages), len(messages)+1)
	copy(updated, messages)
	return append(updated, chatMessage{Role: "assistant", Content: raw})
}

func writeJSON(w http.ResponseWriter, resp chatResponse) {
	w.Header().Set("Content-Type", "application/json")
	json.NewEncoder(w).Encode(resp)
}

// writeFallback はDeepSeek呼び出し失敗・JSON解析失敗時に返す。
// 会話履歴を汚さないよう messages はそのまま返す（今回のやり取りは履歴に残さない）。
func writeFallback(w http.ResponseWriter, req chatRequest, reply string) {
	writeJSON(w, chatResponse{
		Reply:    reply,
		Messages: req.Messages,
		Slots:    req.Slots,
	})
}

func jsonError(w http.ResponseWriter, msg string, code int) {
	w.Header().Set("Content-Type", "application/json")
	w.WriteHeader(code)
	json.NewEncoder(w).Encode(map[string]string{"error": msg})
}
