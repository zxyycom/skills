### Case TASK-GRAPH-ERROR-JSON-DETAILS-001: 错误详情保留 JSON 布尔值

Tests:
- `test:1c0dadd6cdb74511c7f493f8c85ff005eddd28b1448daddbd28d7bee66f7ccba`

Tags:
- `task-graph`

Contract:
- 公开错误 details 是无原型 record，JSON 布尔值不能被丢弃或转成其它类型。

Proves:
- accepted:true 与 rejected:false 在无原型 details 和 JSON 往返后均保持完整字面值。
