package chat

import (
	"bytes"
	"context"
	"encoding/json"
	"fmt"
	"io"
	"net/http"
	"time"
)

const (
	deepseekURL   = "https://api.deepseek.com/chat/completions"
	deepseekModel = "deepseek-chat"
)

// chatMessage は DeepSeek chat completions API のメッセージ形式（role/content のみ）。
// フロントから送られてくる会話履歴もこの形でそのまま往復する。
type chatMessage struct {
	Role    string `json:"role"`
	Content string `json:"content"`
}

type deepseekRequest struct {
	Model          string        `json:"model"`
	Messages       []chatMessage `json:"messages"`
	Temperature    float64       `json:"temperature"`
	ResponseFormat struct {
		Type string `json:"type"`
	} `json:"response_format"`
}

type deepseekResponse struct {
	Choices []struct {
		Message struct {
			Content string `json:"content"`
		} `json:"message"`
	} `json:"choices"`
	Error *struct {
		Message string `json:"message"`
	} `json:"error"`
}

// DeepSeekClient は DeepSeek の chat completions API を叩く自前HTTPクライアント。
// tool/function callingは使わず、response_format:json_object のみで
// 「固定プロンプト→JSON抽出」を1回のリクエストで完結させる。
type DeepSeekClient struct {
	apiKey     string
	httpClient *http.Client
}

func NewDeepSeekClient(apiKey string) *DeepSeekClient {
	return &DeepSeekClient{
		apiKey:     apiKey,
		httpClient: &http.Client{Timeout: 30 * time.Second},
	}
}

// Complete は systemPrompt + これまでの会話履歴を1回だけDeepSeekへ送り、
// JSONオブジェクト文字列（アシスタントの応答content）を返す。
// 呼び出し側が intent ごとのスキーマにアンマーシャルする。
func (c *DeepSeekClient) Complete(ctx context.Context, systemPrompt string, history []chatMessage) (string, error) {
	if c.apiKey == "" {
		return "", fmt.Errorf("DEEPSEEK_API_KEY is not configured")
	}

	msgs := make([]chatMessage, 0, len(history)+1)
	msgs = append(msgs, chatMessage{Role: "system", Content: systemPrompt})
	msgs = append(msgs, history...)

	reqBody := deepseekRequest{
		Model:       deepseekModel,
		Messages:    msgs,
		Temperature: 0.4,
	}
	reqBody.ResponseFormat.Type = "json_object"

	body, err := json.Marshal(reqBody)
	if err != nil {
		return "", err
	}

	req, err := http.NewRequestWithContext(ctx, http.MethodPost, deepseekURL, bytes.NewReader(body))
	if err != nil {
		return "", err
	}
	req.Header.Set("Content-Type", "application/json")
	req.Header.Set("Authorization", "Bearer "+c.apiKey)

	resp, err := c.httpClient.Do(req)
	if err != nil {
		return "", err
	}
	defer resp.Body.Close()

	respBytes, err := io.ReadAll(resp.Body)
	if err != nil {
		return "", err
	}

	var parsed deepseekResponse
	if jsonErr := json.Unmarshal(respBytes, &parsed); jsonErr != nil {
		return "", fmt.Errorf("invalid deepseek response (status %d): %w", resp.StatusCode, jsonErr)
	}
	if resp.StatusCode != http.StatusOK {
		msg := "deepseek request failed"
		if parsed.Error != nil && parsed.Error.Message != "" {
			msg = parsed.Error.Message
		}
		return "", fmt.Errorf("%s (status %d)", msg, resp.StatusCode)
	}
	if len(parsed.Choices) == 0 {
		return "", fmt.Errorf("deepseek returned no choices")
	}

	return parsed.Choices[0].Message.Content, nil
}
