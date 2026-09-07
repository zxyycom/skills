### Case DECISION-TAGGED-LAYOUT-CHECK-001: 标签化根目录与归档记录的严格 Check

Tests:
- `test:bdb3d2244d15149737e3f748cf28dfe0bd7959f823d8eb53ac9a0b8981305d0b`

Tags:
- `decision-records`

Contract:
- 严格 check 接受当前标签化 root/archive fixture，并统计 established 生命周期。

Proves:
- API 验证无错误，计数为两条决策、一 active、一 archived。
