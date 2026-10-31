### Case DECISION-STAGE-PUBLISHED-ONLY-001: 索引暂存只消费发布投影

Tests:
- `test:bb4840e3755c1a1079da5466308ede29acc9fe9fd7b54c91b1c0f8d3353f4675`

Tags:
- `decision-records`

Contract:
- index scope 只消费所选发布投影，不要求当前工作区正文健康或同步。

Proves:
- 工作区 A 正文被替换为无效文本后 index stage 仍准确暂存先前已发布 A 投影，pending 正文保持 HEAD。
