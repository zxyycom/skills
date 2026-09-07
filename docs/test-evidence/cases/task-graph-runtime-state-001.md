### Case TASK-GRAPH-RUNTIME-STATE-001: missing 与 incompatible runtime 不被自动修复

Tests:
- `test:653c3e884fca7748f8fe2da6eba308511dda337dd7d36498ed76901b2fffab1d`

Tags:
- `task-graph`

Contract:
- 缺失 runtime 返回安装 argv；已有目录的直接包版本或 API 不兼容时返回诊断并原样保留。

Proves:
- info 区分 missing/incompatible，mutation binding 分别返回 `RUNTIME_MISSING` 与 `RUNTIME_INCOMPATIBLE`；错误版本没有安装指令，也不被删除。
