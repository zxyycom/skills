### Case DECISION-STAGE-BOOTSTRAP-001: Stage 构建第一份决策集合投影

Tests:
- `test:8178e4b672d1a4769b942e7131058b1fb7605a46751593ee77dcd6d9c618b1db`

Tags:
- `decision-records`

Contract:
- 没有 HEAD 的 stage 从工作区发布投影选择首个对象，组合合法 pending 索引和正文，不自动加入未选对象。

Proves:
- 真实 Git unborn stage 只把所选 A 写入 pending 索引与正文，B 保持未暂存。
