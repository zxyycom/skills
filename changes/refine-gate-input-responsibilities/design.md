# Design

以真实输入闭包和独立证明契约划分工作，沿用现有 Gate 与测试入口兑现减少无关执行的目标。

## Context

- 基线为 `3666448328b6cd3af73404b3d2ceaf888216605a`。工作区已有另一会话的版本控制修复、测试、Case、生成物与 skill 版本改动，保留且不纳入本任务提交。
- 前轮共享 renderer 场景为源码 `record-search-output.ts` 与两领域生成副本的内容变更。项目执行 13 项、复用 39 项；选择范围仍有两项无关检查和偏宽领域容器。
- Check 的输入与生成前置由 `docs/gate-check-authoring.md` 定义；测试与源码边界由 `docs/tooling.md` 和 `docs/coding-style.md` 定义。
- 本轮临时运行证据放在 `.log/vibe-check/refine-gate-input-responsibilities-20261021/`，实际验证摘要由本目录 `verification.md` 承接。

## Goals / Non-Goals

目标是减少共享 renderer 场景的无关检查和领域矩阵，并对公共输入完成有证据的局部收紧。主实现使用 6.1sol，阶段审查与最终优化独立执行。沿用原生调度、材料政策、生成 provider 和完整 Case fingerprint，以执行范围和证明完整性验收；调度框架、全仓重构与固定秒数收益不在本轮范围。

## Decisions

### Intended Change

1. 按 validator 和 generated-file 测试的实际读取范围拆清能力订阅。
2. 决策记录生命周期的 129 个节点不证明搜索契约，renderer 耦合来自输出聚合的静态 import。决策记录仅在搜索成功分支动态加载既有 `cli-output-search`；调查报告仅在搜索分支动态加载 renderer。两者均保留现有 CLI 入口，不增加 facade。
3. 决策记录查询中的 8 个搜索节点移入现有 public-distribution 容器，测试函数体、名称和断言保持不变，Case 仅更新入口 ID。查询容器保留非搜索节点；必要集成边界继续由真实 CLI、Node 与 Git fixture 证明。
4. 公共输入按 invocation/Definition 的真实加载闭包和共同配置声明；索引运行时、updater 与共享公共工具的独立测试归实际消费者。`repository-validation` 按 SKILL.md 内容和布局身份建模，`generated-file` 按临时 fixture 与实现闭包建模。领域构建仍保守保留脚本及跨领域运行时，完整源码/材料继续由宽消费者覆盖；具体输入证据见 `verification.md`。

### Resulting Impacts

- 输入语义变化要求同步证明版本、订阅、catalog 与受影响回归测试。
- 新增或拆分原生入口要求 Case、source fingerprint 与索引一致，并可从原入口追溯覆盖后继。
- CLI 加载或生成内容变化要求验证源码与分发副本一致，保留必要真实运行时接线证据。
- 当前调查报告 collection 容器还包含另一会话的历史查询测试，真实加载源 CLI 并调用生成 CLI；补齐其相关输入订阅和统一生成前置，保持该测试原样。
- 稳定行为知识写回原 owner；是否达到长期决策记录门槛由最终语义审查判断。

## Risks / Trade-offs

- 完整 CLI 的传递加载可能限制生命周期输入收紧。依赖无法闭合时保守保留，并明确此次实际减少的是哪些矩阵。
- 过度拆分会增加维护面。按独立证明责任划分，不按耗时均衡划分。
- 并行会话已有改动可能影响全仓验证与提交归属。逐路径核对来源，无法隔离的验证差异单独报告。

## Open Questions

暂无需要用户决定的问题。输入模式已由实施审计确定，阶段独立审查、共享场景选择和全仓验证按 `tasks.md` 继续推进。
