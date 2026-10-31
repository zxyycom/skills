### Case DECISION-STATIC-SPLIT-PURITY-001: 严格关系检查拒绝不纯拆分后继

Tests:
- `test:c8454be4624f741c0601a2055a44f2982836f3352e18954bc2c3b996b31dba06`

Tags:
- `decision-records`

Contract:
- 拆分后继必须恰好保存一条指向同一前序的拆分关系，不能同时混入其他直接关系。

Proves:
- 真实内存 Markdown 解析及领域图校验对后继混合拆分与修订关系返回拆分后继关系集不纯诊断。
