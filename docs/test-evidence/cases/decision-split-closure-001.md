### Case DECISION-SPLIT-CLOSURE-001: 严格关系检查拒绝开放拆分

Tests:
- `test:55986a2ea4b974da83458c0e9fad766308618529f66e2fd84b3d97f303d8c9f0`

Tags:
- `decision-records`

Contract:
- 已建立关系图中的拆分必须形成至少两个指向同一直接前序的后继。

Proves:
- 把既有单前序修订改成只有一个直接后继的拆分后，严格检查报告至少需要两个直接拆分后继。
