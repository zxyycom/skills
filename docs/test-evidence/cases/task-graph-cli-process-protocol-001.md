### Case TASK-GRAPH-CLI-PROCESS-PROTOCOL-001: Process CLI 保持已选择的 stdout 协议与退出状态

Tests:
- `test:60672d69f9ef023e088b47de5812b839a284d8d82167bdad0f71b296862a1f15`

Tags:
- `task-graph`

Contract:
- 真实 Node process wrapper 必须原样传递 in-memory CLI 选择的文本或 JSON stdout、退出状态，并让可预期结果的 stderr 为空。

Proves:
- 默认文本 success 与 JSON command failure 两个代表路径都与内存入口保持相同 stdout、空 stderr 和退出状态。
