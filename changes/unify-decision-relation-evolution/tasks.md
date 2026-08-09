# Tasks

Readiness 审计先固定长期 owner、兼容性边界和测试证据范围；后续任务按协议、实现、分发与证据的依赖顺序完成统一关系演进。

## Readiness

- [x] 0.1 完整读取 proposal、design、两条未对齐决策及 Decision Records 行为 owner，确认统一演进决策拥有事务与拓扑、完整集合决策拥有关系来源与替换，Change artifacts 没有建立第三套长期语义。
- [x] 0.2 检查当前 worktree、中央 task graph 和相关 worktree 的状态与目标路径 diff，确认没有需要合并或避让的并行文件改动。
- [x] 0.3 确认 `Open Questions` 为“无”，兼容性边界是直接删除 `split`、旧 `evolve` 形式和旧 API request，不保留迁移层。
- [x] 0.4 完整读取 `skills/test-evidence-review/SKILL.md` 和受影响 case，并在 design 的 `Test Evidence Audit` 中列出需要更新、新增或移除的最小原生测试入口。

## Implementation

- [ ] 1.1 在公开类型中建立统一 successor 与 relation override 模型，区分未提供覆盖、完整非空覆盖和显式空集合，并移除 split 专属 request 与类型。
- [ ] 1.2 把 CLI 收敛为重复 `evolve --successor <alignment=path>`、完整 `--relation` 覆盖和互斥 `--clear-relations`，保留 `activate --relation` 便捷入口并直接删除 `split` 与旧单后继 `evolve` 语法。
- [ ] 1.3 重构生命周期准备服务，使普通候选激活、带关系激活、多后继 evolve、已建立关系修订和单后继折叠共享同一个先计算最终组合的事务核心。
- [ ] 1.4 实现候选自身关系、CLI 公共覆盖与显式清空的优先级；确保覆盖完整替换且不会与旧关系隐式追加或合并。
- [ ] 1.5 允许所选已建立后继完整替换关系，同时保持正文、status、alignment 与 createdAt；新增活动前序被归档，移除目标继续保持原生命周期。
- [ ] 1.6 将候选关系校验从正式关系图中分离，允许结构合法的候选暂时指向活动已建立前序，并在实际事务中重新验证最终目标生命周期、环路和成员组合。
- [ ] 1.7 建立关系策略校验：规范化后的 successor 不重复、非拆分单后继、至少两个前序的纯归并、闭合一对多拆分，以及当前不支持形状的写入前失败。
- [ ] 1.8 对拆分要求显式 successor 集合等于事务后的完整直接拆分后继集合，覆盖首次建立、加入新后继、包含既有后继、遗漏成员和单后继重新挂接分支。
- [ ] 1.9 将未记录历史预检、`--keep-unrecorded-history` 和单后继 `--collapse-unrecorded` 接入统一模型，并用 `--clear-relations` 表达折叠后的显式空关系集合。
- [ ] 1.10 同步 CLI 输出、错误信息、帮助、公共 API 导出与类型声明，确保命令名、参数和失败语义只暴露新协议。
- [ ] 1.11 更新 `skills/decision-records/SKILL.md`、固定领域契约和 `docs/skills/decision-records.md`，递增 skill 版本并移除独立 split owner、候选空关系和单后继 evolve 的过时描述。
- [ ] 1.12 通过 `bun run sync:decision-records-cli` 重新生成可分发脚本、source map、声明与相关 schema 产物，不手工维护生成文件。
- [ ] 1.13 更新现有 Decision Records 测试，并为关系来源优先级、activate 一轮事务、已建立关系替换、拆分完整集合、破坏性 CLI、折叠和恢复失败增加可独立选择的测试入口。
- [ ] 1.14 按 Test Evidence Review 契约同步受影响 case、topic catalog 与统一派生索引，删除只证明旧 `split` 或旧 evolve 协议且已经失效的证据。

## Verification

- [ ] 2.1 单独运行关系输入和生命周期测试，证明候选关系、CLI 覆盖、显式清空及 `activate --relation` 都在一次事务中产生相同最终组合。
- [ ] 2.2 单独运行拆分策略测试，证明完整多后继集合成功，单后继、遗漏既有后继、混合关系、重复成员和未支持多后继形状均在写入前失败。
- [ ] 2.3 单独运行已建立关系修订测试，证明只改变完整 relations，保留正文与生命周期字段，且移除目标不会被重新激活。
- [ ] 2.4 单独运行未记录历史、折叠和故障注入测试，证明预警、显式选择、回滚与恢复失败边界没有退化。
- [ ] 2.5 运行 `bun run test:decision-records-cli`、`bun run check:decision-records-cli`、`bun run check:decisions` 和测试证据目录严格检查。
- [ ] 2.6 运行 `bun run check`，确认源码类型、生成一致性、skill 结构、决策、测试证据和打包输入全部通过。
- [ ] 2.7 对照 proposal 的全部成功标准进行语义审阅；稳定事实完全落地后标记两条长期决策为 aligned，并保留实际验证结果供 change 归档审计。
