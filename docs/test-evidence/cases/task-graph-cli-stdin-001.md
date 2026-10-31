### Case TASK-GRAPH-CLI-STDIN-001: apply 从 stdin 接收单个 JSON request

Tests:
- `test:acc469beec716ad9872a7194389625ded4e79258ba1d010b3b06ad3c5f4bd8b8`

Tags:
- `task-graph`

Contract:
- apply 在未指定 file 时从 stdin 读取完整 JSON request，并保持 JSON-only 进程协议。

Proves:
- stdin 批次成功提交并返回 alias 映射，stdout 只有一个 LF JSON 且 stderr 为空。
