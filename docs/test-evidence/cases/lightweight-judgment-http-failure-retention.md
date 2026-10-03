### Case LIGHTWEIGHT-JUDGMENT-CLI-031: 正文接收失败保留已知 HTTP 错误

Tests:
- `test:041a9a51d650a2f3f44415e252081fb83f87923abf029e8406b64553f8db9f62`

Tags:
- `lightweight-judgment`

Contract:
- 日志和正文留存开关不改变已知 HTTP 失败；不完整正文不作为已接收结果，也不允许迟到响应改写已结束调用。

Proves:
- 日志开关、响应留存开关、401／429 与正文读取失败／超时的组合均仅发送一次，保留 authentication／rate_limit、HTTP 状态和 retryAfterMs=7000，退出 3 且不输出底层正文错误。
- 启用日志时记录 failed、原 error_kind 与 http_status，response_body 为 NULL，persistence 为 recorded；迟到正文不再改变数据库记录。
