### Case GRAPH-TRACE-SNAPSHOT-001: 可变 admission 单位按扩展取得快照

Tests:
- `test:d74be15eae026f0ee2ffa67ad809b4fbe88e780321478ce33d49ca5beedcb50f`

Tags:
- `performance`
- `semantic-fidelity`

Contract:
- adapter 的可变 unit 或可变成员数组不能因同对象身份复用旧规范化结果。

Proves:
- 未冻结 unit 与仅冻结 unit 对象时，后续新增 traceIds 均被实际接纳并从 context 提升。
