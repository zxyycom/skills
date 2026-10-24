### Case GATE-TOOL-CAPABILITY-ROUTING-001: 领域输入只激活明确工具订阅者并拒绝孤儿输入

Tests:
- `test:46c4385cfe158f39637f7b7b9a1bb6410fbe87542cfc09aa8313bc2fb21d67c7`
- `test:da36d0d60693208423ac53def4b8a41a0b0cd563580d571e4db94770835da7fb`
- `test:fe389c82da692fa25deee6686c3384179cc0ee14cb75788dd1c2361853f8d8cc`

Tags:
- `repository-tooling`

Contract:
- 领域输入必须归属于明确工具能力；仓库级扫描覆盖不代替领域归属，工具变化只激活声明订阅者及其必要前置。

Proves:
- Decision stage、Investigation CLI、query 与 stage fixture 运行时沿实际 consumer 选择；同域测试字节只激活所属测试 Check，不使 live collection checks 因 sibling 测试变化失效。
- Decision source-discovery/query-loaded-snapshot 与 IR candidate-read-context/current-index 的测试能力保持闭合并重跑所属 consumer，无关领域及 markdown-lint 复用。
- IR CLI 运行时覆盖真实 source/分发消费者；DR 当前实际使用 source CLI 的 record consumer 保守包含 CLI/query/maintenance/stage/shared-search 闭包，不把这种接线当成分发消费。
- 两领域未声明源码或测试进入 unclassifiedPaths，fallback 且不能发布成功 receipt；局部 operation/source safety runtime 与测试/helpers 分别传播到矩阵声明的真实订阅者。
