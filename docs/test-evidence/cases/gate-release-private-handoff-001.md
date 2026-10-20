### Case GATE-RELEASE-PRIVATE-HANDOFF-001: 发布步骤消费同次 Run 的私有 typed handoff

Tests:
- `test:8ae6957ad4a2cd1d3216522018da0835003b9698a54bb67114e1e960384bfa8a`

Tags:
- `repository-tooling`

Contract:
- prepare、authorization 与 pack 使用原生 typed handoff 传递同次 Run 的发布准备对象；私有对象不写入公开 snapshot，也不能跨 Run 复用。

Proves:
- pack 收到的对象与该 Run prepare 返回值为同一引用；连续成功 Runs 的引用不同，公开 snapshot 不含 handoff 或内部 snapshot 字段。
- 后续 Run prepare 失败时 pack 不再执行，先前的成功 handoff 不会使发布通过。
