### Case GATE-PERFORMANCE-STRICT-BUDGETS-001: quick 性能预算使用严格小于边界

Tests:
- `test:1bf6bf0a16785e180d084873ea7434a0d3117cf66802df21e9de63f4bbd6414d`

Tags:
- `performance`
- `repository-tooling`

Contract:
- quick 的总墙钟、实际执行 Check 的 P90 与均值必须分别严格小于 30000、10000 与 5000 毫秒；等于边界即阻断。

Proves:
- 三项指标分别低于边界时通过，等于或高于边界时失败，并仅报告对应指标的实际值与限额；P90 样本保持均值未超限以区分两项责任。
