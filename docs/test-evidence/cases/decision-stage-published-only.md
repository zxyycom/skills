### Case DECISION-STAGE-PUBLISHED-ONLY-001: 索引暂存只消费发布投影

Tests:
- `test:8c4917b7ce1d10d5f949f386a075fe029de76e37dbac565ec54c8b009274c1be`

Tags:
- `decision-records`

Contract:
- index scope 只消费所选发布投影，不要求当前工作区正文健康或同步。

Proves:
- 工作区 A 正文被替换为无效文本后 index stage 仍准确暂存先前已发布 A 投影，pending 正文保持 HEAD。
