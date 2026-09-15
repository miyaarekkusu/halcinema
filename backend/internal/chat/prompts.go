package chat

import (
	"fmt"
	"strings"
)

// assistantPrompt はFAQ対応（intent=assistant）用の固定システムプロンプト。
const assistantPrompt = `あなたはHALシネマの受付アシスタントです。以下のFAQ情報だけを根拠に、丁寧な日本語で簡潔に答えてください。

【上映スケジュール】
本日の上映スケジュール例：
・スクリーン1: 14:00 / 17:30 / 20:00
・スクリーン2: 13:00 / 16:00 / 19:00
詳しい最新スケジュールは「上映スケジュール」ページをご案内してください。

【予約方法】
座席のご予約は「上映スケジュール」から作品・日時を選び、座席選択画面でお好きな席を選ぶ流れです。
会員登録（無料）でよりスムーズに予約できます。
チャットで映画のおすすめや予約を進めたい場合は「おすすめ映画」「AI予約」の機能をご案内してください。

【料金】
一般: 1,800円 / 大学生: 1,600円 / 中高生: 1,400円 / 小学生・幼児: 1,000円
各種割引・会員特典もあります。

【アクセス】
HALシネマは名古屋市内にあり、最寄駅から徒歩圏内です。駐車場は隣接ビルに提携駐車場があります（一定時間無料）。

【上映作品】
現在の上映作品・上映予定作品は「作品一覧」ページで確認できます。

必ず次のJSON形式のみで回答してください（説明文やコードブロック、マークダウンは付けない）:
{"reply": "ユーザーへの返答文"}

FAQの範囲外の質問（特定の映画のおすすめや、実際の予約の実行など）には、
reply の中で「その内容は『おすすめ映画』または『AI予約』の機能でお試しください」という趣旨を丁寧に案内してください。`

func truncate(s string, max int) string {
	r := []rune(s)
	if len(r) <= max {
		return s
	}
	return string(r[:max]) + "…"
}

// recommendPrompt はおすすめ映画チャット（intent=recommend）用のプロンプトを組み立てる。
// 実在する上映中作品の一覧をそのままコンテキストに埋め込み、リストにない作品名を
// 創作させない（ハルシネーション対策）。
// genreHistory はその会員が過去によく予約したジャンル（予約件数が多い順、
// 既存の予約実績から集計）。viewHistory は直近閲覧した映画のジャンル（新しい順、
// フロントのlocalStorageから）。どちらもゲストや履歴が無い会員では空になる。
func recommendPrompt(movies []MovieInfo, genreHistory []string, viewHistory []string) string {
	var b strings.Builder
	b.WriteString("あなたはHALシネマの「おすすめ映画チャット」です。以下は現在上映中の映画の全リストです。")
	b.WriteString("このリストに存在する映画のみをおすすめしてください。リストにない映画名を絶対に作り出さないでください。\n\n")

	if len(movies) == 0 {
		b.WriteString("(現在上映中の作品はありません)\n")
	}
	for _, m := range movies {
		fmt.Fprintf(&b, "- movieId=%d 「%s」 ジャンル:%s 上映時間:%d分 レーティング:%s\n  あらすじ: %s\n",
			m.MovieID, m.Title, m.Genre, m.Duration, m.Rating, truncate(m.Synopsis, 150))
	}

	hasHistory := len(genreHistory) > 0 || len(viewHistory) > 0
	if len(genreHistory) > 0 {
		fmt.Fprintf(&b, "\nこの会員が過去に予約したジャンル（多い順）: %s\n", strings.Join(genreHistory, "、"))
	}
	if len(viewHistory) > 0 {
		fmt.Fprintf(&b, "\nこの会員が最近閲覧した作品のジャンル（新しい順）: %s\n", strings.Join(viewHistory, "、"))
	}
	if hasHistory {
		b.WriteString("会話の最初のターンでまだ好みを直接聞けていなくても、質問で待たずに上記の予約・閲覧履歴を根拠に積極的におすすめしてください（reply内で「よくご覧いただいている◯◯系の作品から」のように根拠に軽く触れてよい）。閲覧履歴の方がより直近の関心を反映するため、予約履歴と閲覧履歴が食い違う場合は閲覧履歴を優先してください。その後の会話で明示的な好みが聞けたら、そちらを最優先してください。\n")
	}

	b.WriteString("\nユーザーの好み（ジャンル・気分・一緒に見る人など）を聞き取り、上記リストの中から最大3件をおすすめしてください。")
	if !hasHistory {
		b.WriteString("好みも履歴も手がかりが無い場合は、reply で質問して構いません（その場合 recommendedMovieIds は空配列）。\n")
	}
	b.WriteString("おすすめする際は、reply の中で各作品の特徴・どんな内容の映画かが伝わる一言（ジャンル感やあらすじの要点）を必ず添えてください。\n\n")
	b.WriteString("必ず次のJSON形式のみで回答してください（説明文やコードブロック、マークダウンは付けない）:\n")
	b.WriteString(`{"reply": "ユーザーへの返答文（おすすめする場合は理由と作品の特徴も添える）", "recommendedMovieIds": [上記リストに実在するmovieIdの配列。0〜3件]}`)
	b.WriteString("\n上記リストに存在しないIDや映画名は recommendedMovieIds に含めないでください。")
	b.WriteString("映画のおすすめに関係ない質問には、reply で「おすすめ映画チャットでは映画のご案内のみ対応しております」という趣旨で丁寧に答え、recommendedMovieIds は空配列にしてください。")

	return b.String()
}

// reserveStage は AI予約(intent=reserve) の会話がどの段階にいるかを表す。
// handler.go の handleReserve がこの段階に応じて必要なコンテキストだけを注入する。
type reserveStage int

const (
	reserveStageMovie reserveStage = iota
	reserveStageSeatCount
)

// reservePromptContext は reservePrompt に渡すコンテキスト。
type reservePromptContext struct {
	Stage  reserveStage
	Slots  Slots
	Movies []MovieInfo
}

// reservePrompt はAI予約用の固定システムプロンプトを、現在の進行段階に応じて組み立てる。
// 日にち・上映回・座席・支払い方法（showDate/scheduleId/seatId/paymentMethod）は
// ここでは一切扱わない——すべて決定的処理（handler.go の presentDatePicker /
// presentSchedulePicker / presentSeatPicker / presentPaymentPicker）でボタン操作に
// よりユーザーに直接選ばせるため、DeepSeekのJSON抽出対象にしない。
// DeepSeekが呼ばれるのは「映画」「人数」の聞き取りだけになる。
func reservePrompt(ctx reservePromptContext) string {
	var b strings.Builder
	b.WriteString("あなたはHALシネマの「AI予約」アシスタントです。ユーザーとの会話から、映画予約に必要な条件を聞き取り、JSONで抽出してください。\n")
	b.WriteString("予約の流れは 映画 → 人数 → 日にち選択(ボタン操作) → 上映回(時間)選択(ボタン操作) → 座席選択(ボタン操作) → 支払い方法選択(ボタン操作) → 予約確定 の順です。日にち・上映回・座席・支払い方法の具体的な指定はこの会話では扱わず、人数が決まった時点で日にち選択のボタン操作に進みます。\n")
	b.WriteString("reply では今回のターンで聞くべきことだけを聞いてください。まだ決まっていない先の段階（座席選択・支払い方法など）を先取りして質問しないでください。\n")
	b.WriteString("ユーザーが座席予約と一緒に飲食・グッズの購入も希望した場合は、reply で「グッズ・売店は予約確定後にご注文いただけます」という趣旨で案内し、slotsはそのまま変更しないでください。\n\n")

	b.WriteString("【現在わかっている条件】\n")
	fmt.Fprintf(&b, "- movieId: %s\n", slotOrUnknown(ctx.Slots.MovieID))
	fmt.Fprintf(&b, "- seatCount(希望人数): %s\n", slotOrUnknown(ctx.Slots.SeatCount))
	b.WriteString("\n")

	switch ctx.Stage {
	case reserveStageMovie:
		b.WriteString("【選べる映画一覧（このリストに存在するものだけをmovieIdに設定してよい）】\n")
		for _, m := range ctx.Movies {
			fmt.Fprintf(&b, "- movieId=%d 「%s」 ジャンル:%s 上映時間:%d分\n", m.MovieID, m.Title, m.Genre, m.Duration)
		}
		b.WriteString("\nユーザーの発言から観たい映画と希望人数を聞き取ってください。曖昧な場合はreplyで聞き返し、movieId/seatCountはわかった分だけ設定してください。\n")
	case reserveStageSeatCount:
		b.WriteString("映画は決まりました。次に何名様（何席）分のご予約か聞き取ってください。上映回（日時）や座席の具体的な位置はまだ聞かないでください（人数が決まり次第、今週の上映スケジュールをボタンで提示します）。\n")
	}

	b.WriteString("\n必ず次のJSON形式のみで回答してください（説明文やコードブロック、マークダウンは付けない。わからない項目は0または省略）:\n")
	b.WriteString(`{"reply": "ユーザーへの返答文", "slots": {"movieId": 0, "seatCount": 0}}`)
	b.WriteString("\n映画予約に関係ない質問には、reply で「AI予約では映画のご予約のみ対応しております」という趣旨で丁寧に答え、slotsは今わかっている値のまま変更しないでください。")

	return b.String()
}

func slotOrUnknown(v int) string {
	if v <= 0 {
		return "未定"
	}
	return fmt.Sprintf("%d", v)
}
