# Proposal

以 rename 为主线对齐两域共同事务义务，并审计 discard 的同类遗漏；本文件保存临时实施范围。

## Why

共同文件验收目前按 writes 与 guards 的表示选择串行或批量，IR rename 又在共同写前保护之外串行重读全部来源；同义务因领域表示不同承受不同成本。

## Outcome

DR/IR rename 与 discard 使用同一实际写集表达和安全验收调度；阶段新鲜度、安全、失败恢复和领域附加证明不减弱，并有独立阶段测量及回归证据。

## Scope

### Intended Change

共同 owner 收口 unchanged 提案与 guards 的计划表达，统一 writes/index/guards 批量验收；IR rename 的同阶段来源与索引保护交给共同安全 phase，并保留原有领域错误聚合和其他边界。

### Resulting Impacts

同步 DR/IR 工具源码、生成闭包与版本，维护最小原生测试及 Case，记录复杂 Bug 的可复核因果；discard 共同验收同样纳入，资源生命周期和领域 full collection 校验保持领域 owner。

## Success Criteria

- 大量真实 changed writes 与大量 unchanged guards 均进入共同批量验收，不以表示决定执行方式。
- prepare、写前、写后各自实际观察；fresh 的共享证明只限同 root/path/完整预期 facts 的单阶段。
- 两域正常、失败、恢复、Node 真实 CLI/SDK 与独立分发回归通过；阶段性能证据区分领域额外工作与共同开销。

## Affected Owners

`tools/record-operations/`、DR/IR 工具与行为 owner、生成适配、测试 Case、调查报告和本 Change。性能 evidence 由独立测量者拥有。
