### Case DECISION-SPLIT-CLOSURE-001: 严格关系检查拒绝开放拆分

Tests:
- `test:28b6bea5e4620950575efc0c04be0901008e2def6781eaa3f903885d6a5f7334`

Tags:
- `decision-records`

Contract:
- 已建立关系图中的拆分必须形成至少两个指向同一直接前序的后继。

Proves:
- 真实内存 Markdown 解析及领域图校验对只有一个直接后继的已建立拆分返回至少需要两个直接拆分后继的诊断。
