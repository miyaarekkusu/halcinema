package goodsorder

import (
	"encoding/json"
	"fmt"
	"net/http"
	"strconv"
	"strings"
	"time"

	"github.com/go-chi/chi"
	"github.com/google/uuid"
	"github.com/miyaarekkusu/halcinema/backend/internal/ctxkeys"
	"gorm.io/gorm"
)

// GoodsOrder は t_GOODS_ORDER を扱う。f_order_type=1（座席予約ウィザード中に一緒に
// 選んだフード。f_reservation_idで予約に紐づく）と f_order_type=3（オンライン単体注文、
// goods.htmlの単体訪問／AI予約後の追加注文モードから予約に紐付けずに直接注文するケース）
// の2パターンをこのCreateで扱う。
type GoodsOrder struct {
	OrderID       int       `gorm:"column:f_order_id;primaryKey;autoIncrement"`
	ReservationID *int      `gorm:"column:f_reservation_id"`
	MemberID      *int      `gorm:"column:f_member_id"`
	OrderType     int       `gorm:"column:f_order_type"`
	OrderCode     string    `gorm:"column:f_order_code"`
	TotalAmount   int       `gorm:"column:f_total_amount"`
	PaymentMethod int       `gorm:"column:f_payment_method"`
	OrderStatus   int       `gorm:"column:f_order_status"`
	QRCode        *string   `gorm:"column:f_qr_code"`
	OrderedAt     time.Time `gorm:"column:f_ordered_at"`
}

func (GoodsOrder) TableName() string { return "t_goods_order" }

// GoodsOrderDetail の f_goods_id は固定カタログ商品がある場合のみ設定する。
// goods.htmlのウィザードはフレーバー/サイズを組み合わせた商品名を動的生成するため、
// f_item_name に注文時点の表示名をスナップショットとして保持する。
type GoodsOrderDetail struct {
	DetailID  int    `gorm:"column:f_detail_id;primaryKey;autoIncrement"`
	OrderID   int    `gorm:"column:f_order_id"`
	GoodsID   *int   `gorm:"column:f_goods_id"`
	ItemName  string `gorm:"column:f_item_name"`
	Quantity  int    `gorm:"column:f_quantity"`
	UnitPrice int    `gorm:"column:f_unit_price"`
}

func (GoodsOrderDetail) TableName() string { return "t_goods_order_detail" }

type Handler struct {
	db *gorm.DB
}

func NewHandler(db *gorm.DB) *Handler {
	return &Handler{db: db}
}

type itemReq struct {
	Name  string `json:"name"`
	Price int    `json:"price"`
	Qty   int    `json:"qty"`
}

type createReq struct {
	Items         []itemReq `json:"items"`
	PaymentMethod int       `json:"paymentMethod"`
	// ReservationID が指定された場合、座席予約とセットで注文されたフードとして
	// f_order_type=1・f_reservation_id紐付で保存する。この場合はゲスト予約（未ログイン）
	// でも注文できる（座席予約自体がゲスト可のため）。指定が無い場合は従来通り
	// f_order_type=3のオンライン単体注文で、ログイン必須。
	ReservationID int `json:"reservationId,omitempty"`
}

func (h *Handler) Create(w http.ResponseWriter, r *http.Request) {
	memberID := ctxkeys.MemberID(r.Context())

	var req createReq
	if err := json.NewDecoder(r.Body).Decode(&req); err != nil {
		jsonError(w, "invalid request", http.StatusBadRequest)
		return
	}

	orderType := 3
	var reservationIDPtr *int
	if req.ReservationID > 0 {
		q := h.db.Table("t_reservation").Where("f_reservation_id = ?", req.ReservationID)
		if memberID > 0 {
			// ログイン会員なら自分の予約であることまで確認する。ゲスト予約（memberID==0）は
			// 予約自体がJWT無しで作れるため、reservationIdの実在確認のみで足りる。
			q = q.Where("f_member_id = ?", memberID)
		}
		var count int64
		if err := q.Count(&count).Error; err != nil || count == 0 {
			jsonError(w, "reservation not found", http.StatusBadRequest)
			return
		}
		orderType = 1
		rid := req.ReservationID
		reservationIDPtr = &rid
	} else if memberID == 0 {
		jsonError(w, "unauthorized", http.StatusUnauthorized)
		return
	}

	items := make([]itemReq, 0, len(req.Items))
	for _, it := range req.Items {
		name := strings.TrimSpace(it.Name)
		if name == "" || it.Price < 0 || it.Qty <= 0 {
			continue
		}
		items = append(items, it)
	}
	if len(items) == 0 {
		jsonError(w, "items are required", http.StatusBadRequest)
		return
	}
	if req.PaymentMethod < 1 || req.PaymentMethod > 3 {
		req.PaymentMethod = 1
	}

	total := 0
	for _, it := range items {
		total += it.Price * it.Qty
	}

	orderCode := fmt.Sprintf("G%s", time.Now().Format("20060102150405"))
	qrCode := uuid.New().String()

	var memberIDPtr *int
	if memberID > 0 {
		memberIDPtr = &memberID
	}

	order := GoodsOrder{
		ReservationID: reservationIDPtr,
		MemberID:      memberIDPtr,
		OrderType:     orderType,
		OrderCode:     orderCode,
		TotalAmount:   total,
		PaymentMethod: req.PaymentMethod,
		OrderStatus:   0,
		QRCode:        &qrCode,
		OrderedAt:     time.Now(),
	}

	err := h.db.Transaction(func(tx *gorm.DB) error {
		if err := tx.Create(&order).Error; err != nil {
			return err
		}
		for _, it := range items {
			detail := GoodsOrderDetail{
				OrderID:   order.OrderID,
				ItemName:  it.Name,
				Quantity:  it.Qty,
				UnitPrice: it.Price,
			}
			if err := tx.Create(&detail).Error; err != nil {
				return err
			}
		}
		return nil
	})
	if err != nil {
		jsonError(w, "order failed: "+err.Error(), http.StatusInternalServerError)
		return
	}

	w.Header().Set("Content-Type", "application/json")
	w.WriteHeader(http.StatusCreated)
	json.NewEncoder(w).Encode(map[string]any{
		"orderId":     order.OrderID,
		"orderCode":   order.OrderCode,
		"totalAmount": order.TotalAmount,
		"qrCode":      qrCode,
		"orderedAt":   order.OrderedAt.Format(time.RFC3339),
	})
}

type myOrderRow struct {
	OrderID     int       `gorm:"column:f_order_id"`
	OrderCode   string    `gorm:"column:f_order_code"`
	TotalAmount int       `gorm:"column:f_total_amount"`
	OrderStatus int       `gorm:"column:f_order_status"`
	OrderedAt   time.Time `gorm:"column:f_ordered_at"`
	ItemCount   int       `gorm:"column:item_count"`
}

func (h *Handler) ListMine(w http.ResponseWriter, r *http.Request) {
	memberID := ctxkeys.MemberID(r.Context())
	if memberID == 0 {
		jsonError(w, "unauthorized", http.StatusUnauthorized)
		return
	}

	var rows []myOrderRow
	h.db.Raw(`
		SELECT o.f_order_id, o.f_order_code, o.f_total_amount, o.f_order_status,
		       o.f_ordered_at, COALESCE(SUM(d.f_quantity), 0) AS item_count
		FROM t_goods_order o
		LEFT JOIN t_goods_order_detail d ON d.f_order_id = o.f_order_id
		WHERE o.f_member_id = ? AND o.f_order_type = 3
		GROUP BY o.f_order_id
		ORDER BY o.f_ordered_at DESC
	`, memberID).Scan(&rows)

	result := make([]map[string]any, len(rows))
	for i, row := range rows {
		result[i] = map[string]any{
			"orderId":     row.OrderID,
			"orderCode":   row.OrderCode,
			"totalAmount": row.TotalAmount,
			"orderStatus": row.OrderStatus,
			"orderedAt":   row.OrderedAt.Format(time.RFC3339),
			"itemCount":   row.ItemCount,
		}
	}

	w.Header().Set("Content-Type", "application/json")
	json.NewEncoder(w).Encode(result)
}

type orderDetailRow struct {
	ItemName  string `gorm:"column:f_item_name"`
	Quantity  int    `gorm:"column:f_quantity"`
	UnitPrice int    `gorm:"column:f_unit_price"`
}

func (h *Handler) GetOne(w http.ResponseWriter, r *http.Request) {
	id, err := strconv.Atoi(chi.URLParam(r, "id"))
	if err != nil {
		jsonError(w, "invalid id", http.StatusBadRequest)
		return
	}

	memberID := ctxkeys.MemberID(r.Context())

	var order GoodsOrder
	if err := h.db.First(&order, id).Error; err != nil {
		jsonError(w, "not found", http.StatusNotFound)
		return
	}
	if order.MemberID == nil || *order.MemberID != memberID {
		jsonError(w, "forbidden", http.StatusForbidden)
		return
	}

	var rows []orderDetailRow
	h.db.Table("t_goods_order_detail").
		Select("f_item_name, f_quantity, f_unit_price").
		Where("f_order_id = ?", order.OrderID).
		Scan(&rows)

	items := make([]map[string]any, len(rows))
	for i, row := range rows {
		items[i] = map[string]any{
			"name":  row.ItemName,
			"qty":   row.Quantity,
			"price": row.UnitPrice,
		}
	}

	qrCode := ""
	if order.QRCode != nil {
		qrCode = *order.QRCode
	}

	w.Header().Set("Content-Type", "application/json")
	json.NewEncoder(w).Encode(map[string]any{
		"orderId":     order.OrderID,
		"orderCode":   order.OrderCode,
		"totalAmount": order.TotalAmount,
		"orderStatus": order.OrderStatus,
		"qrCode":      qrCode,
		"orderedAt":   order.OrderedAt.Format(time.RFC3339),
		"items":       items,
	})
}

func jsonError(w http.ResponseWriter, msg string, code int) {
	w.Header().Set("Content-Type", "application/json")
	w.WriteHeader(code)
	json.NewEncoder(w).Encode(map[string]string{"error": msg})
}
