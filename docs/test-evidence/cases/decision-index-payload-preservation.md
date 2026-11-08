### Case DR-INDEX-PAYLOAD-PRESERVATION-001: index scope 保留未选 pending 索引投影

Tests:
- `test:a0f7e8d91d7cab17bf5ef5c757033826305a9f83f591226e2057905066410af4`

Tags:
- `decision-records`

Contract:
- index scope 更新所选索引投影并保留未选 pending 投影。

Proves:
- 真实 Git 中所选 A 取工作区 title，未选 B 沿用 pending title，工作区索引与无关 pending 正文不变。
