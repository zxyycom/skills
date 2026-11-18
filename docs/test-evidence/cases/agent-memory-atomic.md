### Case AGENT-MEMORY-ATOMIC-001: 写入重放与版本冲突

Tests:
- `test:452a101bfc8f33b5ec550bb1da4196e75d4162fe4820482dca910b7acf6fa006`

Tags:
- `agent-memory`

Contract:
- 同一写入请求重放不重复落库；请求或预期版本冲突不写入。批量拆分成功时发布全部继任单元并退役原单元。

Proves:
- 同一请求重放返回原结果且没有重复命中；异内容重放和过时修订拒绝，原版不变。
- 批量拆分重放返回原继任单元，召回没有重复结果，原单元已退役。
