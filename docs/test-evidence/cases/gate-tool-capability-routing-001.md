### Case GATE-TOOL-CAPABILITY-ROUTING-001: 领域输入只激活明确工具订阅者并拒绝孤儿输入

Tests:
- `test:9fd439a7518966416708445232586c44d3c06726a0b2a8ced9daaff8cab1a6ab`
- `test:ecb5c76d0aef27c87e3eff8c5f9d9132d77f294a0d204a8005b7fb21c3ca0e96`
- `test:fb5ea74d69abe69ae09198f155e3f5c6dfad3e3cd5040637e4ce027205d927d3`

Tags:
- `repository-tooling`

Contract:
- 领域输入必须归属于明确工具能力；仓库级扫描覆盖不代替领域归属，工具变化只激活声明订阅者及其必要前置。

Proves:
- Decision stage、Investigation CLI、query 与 stage fixture 运行时沿实际 consumer 选择；同域测试字节只激活所属测试 Check，不使 live collection checks 因 sibling 测试变化失效。
- Decision source-discovery/query-loaded-snapshot 与 IR candidate-read-context/current-index 的测试能力保持闭合并重跑所属 consumer，无关领域及 markdown-lint 复用。
- IR CLI 运行时覆盖真实 source/分发消费者；DR 当前实际使用 source CLI 的 record consumer 保守包含 CLI/query/maintenance/stage/shared-search 闭包，不把这种接线当成分发消费。
- 两领域未声明源码或测试进入 unclassifiedPaths，fallback 且不能发布成功 receipt；局部 operation/source safety runtime 与测试/helpers 分别传播到矩阵声明的真实订阅者。
