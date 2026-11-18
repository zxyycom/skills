### Case AGENT-MEMORY-INPUT-001: 拒绝写入中的未知字段

Tests:
- `test:524abfba00d353b850f705fd2e146d6f12aec710f8cf2dcdd2097217c544fca4`
- `test:cda24fbaff57537df2ee711ddab30ecfb5ee4198132d83deafdba1258076c9f2`

Tags:
- `agent-memory`

Contract:
- 记忆写入只接受声明字段；校验失败不新增单元、不推进版本、不占用未提交的请求 ID。

Proves:
- 单条保存、修订和复核中的误拼字段被拒绝，召回没有残留条目，原正文和版本未变；修正后相同请求 ID 可以提交；已提交 ID 的异内容请求仍优先报冲突。
- 批次外层、条目和关联的未知字段使整个拆分拒绝，未新增分支或退役原单元；同一请求 ID 可在修正后提交完整拆分。
