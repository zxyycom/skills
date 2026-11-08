### Case INVESTIGATION-STAGE-PENDING-LOCATOR-INDEX-001: domain 按必要性消费 pending 定位索引

Tests:
- `test:5e4c19e643c95d09f1b450491ecf53ab08d2c8e5ddbae207eb6f0a2aa46ee4e1`
- `test:cc76492cb8a2c3aa0a587c7e8d0e2488e1dea50a4787e209ecd93314a62dd311`

Tags:
- `investigation-report`

Contract:
- domain scope 使用可用的 pending 索引补充所选记录旧位置；pending 索引损坏时在独立可信 locator 足够定位的情况下仍可处理，且保持 pending 索引和未选内容。

Proves:
- 真实 Git 中 HEAD/W 只含 beta，pending 索引独有 alpha 的 odd-location.md，W 删除该来源后选 alpha；domain 删除 pending 旧正文，pending 索引字节、未选内容及 W 索引保持。
- 同一 ID 在 H/P/W 分别位于 head-old、staged-old、current 时，domain 清理 H/P 旧路径并暂存 current，P 索引和未选内容不变；P 索引坏 JSON 时使用 canonical pending locator 与 H/W，同样成功并保留损坏索引字节。
