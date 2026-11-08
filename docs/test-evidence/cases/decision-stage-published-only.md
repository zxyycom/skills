### Case DECISION-STAGE-PUBLISHED-ONLY-001: 索引暂存只消费发布投影

Tests:
- `test:a0f7e8d91d7cab17bf5ef5c757033826305a9f83f591226e2057905066410af4`

Tags:
- `decision-records`

Contract:
- index scope 消费选中的发布索引投影，不要求读取正文。

Proves:
- 只有索引的真实 Git fixture 中选中条目取工作区投影，未选条目沿用 pending，工作区索引不变。
