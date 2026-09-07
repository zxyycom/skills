### Case DECISION-STATIC-SPLIT-PURITY-001: 严格关系检查拒绝不纯拆分后继

Tests:
- `test:0bc16347f52804a3f3471db949b091de86a6e98c96022028a42390feb30cc816`

Tags:
- `decision-records`

Contract:
- 拆分后继必须恰好保存一条指向同一前序的拆分关系，不能同时混入其他直接关系。

Proves:
- 后继同时保存拆分与修订关系时，严格检查报告拆分后继关系集不纯。
