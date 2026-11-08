### Case DECISION-STAGE-SCOPE-INDEX-001: stage --scope index writes only the derived index projection

Tests:
- `test:a0f7e8d91d7cab17bf5ef5c757033826305a9f83f591226e2057905066410af4`

Tags:
- `decision-records`

Contract:
- index scope 只更新所选索引投影，不暂存正文。

Proves:
- 真实 Git 中所选 A 标题取工作区，未选 B 保留 pending 版本，结果仅修改索引路径；工作区索引与无关 pending 保持。
