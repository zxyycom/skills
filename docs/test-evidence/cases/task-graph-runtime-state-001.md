### Case TASK-GRAPH-RUNTIME-STATE-001: missing 与 incompatible runtime 不被自动修复

Tests:
- `test:8866d97486672f613a13d762e6c8152537c1b4a08dde5ce3c0984b29bee26cbc`

Tags:
- `task-graph`

Contract:
- 缺失 runtime 返回安装 argv；已有目录的直接包版本或 API 不兼容时返回诊断并原样保留。

Proves:
- info 区分 missing/incompatible，mutation binding 分别返回 `RUNTIME_MISSING` 与 `RUNTIME_INCOMPATIBLE`；`RUNTIME_MISSING` 的 JSON-safe detail 使用无原型对象并保留与 info 相同的安装命令；错误版本没有安装指令，也不被删除。
