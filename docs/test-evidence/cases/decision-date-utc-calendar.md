### Case DECISION-DATE-UTC-CALENDAR-001: 日期身份采用 UTC 日历日

Tests:
- `test:e9950853414bb248d223ceb61502147c061c0d43086575add4135cb74e86d235`

Tags:
- `decision-records`

Contract:
- 日期身份按输入时刻的 UTC 年月日生成六位日期前缀，不按本地或输入 offset 日历日取值。

Proves:
- 原生 `NewOperation::at` 对五个固定时刻分别核对独立字面 ID，覆盖跨年、平年/闰年二月边界、世纪格式与正负时区偏移；节点不声称 CLI 可注入时钟。
