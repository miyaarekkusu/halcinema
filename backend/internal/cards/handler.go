package cards

import (
	"encoding/json"
	"net/http"
	"strconv"
	"strings"

	"github.com/go-chi/chi"
	"github.com/miyaarekkusu/halcinema/backend/internal/ctxkeys"
	"gorm.io/gorm"
)

// Card はマイページ「支払方法」に保存されるクレジットカード情報。
// PCI DSS準拠のため、カード番号本体・CVVは保存せず下4桁のみ保持する。
type Card struct {
	CardID      int    `gorm:"column:f_card_id;primaryKey;autoIncrement"`
	MemberID    int    `gorm:"column:f_member_id"`
	CardHolder  string `gorm:"column:f_card_holder"`
	CardBrand   string `gorm:"column:f_card_brand"`
	CardLast4   string `gorm:"column:f_card_last4"`
	ExpireMonth int    `gorm:"column:f_expire_month"`
	ExpireYear  int    `gorm:"column:f_expire_year"`
	IsDefault   int    `gorm:"column:f_is_default"`
}

func (Card) TableName() string { return "t_member_card" }

type Handler struct {
	db *gorm.DB
}

func NewHandler(db *gorm.DB) *Handler {
	return &Handler{db: db}
}

func (h *Handler) List(w http.ResponseWriter, r *http.Request) {
	memberID := ctxkeys.MemberID(r.Context())

	var cards []Card
	if err := h.db.Where("f_member_id = ?", memberID).
		Order("f_is_default DESC, f_card_id DESC").Find(&cards).Error; err != nil {
		jsonError(w, "db error", http.StatusInternalServerError)
		return
	}

	result := make([]map[string]any, len(cards))
	for i, c := range cards {
		result[i] = cardJSON(c)
	}

	w.Header().Set("Content-Type", "application/json")
	json.NewEncoder(w).Encode(result)
}

type createReq struct {
	CardHolder  string `json:"cardHolder"`
	CardNumber  string `json:"cardNumber"`
	ExpireMonth int    `json:"expireMonth"`
	ExpireYear  int    `json:"expireYear"`
	IsDefault   bool   `json:"isDefault"`
}

func (h *Handler) Create(w http.ResponseWriter, r *http.Request) {
	memberID := ctxkeys.MemberID(r.Context())

	var req createReq
	if err := json.NewDecoder(r.Body).Decode(&req); err != nil {
		jsonError(w, "invalid request", http.StatusBadRequest)
		return
	}

	digits := strings.NewReplacer(" ", "", "-", "").Replace(req.CardNumber)
	if req.CardHolder == "" || len(digits) < 12 || len(digits) > 19 ||
		req.ExpireMonth < 1 || req.ExpireMonth > 12 || req.ExpireYear < 1 {
		jsonError(w, "card details are invalid", http.StatusBadRequest)
		return
	}

	card := Card{
		MemberID:    memberID,
		CardHolder:  req.CardHolder,
		CardBrand:   detectBrand(digits),
		CardLast4:   digits[len(digits)-4:],
		ExpireMonth: req.ExpireMonth,
		ExpireYear:  req.ExpireYear,
	}

	err := h.db.Transaction(func(tx *gorm.DB) error {
		var count int64
		if err := tx.Model(&Card{}).Where("f_member_id = ?", memberID).Count(&count).Error; err != nil {
			return err
		}
		if req.IsDefault || count == 0 {
			card.IsDefault = 1
			if err := tx.Model(&Card{}).Where("f_member_id = ?", memberID).
				Update("f_is_default", 0).Error; err != nil {
				return err
			}
		}
		return tx.Create(&card).Error
	})
	if err != nil {
		jsonError(w, "failed to save card", http.StatusInternalServerError)
		return
	}

	w.Header().Set("Content-Type", "application/json")
	w.WriteHeader(http.StatusCreated)
	json.NewEncoder(w).Encode(cardJSON(card))
}

func (h *Handler) Delete(w http.ResponseWriter, r *http.Request) {
	memberID := ctxkeys.MemberID(r.Context())
	id, err := strconv.Atoi(chi.URLParam(r, "id"))
	if err != nil {
		jsonError(w, "invalid id", http.StatusBadRequest)
		return
	}

	res := h.db.Where("f_card_id = ? AND f_member_id = ?", id, memberID).Delete(&Card{})
	if res.Error != nil {
		jsonError(w, "db error", http.StatusInternalServerError)
		return
	}
	if res.RowsAffected == 0 {
		jsonError(w, "not found", http.StatusNotFound)
		return
	}

	w.WriteHeader(http.StatusNoContent)
}

func (h *Handler) SetDefault(w http.ResponseWriter, r *http.Request) {
	memberID := ctxkeys.MemberID(r.Context())
	id, err := strconv.Atoi(chi.URLParam(r, "id"))
	if err != nil {
		jsonError(w, "invalid id", http.StatusBadRequest)
		return
	}

	err = h.db.Transaction(func(tx *gorm.DB) error {
		var card Card
		if err := tx.Where("f_card_id = ? AND f_member_id = ?", id, memberID).First(&card).Error; err != nil {
			return err
		}
		if err := tx.Model(&Card{}).Where("f_member_id = ?", memberID).
			Update("f_is_default", 0).Error; err != nil {
			return err
		}
		return tx.Model(&Card{}).Where("f_card_id = ?", id).Update("f_is_default", 1).Error
	})
	if err != nil {
		jsonError(w, "not found", http.StatusNotFound)
		return
	}

	w.WriteHeader(http.StatusNoContent)
}

func detectBrand(digits string) string {
	switch {
	case strings.HasPrefix(digits, "34"), strings.HasPrefix(digits, "37"):
		return "American Express"
	case strings.HasPrefix(digits, "35"):
		return "JCB"
	case strings.HasPrefix(digits, "4"):
		return "Visa"
	case strings.HasPrefix(digits, "5"):
		return "Mastercard"
	default:
		return "その他"
	}
}

func cardJSON(c Card) map[string]any {
	return map[string]any{
		"cardId":      c.CardID,
		"cardHolder":  c.CardHolder,
		"cardBrand":   c.CardBrand,
		"last4":       c.CardLast4,
		"expireMonth": c.ExpireMonth,
		"expireYear":  c.ExpireYear,
		"isDefault":   c.IsDefault == 1,
	}
}

func jsonError(w http.ResponseWriter, msg string, code int) {
	w.Header().Set("Content-Type", "application/json")
	w.WriteHeader(code)
	json.NewEncoder(w).Encode(map[string]string{"error": msg})
}
