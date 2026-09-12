# Tasks

Readiness 是计划进入实施的审计门禁；通过后从 1.1 开始，源码、文档、生成物与测试同步推进，最后完成 Verification。勾选只代表该项已取得证据，不代表功能已经实现。

## Readiness

- [x] 0.1 核对当前源码、分发 help 与生成一致性，确认统一 override 仍复制到全部后继，缺口是已建立多后继事件的独立关系输入；候选来源模式已有合规入口。
- [x] 0.2 核对当前 Change 列表、完整集合、统一事务、拆分、重划与摘要消费的 active decisions；确认没有重叠关系协议 Change，新增输入继续服从既有 owner。
- [x] 0.3 确认分组语法、完整替换、未分组保留、CLI 模式互斥与内部覆盖优先级；保持统一覆盖兼容，后继决策按修订关系承接完整集合判断，无待决范围或输入问题。
- [x] 0.4 按 AI-ready 消费契约审阅 Change 与直接行为文档；输入主线、精确失败条件、文档整改范围及长期决策交接清楚，正文只保留实施需要的事实、规则、边界和验收。
- [x] 0.5 核对当前 Git 状态、目标 diff 和 Decision Records v58；生成一致性与严格决策检查通过，已将现有 relationReview 和历史基线探测纳入设计。完成语义复核后以 `plan` 刷新 metadata 基线；后续基线或目标文件发生变化时重新核对受影响项。
- [x] 0.6 提交前仅凭三个 artifacts 与引用 owner 恢复输入、兼容优先级、历史门禁、事务与 review、决策演进和验证入口；通过单 Change、链接及仓库检查。若关键行为仍需猜测，阻塞提交，不以勾选或机械检查代替语义审计。

## Implementation

- [x] 1.1 在 CLI 参数边界实现 `--relations-for` 顺序分组，保持现有 option 等号写法；构造组内完整 relation/summary/clear 意图，并实现参数错误诊断。
- [x] 1.2 在集合解析边界收敛 group source 与组内 target，校验所选成员和解析后唯一性，绑定完整摘要，输出每个后继的规范 override。
- [x] 1.3 扩展 `DecisionSuccessor`；按 design 的默认值规则计算各后继最终关系，并统一用于历史基线需求探测与事务准备，复用整体图校验、历史确认、锁、恢复、索引、读回和 relationReview。
- [x] 1.4 同步 `evolve --help`、`skills/decision-records/SKILL.md` 与固定规则，先说明完整成员和不同载荷，再对照来源、统一覆盖、分组与清空；集中保留无效输入及恢复边界。
- [x] 1.5 将 `docs/skills/decision-records.md` 的维护主线改为检查、按诊断恢复和复验；仅在新术语或链接影响恢复路径时调整 `maintenance-recovery.md`。
- [x] 1.6 新建自包含后继候选，以带 summary 的“修订”关系指向 `replace-decision-relations-as-complete-sets`；通过正式 CLI 建立、归档前序、同步索引，并修复前序移动影响的链接，核对完整方向的 alignment。
- [x] 1.7 在实施基线当前 skill version 上递增版本，运行 `bun run sync:decision-records-cli` 同步 bundle、source map 与声明闭包；生成链无法覆盖新增类型时才调整 build adapter。
- [x] 1.8 为新增或修改的每个最小原生测试入口维护唯一 Case，运行 `bun run sync:test-evidence-catalog` 同步索引；聚合 runner 与临时复现不作为 Case。

## Verification

- [x] 2.1 参数与 selector 测试覆盖来源/统一兼容模式、多个分组、summary 前后顺序与正文含 `=`、option 等号写法、原始与解析后重复、未选择 source、首组前关系、空组、clear 冲突、未命中 summary；分别断言退出码和 stdout/stderr。
- [x] 2.2 拆分测试证明一次调用为同一前序保存不同摘要，未分组后继保留原值；遗漏完整后继、错误前序或不纯关系零写入失败。领域测试覆盖局部 override 优先、显式 source 和空 replacement 不回退。
- [x] 2.3 稀疏重划测试证明不同后继的完整关系集合和摘要能够分别替换；至少两个前序/后继、前序全覆盖、角色互斥、连通与完整成员约束继续成立。
- [x] 2.4 事务测试覆盖 candidate/established 混合、preflight、alignment 确认、仅由分组引入前序的历史门禁、discard、同值 no-op 和可处理失败恢复；review 覆盖全部所选后继的完整 before/after、未分组与摘要移除，预检和成功 phase 正确，失败不输出成功 review。
- [x] 2.5 验证源码 CLI、分发 Node CLI、help 与生成声明一致；Node smoke 只证明分发启动、argv、输出和退出边界，不复制源码参数矩阵。运行 `bun run check:decision-records-cli` 检查生成漂移。
- [x] 2.6 仅凭更新后的 skill 与规则完成代表性阅读：候选首次拆分选择来源模式，已建立拆分构造不同摘要的单次分组命令，稀疏重划构造不同完整关系集合；正确解释未分组、摘要移除和完整事务约束，并检查人类阅读未退化。
- [x] 2.7 运行 `bun run test:decision-records-cli`、`bun run check:decisions`、`bun run validate-skill -- skills/decision-records` 和 `bun run check:test-evidence-catalog`，记录各自实际结果。
- [x] 2.8 运行 `bun run check`，并在构造本 Change 的 pending 制品快照后运行 `bun run check --tag release`。审查最终 diff 仅覆盖 proposal 范围，稳定 owner、长期决策与证据均已交接；全部成功标准满足后才进入 Change 完成流程。

## Acceptance Evidence

- 2026-09-12：独立正确性审核及补测复核确认 2.1–2.5 无阻断；分组错误诊断与零写、拆分和稀疏重划、局部覆盖优先级、历史门禁、恢复及完整 relationReview 均有原生测试证据。新增测试沿既有 evolution、CLI 和历史测试容器进入 Gate。
- `bun run test:decision-records-cli`：246 项通过；`bun run test:check`：43 项通过；`bun run check:test-evidence-catalog`：871 个实体通过。对应 Case 与派生索引已同步。
- 最终文档 AI-ready 消费验证通过候选首次拆分、已建立拆分不同摘要和稀疏重划三种场景；未分组保留、摘要移除、完整事务边界及当前依据与历史引用均已核对。
- 最终代码规范优化收敛 CLI 临时分组与领域事务输入边界，移除双形态转换断言，并修复格式；独立复核确认未丢失事务参数或改变分组语义。`typecheck`、`lint`、`format:check`、`check:decision-records-cli`、`check:decisions` 与单 skill 校验通过。
- 后继决策 `260912-support-per-successor-complete-relation-replacements` 已通过正式事务建立为 active/aligned；前序已归档，关系摘要、索引与受影响链接已读回核对。Decision Records v59 的 bundle、source map 与声明已同步。
- 最终 `bun run check`：59 项通过、3 项不适用、0 项失败；本次改动精确暂存后 `bun run check --tag release`：62 项全部通过，包含版本授权与本地打包。此证据不表示已发布远端 release。
