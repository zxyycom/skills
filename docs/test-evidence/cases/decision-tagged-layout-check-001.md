### Case DECISION-TAGGED-LAYOUT-CHECK-001: 标签化根目录与归档记录的严格 Check

Tests:
- `test:051f816d6a02f84620a835b7e8ab384f56d97ec147311f4cf973373d2f20a4ae`

Tags:
- `decision-records`

Contract:
- 严格 check 接受当前标签化 root/archive fixture，并统计 established 生命周期。

Proves:
- API 验证无错误，计数为两条决策、一 active、一 archived。
