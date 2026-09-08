package chat

import (
	"context"
	"encoding/json"
	"errors"
	"fmt"
	"net/http"
	"os"

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
		h.handleRecommend(w, r.Context(), req)
	case "reserve":
		h.handleReserve(w, r.Context(), req, memberID)
	default:
		jsonError(w, "invalid intent", http.StatusBadRequest)
	}
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

func (h *Handler) handleRecommend(w http.ResponseWriter, ctx context.Context, req chatRequest) {
	movies, err := listShowingMovies(h.db)
	if err != nil {
		writeFallback(w, req, "映画情報の取得に失敗しました。もう一度お試しください。")
		return
	}

	raw, err := h.deepseek.Complete(ctx, recommendPrompt(movies), req.Messages)
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
	slots := req.Slots

	// 決定的処理1: 映画・上映回・人数は決まっているが座席が未選択→(再)提示。DeepSeekは呼ばない。
	if slots.MovieID > 0 && slots.ScheduleID > 0 && slots.SeatCount > 0 && len(slots.SeatIDs) == 0 {
		h.presentSeatPicker(w, req.Messages, slots, "座席をお選びください（複数選択できます）。")
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
	case slots.ScheduleID == 0:
		promptCtx.Stage = reserveStageSchedule
		promptCtx.Schedules, err = listSchedulesForMovie(h.db, slots.MovieID)
	case slots.SeatCount == 0:
		promptCtx.Stage = reserveStageSeatCount
	default: // 座席は選択済み・支払い方法だけ未定
		promptCtx.Stage = reserveStagePayment
		promptCtx.PaymentOptions, err = listPaymentOptions(h.db, memberID)
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

	// マージ後に映画・上映回・人数が揃ったら、ここでも座席ピッカーへ（LLM抜き）
	if merged.MovieID > 0 && merged.ScheduleID > 0 && merged.SeatCount > 0 && len(merged.SeatIDs) == 0 {
		h.presentSeatPicker(w, messages, merged, parsed.Reply)
		return
	}

	// マージ後に全条件が揃った（このターンで支払い方法が決まった等）→ここでも予約確定。DeepSeekは呼ばない。
	if merged.MovieID > 0 && merged.ScheduleID > 0 && len(merged.SeatIDs) > 0 && merged.PaymentMethod > 0 {
		h.finalizeReservation(w, messages, merged, memberID)
		return
	}

	writeJSON(w, chatResponse{Reply: parsed.Reply, Messages: messages, Slots: merged})
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

	if incoming.SeatCount > 0 && incoming.SeatCount <= 10 {
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
