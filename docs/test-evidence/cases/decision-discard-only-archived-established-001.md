### Case DECISION-DISCARD-ONLY-ARCHIVED-ESTABLISHED-001: Discard 删除唯一 archived 已建立决策并保留合法空索引

Tests:
- `test:6a6cade9052da091bc088374814e80fac3f43d55140d254537bd36c554fc8b48`

Tags:
- `decision-records`

Contract:
- 删除最后一个归档正式记录后，保留合法空索引供后续发布。

Proves:
- 真实 CLI 删除唯一归档来源，索引解析后 entries 为空；再发布候选，索引包含新身份。
