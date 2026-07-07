package ctxkeys

import "context"

type contextKey string

const MemberIDKey contextKey = "member_id"

func MemberID(ctx context.Context) int {
	v := ctx.Value(MemberIDKey)
	if v == nil {
		return 0
	}
	id, _ := v.(int)
	return id
}
