### Case TASK-GRAPH-DISTRIBUTION-LIST-PARITY-001: 生成 CLI 的 task list 文本与 JSON 模式均与源码一致

Tests:
- `test:16fb3704ca99ccdcd234d46db91b8e55981749ac671c44b2b42b57e58dc0f41c`

Tags:
- `task-graph`

Contract:
- 分发 CLI 必须保留源码的默认 task-list renderer 与显式 JSON projection serialization，不能在打包边界产生协议漂移。

Proves:
- 同一 fixture 和同一次生成模块 import 下，文本与 JSON 两种调用的退出状态和完整 stdout 都分别与源码逐字节相同。
- 文本包含 TASK LIST 摘要、实际 task ID 与 title；JSON 可解析为 ok success。
