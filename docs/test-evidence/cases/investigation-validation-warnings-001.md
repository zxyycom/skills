### Case INVESTIGATION-VALIDATION-WARNINGS-001: CLI trace accepts report-level direction options

Tests:
- `test:cc97eeae71e6808bbcf989da87cd985afdef95fc781a894db3ee1e2fa356cae2`

Tags:
- `investigation-report`

Contract:
- 直接调用的源码 CLI 入口 `trace` 支持报告级关系方向选项。

Proves:
- 带 `--direction successors` 的有效 trace 成功、stderr 为空，并在 stdout 返回后继报告和边。
