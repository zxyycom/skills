### Case LIGHTWEIGHT-JUDGMENT-CLI-007: 技术失败与隐私

Tests:
- `test:7a44b92636478e8235d46915e3f0d1edb194d95170ff47bb870bcc0a4a90ba11`

Tags:
- `lightweight-judgment`

Contract:
- HTTP、连接和完整响应超时分别分型，不重试或输出远端正文与凭据。

Proves:
- 鉴权、限流、余额、重定向、服务失败、网络、header 等待与正文等待超时只尝试一次，正文超时也保留已接收 HTTP 200，保留 HTTP 状态和 Retry-After，不泄露 mock 凭据或远端错误正文。
