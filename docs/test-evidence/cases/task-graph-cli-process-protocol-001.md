### Case TASK-GRAPH-CLI-PROCESS-PROTOCOL-001: Process CLI 保持已选择的 stdout 协议与退出状态

Tests:
- `test:d6f2e20ee2db39abc536fe4a4b4f2aada3ad600e023aea46de4e87a82ce5b876`

Tags:
- `task-graph`

Contract:
- 真实 Node process wrapper 必须原样传递 in-memory CLI 选择的文本或 JSON stdout、退出状态，并让可预期结果的 stderr 为空。

Proves:
- 默认文本 success 与 JSON command failure 两个代表路径都与内存入口保持相同 stdout、空 stderr 和退出状态。
