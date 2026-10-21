### Case GATE-TOOL-CAPABILITY-ROUTING-001: 领域输入只激活明确工具订阅者并拒绝孤儿输入

Tests:
- `test:966a9ef9dfd1127e0e52c0b25334e89148540d8e69bf53936f9706ee815b3307`
- `test:fe389c82da692fa25deee6686c3384179cc0ee14cb75788dd1c2361853f8d8cc`

Tags:
- `repository-tooling`

Contract:
- 领域输入必须归属于明确工具能力；仓库级扫描覆盖不代替领域归属，工具变化只激活声明订阅者及其必要前置。

Proves:
- Decision stage、Investigation CLI、query 与 stage fixture 输入变化分别激活对应工具及订阅 Check，无关领域 Check 保持 reuse。
- Investigation CLI 变化同时重跑消费真实分发 CLI 的 collection-and-resources Check，不复用只适用于旧入口的通过结果。
- 两领域未声明的源码或测试输入进入 unclassifiedPaths，全部项目 Check 执行且不能发布成功 receipt，原因为 inputs-unclosed。
