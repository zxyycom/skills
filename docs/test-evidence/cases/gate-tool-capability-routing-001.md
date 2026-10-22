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
- Decision stage、Investigation CLI、query 与 stage fixture 输入变化分别激活对应工具及订阅 Check，无关领域 Check 保持 reuse。
- Decision 的 source-discovery 与 query-loaded-snapshot 测试按 record/query 能力归属；Investigation 的 candidate-read-context 与 current-index 测试按 record/query 能力归属。四项修改后输入均保持闭合，对应领域订阅 Check 重新执行，无关领域及 markdown-lint 保持复用。
- Investigation CLI 变化同时重跑消费真实分发 CLI 的 collection-and-resources Check，不复用只适用于旧入口的通过结果。
- 两领域未声明的源码或测试输入进入 unclassifiedPaths，全部项目 Check 执行且不能发布成功 receipt，原因为 inputs-unclosed。
- Decision 局部维护、stage 刷新、来源依赖与安全路径模块及对应测试/共享 fixture 单独变化时均保留闭合增量模式，实际消费者重跑，无关领域与 Markdown 检查复用。
