### Case INVESTIGATION-VALIDATION-WARNINGS-001: CLI trace accepts report-level direction options

Tests:
- `test:f82faae2f91cd7d9ac0d3ca5797e6f9b8c8300ab97c0a987b9af5298e2a29b5a`

Tags:
- `investigation-report`

Contract:
- 直接调用的源码 CLI 入口 `trace` 支持报告级关系方向选项。

Proves:
- 带 `--direction successors` 的有效 trace 成功、stderr 为空，并在 stdout 返回后继报告。
- depth 0 的真实 CLI JSON frontier 依次写入 fromId、direction、reason 与 nextIds。
