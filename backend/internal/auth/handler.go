package auth

import (
	"encoding/json"
	"net/http"
	"os"
	"strings"
	"time"

	"github.com/golang-jwt/jwt/v5"
	"github.com/miyaarekkusu/halcinema/backend/internal/ctxkeys"
	"golang.org/x/crypto/bcrypt"
	"gorm.io/gorm"
)

type Member struct {
	MemberID  int    `gorm:"column:f_member_id;primaryKey;autoIncrement"`
	LastName  string `gorm:"column:f_last_name"`
	FirstName string `gorm:"column:f_first_name"`
	Email     string `gorm:"column:f_email"`
	Password  string `gorm:"column:f_password"`
}

func (Member) TableName() string { return "t_member" }

type Handler struct {
	db *gorm.DB
}

func NewHandler(db *gorm.DB) *Handler {
	return &Handler{db: db}
}

type registerReq struct {
	Name     string `json:"name"`
	Email    string `json:"email"`
	Password string `json:"password"`
}

func (h *Handler) Register(w http.ResponseWriter, r *http.Request) {
	var req registerReq
	if err := json.NewDecoder(r.Body).Decode(&req); err != nil {
		jsonError(w, "invalid request", http.StatusBadRequest)
		return
	}
	if req.Email == "" || req.Password == "" || req.Name == "" {
		jsonError(w, "name, email and password are required", http.StatusBadRequest)
		return
	}

	parts := strings.SplitN(strings.TrimSpace(req.Name), " ", 2)
	lastName := parts[0]
	firstName := ""
	if len(parts) > 1 {
		firstName = parts[1]
	}

	hash, err := bcrypt.GenerateFromPassword([]byte(req.Password), 12)
	if err != nil {
		jsonError(w, "internal error", http.StatusInternalServerError)
		return
	}

	m := Member{
		LastName:  lastName,
		FirstName: firstName,
		Email:     req.Email,
		Password:  string(hash),
	}
	if err := h.db.Create(&m).Error; err != nil {
		jsonError(w, "email already registered", http.StatusConflict)
		return
	}

	token, err := generateToken(m.MemberID)
	if err != nil {
		jsonError(w, "token error", http.StatusInternalServerError)
		return
	}

	w.Header().Set("Content-Type", "application/json")
	w.WriteHeader(http.StatusCreated)
	json.NewEncoder(w).Encode(map[string]any{
		"token":  token,
		"member": memberJSON(m),
	})
}

type loginReq struct {
	Email    string `json:"email"`
	Password string `json:"password"`
}

func (h *Handler) Login(w http.ResponseWriter, r *http.Request) {
	var req loginReq
	if err := json.NewDecoder(r.Body).Decode(&req); err != nil {
		jsonError(w, "invalid request", http.StatusBadRequest)
		return
	}

	var m Member
	if err := h.db.Where("f_email = ?", req.Email).First(&m).Error; err != nil {
		jsonError(w, "invalid credentials", http.StatusUnauthorized)
		return
	}
	if err := bcrypt.CompareHashAndPassword([]byte(m.Password), []byte(req.Password)); err != nil {
		jsonError(w, "invalid credentials", http.StatusUnauthorized)
		return
	}

	token, err := generateToken(m.MemberID)
	if err != nil {
		jsonError(w, "token error", http.StatusInternalServerError)
		return
	}

	w.Header().Set("Content-Type", "application/json")
	json.NewEncoder(w).Encode(map[string]any{
		"token":  token,
		"member": memberJSON(m),
	})
}

// GetMe はマイページ「設定」で表示する現在の会員プロフィールを返す。
func (h *Handler) GetMe(w http.ResponseWriter, r *http.Request) {
	memberID := ctxkeys.MemberID(r.Context())

	var m Member
	if err := h.db.First(&m, memberID).Error; err != nil {
		jsonError(w, "not found", http.StatusNotFound)
		return
	}

	w.Header().Set("Content-Type", "application/json")
	json.NewEncoder(w).Encode(memberJSON(m))
}

type updateMeReq struct {
	Name  string `json:"name"`
	Email string `json:"email"`
}

// UpdateMe はマイページ「設定」の「お名前」「メールアドレス」編集を反映する。
// name は register.html と同じ「姓 名」形式（スペース区切り）で受け取る。
func (h *Handler) UpdateMe(w http.ResponseWriter, r *http.Request) {
	memberID := ctxkeys.MemberID(r.Context())

	var req updateMeReq
	if err := json.NewDecoder(r.Body).Decode(&req); err != nil {
		jsonError(w, "invalid request", http.StatusBadRequest)
		return
	}

	updates := map[string]any{}

	if name := strings.TrimSpace(req.Name); name != "" {
		parts := strings.SplitN(name, " ", 2)
		updates["f_last_name"] = parts[0]
		if len(parts) > 1 {
			updates["f_first_name"] = parts[1]
		} else {
			updates["f_first_name"] = ""
		}
	}

	if email := strings.TrimSpace(req.Email); email != "" {
		updates["f_email"] = email
	}

	if len(updates) == 0 {
		jsonError(w, "name or email is required", http.StatusBadRequest)
		return
	}

	if err := h.db.Model(&Member{}).Where("f_member_id = ?", memberID).Updates(updates).Error; err != nil {
		jsonError(w, "email already registered", http.StatusConflict)
		return
	}

	var m Member
	if err := h.db.First(&m, memberID).Error; err != nil {
		jsonError(w, "not found", http.StatusNotFound)
		return
	}

	w.Header().Set("Content-Type", "application/json")
	json.NewEncoder(w).Encode(memberJSON(m))
}

type changePasswordReq struct {
	CurrentPassword string `json:"currentPassword"`
	NewPassword     string `json:"newPassword"`
}

// ChangePassword はマイページ「設定」のパスワード変更を行う。
// 現在のパスワードの照合に成功した場合のみ更新する。
func (h *Handler) ChangePassword(w http.ResponseWriter, r *http.Request) {
	memberID := ctxkeys.MemberID(r.Context())

	var req changePasswordReq
	if err := json.NewDecoder(r.Body).Decode(&req); err != nil {
		jsonError(w, "invalid request", http.StatusBadRequest)
		return
	}
	if len(req.NewPassword) < 8 {
		jsonError(w, "new password must be at least 8 characters", http.StatusBadRequest)
		return
	}

	var m Member
	if err := h.db.First(&m, memberID).Error; err != nil {
		jsonError(w, "not found", http.StatusNotFound)
		return
	}
	if err := bcrypt.CompareHashAndPassword([]byte(m.Password), []byte(req.CurrentPassword)); err != nil {
		jsonError(w, "current password is incorrect", http.StatusUnauthorized)
		return
	}

	hash, err := bcrypt.GenerateFromPassword([]byte(req.NewPassword), 12)
	if err != nil {
		jsonError(w, "internal error", http.StatusInternalServerError)
		return
	}

	if err := h.db.Model(&Member{}).Where("f_member_id = ?", memberID).
		Update("f_password", string(hash)).Error; err != nil {
		jsonError(w, "failed to update password", http.StatusInternalServerError)
		return
	}

	w.WriteHeader(http.StatusNoContent)
}

func generateToken(memberID int) (string, error) {
	claims := jwt.MapClaims{
		"member_id": memberID,
		"exp":       time.Now().Add(24 * time.Hour).Unix(),
	}
	token := jwt.NewWithClaims(jwt.SigningMethodHS256, claims)
	return token.SignedString([]byte(os.Getenv("JWT_SECRET")))
}

func memberJSON(m Member) map[string]any {
	return map[string]any{
		"id":        m.MemberID,
		"lastName":  m.LastName,
		"firstName": m.FirstName,
		"email":     m.Email,
	}
}

func jsonError(w http.ResponseWriter, msg string, code int) {
	w.Header().Set("Content-Type", "application/json")
	w.WriteHeader(code)
	json.NewEncoder(w).Encode(map[string]string{"error": msg})
}
