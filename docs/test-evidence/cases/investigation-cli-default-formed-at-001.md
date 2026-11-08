### Case INVESTIGATION-CLI-DEFAULT-FORMED-AT-001: 源码 CLI 省略 formedAt 时使用当前 UTC 秒

Tests:
- `test:db8890cd65d21c3bd001589cd82f48e004a7c0583b54f3071e6cbc403d065331`

Tags:
- `investigation-report`

Contract:
- new 省略 formed-at 时使用当前 UTC 时间，生成 ID 日期与该 UTC 日期一致。

Proves:
- 真实 CLI 未传 formed-at 成功创建，来源 parsed formedAt 的 UTC 秒位于调用前后窗口，返回 ID 与其 UTC 年月日一致。
