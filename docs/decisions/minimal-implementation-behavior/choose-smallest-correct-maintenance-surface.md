---
title: 以有界候选比较选择最小实现维护面
status: active
alignment: aligned
createdAt: 2026-07-23T07:45:41Z
purpose: 让目标与责任已明确的工程任务在正确候选之间选择更小维护面，并能独立审计过度工程。
background: 相邻 skills 已拥有产品架构、共享契约和测试证据判断，依赖、配置与预防性机制仍缺少实现取舍 owner。
decision: 新增独立 minimal-implementation，以单一、有界流程识别决定性维护面并按授权选择、实施或报告，不依赖相邻 skill 安装。
relations: []
---

## 目的
- 为目标、contract 和责任 owner 已明确的工程任务建立稳定的实现取舍 owner。
- 让会改变选择的额外依赖、抽象、配置、扩展点、状态和长期 ownership 具有当前依据。
- 让实现前选择与实现后 complexity audit 使用同一套正确性和维护面标准。

## 背景
- 过度抽象、无效配置、通用逃生口、新依赖和为未来场景预建的机制会反复增加工程维护成本。
- `product-architecture-judgment` 已负责事情是否该做、做到什么程度和责任层，`common-denominator-design` 已负责跨场景共享契约，`test-evidence-review` 已负责测试证明价值；这些 owner 不完整承接多个正确实现候选之间的维护面比较。
- 把最小性等同于行数、把固定候选顺序当作绝对排名，或让该能力隐式接管所有编码与 review，会削弱正确性并与相邻 owner 重叠。

## 决策
- 采用: 新增独立分发、流程与决策型 `minimal-implementation`，只在目标、governing contract、责任 owner 和检查范围已经明确时，识别会改变选择的维护面、有界搜索现实候选、先过正确性门槛，再比较总体维护成本。
- 采用: 维护面分析按选择影响和风险成比例；简单任务只做紧凑核对，候选存在实质差异或用户要求 audit 时才展开逐项证据，已有证据足以形成稳定结论时停止搜索。额外维护面需要当前依据，候选机制不可避免的成本直接进入比较。
- 采用: 实现前选择、当前 diff review 和指定范围 audit 共用一条核心流程；是否修改、只读报告或保留待确认问题由当前任务授权决定，不维护独立模式。
- 采用: 省略或删除、同语义同 owner 复用、标准库或平台机制、依赖和局部自定义实现只构成搜索顺序；最终选择以 contract 正确性和总维护面为准，不以行数或候选层级单独决定。
- 采用: 目标价值、架构责任、共享契约和测试证据仍由各自 owner 承接。相邻 skills 不构成安装依赖；前置缺失时明确缺口、保持局部或请求当前任务确认，不由本 skill 补造判断。
- 采用: 嵌入普通 code review 时服从宿主输出契约；独立 complexity audit 使用证据化的 `delete`、`reuse`、`stdlib`、`native` 和 `yagni` finding，不使用容易退化为行数优化的 `shrink`。
- 采用: 固定上游逐字快照和许可证随 skill 保存以支持追溯，正常执行不加载这些材料。
