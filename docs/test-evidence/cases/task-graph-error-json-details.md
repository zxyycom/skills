### Case TASK-GRAPH-ERROR-JSON-DETAILS-001: 错误详情保留 JSON 布尔值

Tests:
- `test:f2a4e52c4e80d8c3ba24da0d291d155b00e2eb650bced522aa29cc3fafecfdd0`

Tags:
- `task-graph`

Contract:
- 公开错误 details 是无原型 record，JSON 布尔值不能被丢弃或转成其它类型。

Proves:
- accepted:true 与 rejected:false 在无原型 details 和 JSON 往返后均保持完整字面值。
