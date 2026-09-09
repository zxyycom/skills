# Tasks

本清单按“基线与消费契约 → 分组解析与领域输入 → 单次关系事务 → owner 与生成物 → 测试证据”的顺序实施。完成出口是逐 successor 关系输入、闭合事务、AI-ready 文档和可检索证据在同一集成基线上一致。

## Readiness

- [x] 0.1 在源码与分发版 v53 上复现：同一拆分 target 的两个 `--relation-summary` 因重复 target 退出 `2`，单个 summary 会复制到全部 successor；确认生成制品与源码一致。
- [x] 0.2 核对 `SKILL.md`、固定规则、CLI help、关系事务源码、测试、长期决策与当前 Change 列表，确认缺口位于已建立多后继关系的逐 successor 输入，没有另一个已在实施的 Decision Records 关系协议 Change。
- [x] 0.3 确认方案保持完整 successor 事务、完整 relation replacement、candidate 来源模式和统一 override 兼容，并采用 `--relations-for` 显式分组；确认没有待决范围、权限或验收问题。
- [x] 0.4 按 AI-ready 消费契约审阅直接文档，确认关系规则需要显式分离事务成员与逐 successor 载荷，人类说明含一次性 alignment definition 升级残留；否定词数量和文件行数本身不构成整改要求。
- [ ] 0.5 实施前重新检查 Git 状态、Decision Records skill 当前版本、目标文件 diff 和相关 active decisions；保留其他 Change、Vibe Gate 与并行任务的改动，并以最新集成基线决定版本和索引更新。

## Implementation

- [ ] 1.1 在 Decision Records CLI 参数边界增加 `--relations-for <successor-selector>` 事件分组，保留 relation 相关 argv 顺序；解析组内完整 relation、summary 与 clear 意图，并为首组前事件、空组、模式混用和原始重复提供退出码 `2` 的明确诊断。
- [ ] 1.2 将分组 source 和组内 target 按 ID-first/name selector 规则收敛，拒绝解析后重复 source、未选择 source、组内重复或未命中 summary target、summary/clear 冲突；把合法组转换成每个 successor 的规范完整 override。
- [ ] 1.3 扩展 `DecisionSuccessor` 与 lifecycle request/transaction preparation，使每个 successor 使用自身 override 或兼容的事务级默认值；先计算全部 final relations，再统一执行现有前序恢复、策略、闭包、最终图、历史门禁、锁、可恢复写入、索引和读回流程。
- [ ] 1.4 更新 `evolve --help`、`skills/decision-records/SKILL.md` 与固定关系规则，先表达完整事件和逐 successor 最终集合，再对照 candidate source、统一 override、分组 override 与清空；保留精确无效组合和恢复边界但消除重复、负向先行与 v53 workaround 表述。
- [ ] 1.5 更新 `docs/skills/decision-records.md` 的常规维护与演进说明，用当前检查/诊断/恢复路径替换一次性 alignment definition 升级步骤；复核 `maintenance-recovery.md`，仅在新术语、链接或异常入口确有影响时修改。
- [ ] 1.6 新增自包含 Decision Records 后继候选，记录完整事务参与者与逐 successor 完整载荷的正交边界，以“修订”关系指向 `replace-decision-relations-as-complete-sets` 并填写关系 summary；使用正式 lifecycle/evolve 命令建立、归档前序并同步严格索引。
- [ ] 1.7 递增实施基线上的 Decision Records skill metadata version，运行 `bun run sync:decision-records-cli` 同步 bundle、source map 与声明闭包；只有现有生成链不能覆盖新公开类型时才修改 `scripts/build/decision-records.ts`。
- [ ] 1.8 为每个新增或修改的最小原生测试入口维护唯一 `docs/test-evidence/cases/*.md`，用正式入口同步 `test-evidence-index.json`，不把聚合 runner 或临时复现当作长期 Case。

## Verification

- [ ] 2.1 用 CLI 参数测试覆盖：无分组的统一兼容模式；多个 `--relations-for`；组内 relation-summary 位于 relation 前后；正文含 `=`；raw 与解析后重复 source/target；source 未选择；首组前 relation；空组；clear 冲突；统一/分组混用；对应退出码与 stdout/stderr。
- [ ] 2.2 用关系事务测试证明两个已建立拆分 successor 在一次调用中保存同一 predecessor 的不同 summary；未分组 successor 保留来源；遗漏完整 successor、错误 predecessor 或不纯关系仍在零写入状态失败。
- [ ] 2.3 用关系事务测试证明已建立稀疏重划的不同 successor 可分别替换不同 relation sets 和 summaries，并继续满足至少两个前序/后继、全部前序承接、角色互斥、连通分量和完整 successor 集合。
- [ ] 2.4 覆盖 candidate 与 established 混合、`--preflight`、已建立 alignment 确认、未记录历史门禁、discard 组合、同值 no-op 和可处理写入失败恢复，确认分组不会形成逐 source 中间提交或改变既有 lifecycle outcome。
- [ ] 2.5 验证源码 CLI、生成 Node CLI 和机械声明对 `--relations-for`、可选逐 successor override、help、错误输出及成功关系投影一致；运行 `bun run check:decision-records-cli` 确认生成无漂移。
- [ ] 2.6 对更新后的文档执行三项代表性 AI 使用复核：区分完整参与者与不同载荷；为首次 candidate 拆分选择省略 override；为已建立拆分和稀疏重划构造单次分组命令。确认无需本次对话即可恢复范围、优先级和失败边界，且人类阅读没有退化。
- [ ] 2.7 运行 `bun run test:decision-records-cli`、`bun run check:decisions`、`bun run validate-skill -- skills/decision-records`、Test Evidence 同步与检查，并记录每项实际结果。
- [ ] 2.8 运行 `bun run check`，按当前 Gate 范围补充 `bun run check --full`；审查最终 diff 仅覆盖本 proposal 的 owner，没有引入关系 patch、旁路命令、历史摘要强制迁移或无关文档重写。
- [ ] 2.9 仅依据 Change artifacts 和其中引用的稳定 owner 做实施阅读复核：实现者必须能恢复分组语法、完整替换、兼容优先级、事务顺序、长期决策演进、文档整改边界和完成证据，且 design 保持无 Open Questions。
