### Case INVESTIGATION-LAZY-INTERSECTION-001: 关系类型与目标在同一条边上取交集

Tests:
- `test:9e5609665fee019ea1405c2bbc5290aac17a0086ff0af071f9c19a8490f9d1aa`

Tags:
- `investigation-report`

Contract:
- 关系类型和 target 同用时只接受同一条边，type-only 与前序方向保留对应来源摘要。

Proves:
- 一个来源的不同 target/类型不能拼接命中；单独类型与指定前序方向返回精确证据，同一作用域所有操作只物化一次图。
