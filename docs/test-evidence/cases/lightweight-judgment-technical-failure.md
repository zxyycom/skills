### Case LIGHTWEIGHT-JUDGMENT-CLI-007: 技术失败与隐私

Tests:
- `test:1c3c9a862a1282f436cb779ac03769b82ebc692215fde78e562b3a00c8e3e24d`

Tags:
- `lightweight-judgment`

Contract:
- HTTP、连接和完整响应超时分别分型，不重试或输出远端正文与凭据。

Proves:
- 鉴权、限流、余额、重定向、服务失败、网络、header 等待与正文等待超时只尝试一次，正文超时也保留已接收 HTTP 200，保留 HTTP 状态和 Retry-After，不泄露 mock 凭据或远端错误正文。
