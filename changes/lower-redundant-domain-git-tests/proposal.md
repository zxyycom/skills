# Proposal

按已审定的 97 项测试清单收紧调查报告和决策记录的真实 Git 验证边界，本目录保存本轮实施与验收计划。

## Why

97 个原生测试节点中，24 项的当前观察可以在既有轻量入口保留，16 项的 Git 运输验证与现有代表重叠。继续为这些规则分别建仓，不能增加相应的独立证据。

## Outcome

完成 24 项下沉和 16 项重复 Git 部分去重，保留各项必要的领域断言、真实 Git 接线与外部状态验证；7 项替代证据未闭合的测试保持不变。

## Scope

### Intended Change

- 调查报告：处理 14 项下沉和 11 项重复 Git 验证。
- 决策记录：处理 10 项下沉和 5 项重复 Git 验证；公共来源漂移的真实 Git 代表保留一次，scope 成功接线由现有代表承接。
- 使用既有领域、文件系统和命令行入口；逐项保存原观察的最终去向。

### Resulting Impacts

- 同步测试名称、最小原生入口与 Case 的 Tests、Contract、Proves，重建派生索引。
- 保留 Git 历史、暂存隔离、文件表示、并发保护、故障诊断和调用预算的必要代表。
- 调整只涉及测试及其直接证据；生产代码、Gate 划分、调度、阈值、依赖和分发内容保持不变。

## Success Criteria

1. 清单中的 40 项均有可核对的实施去向，独有领域断言和错误语义保留；去除的是不必要的 Git 使用，而非规则。
2. 7 项待证测试的主体和断言保持不变，50 项保留代表的必要边界未被削弱；50 不是新的最低数量或性能配额。
3. 不新增生产抽象、测试框架、Git mock 或专供测试的生产导出。
4. 两领域稳定测试入口、Case 结构/引用/覆盖检查及项目 Gate 通过，独立正确性审查没有未解决阻断。
5. 完成编码规范优化与 AI-Ready 文档复核后，按 Change Plan 契约保存完成态并结项。

## Affected Owners

- [项目工具链](../../docs/tooling.md)：稳定验证入口与测试边界。
- [编码规范](../../docs/coding-style.md)：测试实现的表达与抽象要求。
- [调查工具维护](../../tools/investigation-report/README.md)、[决策工具维护](../../tools/decision-records/README.md)：两领域源码和测试 owner。
- [测试证据维护](../../skills/test-evidence-review/SKILL.md)：Case 及派生索引。
- [Change Plan](../../skills/change-plan/SKILL.md)：计划、完成声明和安全结项。
