### Case INVESTIGATION-VALIDATION-WARNINGS-001: CLI trace accepts report-level direction options

Tests:
- `test:2eb77bfae2c06c3084f6f33f1d9f73ac5fa788dc07a4139a39871169cf2c16b3`

Tags:
- `investigation-report`

Contract:
- 直接调用的源码 CLI 入口 `trace` 支持报告级关系方向选项；文本关系边保留 source、type、target 与缺省摘要标记，JSON 关系对象保持原结构。

Proves:
- 带 `--direction successors` 的有效 trace 成功、stderr 为空，并在 stdout 的前后继区展示带缺省标记的有向边。
- depth 0 的真实 CLI JSON frontier 依次写入 fromId、direction、reason 与 nextIds，JSON entries relation 保持原对象结构。
