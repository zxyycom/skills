### Case GATE-PERFORMANCE-REPORT-ONLY-001: 非强制范围如实报告而不新增预算阻断

Tests:
- `test:667e788783cdc95a65a84b81cce9d7eafb4587362a83ce977ff5c7295de5a248`

Tags:
- `performance`
- `repository-tooling`

Contract:
- 非强制范围沿用同一性能统计、超限与数据状态，但性能预算不改变其通过状态。

Proves:
- 三项超限在 report-only 中完整保留，报告仅改变 enforceBudget 与 passed；缺失或非法样本仍保留 unavailable/invalid 和 null 统计，但不阻断。
