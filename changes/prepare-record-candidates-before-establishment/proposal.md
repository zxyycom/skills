# Proposal

本 Change 让决策记录和调查报告都能先由 CLI 建立元数据完整、正文待补的候选，分别获得正文 readiness 与可执行维度的事务预检，再通过独立显式命令完成最终建立。

## Why

当前 `decision-records` 要求维护者手写完整 candidate frontmatter 和正文后才能进入既有审核、建立事务；`investigation-report` 则把根目录中的每份报告直接视为正式成员，新报告只能在手写完成后依赖集合级 `sync-index` 进入索引。两条路径都把机械元数据、关系语法、索引影响和 Git 历史反馈推迟到内容已经写完之后，增加了起草成本，也让错误较晚暴露。

创建阶段需要提前发现关系目标、最终图、索引投影和 Git 历史门禁，但事务预检不能替代真正建立时的再次校验和显式确认。调查报告还需要一个正常的按 ID 建立入口，使 `sync-index` 回到全量恢复和批量接纳既有正式来源变化的职责，而不是继续充当创建新报告的唯一发布动作。

## Outcome

- `decision-records new` 根据显式参数写入元数据完整、正文固定章节待补的 candidate scaffold，并分别报告预期的正文未完成状态，以及当时可以检查的关系、索引与 Git 历史预检结果。
- 决策 candidate scaffold 始终排除于正式索引和正式关系图；只有正文完整并通过全部候选校验后才成为 activation-ready，随后仍由显式 `activate` 或 `evolve` 重新校验、重新执行 Git 历史门禁并建立。
- `investigation-report new` 在正式报告集合外写入元数据完整的报告候选；候选工作区不是新的正式报告生命周期，也不改变根目录报告全部属于正式集合的语义。
- `investigation-report candidates` 与 `show-candidate <id>` 从候选工作区发现候选、正文 readiness 和发布预检诊断，不要求候选已经进入正式索引。
- `investigation-report publish <id...>` 在一个事务中校验并建立显式选择的候选批次，只更新这些新报告引起的正式集合和索引结果；未选择候选不被吸收。
- `investigation-report sync-index` 保留为既有正式报告集合的全量重建、恢复及显式接纳手工来源变化入口，不再是创建新报告的正常必经路径。
- 创建时的事务预检不保存 receipt、不继承确认，也不降低最终命令的权限、关系、Git、漂移或事务检查。

## Scope

### Intended Change

- 为两套 CLI 增加基于显式元数据参数的 `new`，写入不覆盖已有身份的规范候选脚手架，并分别报告创建结果、正文 readiness 和可预演的最终事务维度。
- 扩展决策候选模型，使合法 candidate scaffold 可以保留空的固定正文节；通过独立的 activation-ready 判定保持完整候选审核和最终建立门禁。
- 为调查报告增加集合外候选目录和批量 `publish` 事务；事务从当前有效正式索引与选中候选构造最终集合，校验完整关系图、资源和索引后再发布报告与索引。
- 保持实际 `activate`、`evolve` 和 `publish` 为唯一建立动作；创建时的事务预检与最终动作不共享确认状态。

### Resulting Impacts

- 决策候选的扫描、查询、展示、丢弃、校验计数和恢复说明需要区分 scaffold 与 activation-ready，既有“candidate 必须完整”的长期决策需要由后继决策修订。
- 调查报告目录成员、候选发现/展示/readiness、资源引用、关系闭包、批量发布、回滚和空集合首次发布需要新契约；既有“没有报告生命周期”的决策需要澄清候选工作区不属于正式生命周期，报告级索引决策需要承接选择性建立入口。
- `publish` 必须要求既有正式报告与持久索引构成可用基线；发现既有正式来源漂移、索引缺失或不兼容时，不猜测混合基线，而是要求先显式恢复或收敛正式集合。
- 两套 skill 文档、人类说明、维护源码、公开类型、生成 CLI/声明/Schema、版本、测试与测试证据账本需要同步。
- 新命令的 Git、权限、锁和事务失败必须消费 `make-maintenance-diagnostics-actionable` Change 形成的诊断契约；若共享诊断尚未就绪，本 Change 不复制临时错误分类器。

## Success Criteria

- 两个 `new` 命令都能从规范且不重复的命令行参数生成字段顺序稳定的 frontmatter 和固定空正文结构。参数、目标身份、候选布局或 exclusive create 失败时不产生目标文件；索引、关系图或 Git 预检不可用时保留已经创建的 scaffold，但不改变正式集合或索引。
- 决策 scaffold 可以被发现、展示、继续编辑和显式丢弃，但不会进入正式索引、正式关系图或被 `activate/evolve` 当作完整候选；正文完整后无需重建身份即可成为 activation-ready。
- 决策创建预检在不伪造正文内容的前提下报告可由元数据确定的关系形状、目标解析、预计最终图、索引影响和未进入 Git `HEAD` 的前序；正文 readiness 独立显示为未完成。之后的真实建立仍独立读取当前状态，并在相同条件仍成立时再次暂停，且只接受本次显式命令参数。
- 调查候选不会改变正式 `list`、`show`、`trace` 或正式索引新鲜度。一次 `publish` 可以原子建立一个候选或满足归并、拆分闭包的多个候选，并保持未选择候选不变。
- 调查发布前失败不改变候选、正式报告或索引；恢复不完整时明确报告未知/部分状态。发布成功后正式报告集合、完整关系图、资源校验和索引一致。
- `sync-index` 的帮助与契约明确其全量恢复职责；已有正式来源的手工变化不会被普通候选发布静默吸收。
- 对应 Decision Records 形成并建立，生成物、skill 版本和一入口一 case 的测试证据同步，定向测试及 `bun run check` 通过。

## Affected Owners

- 决策行为与规则：`skills/decision-records/SKILL.md`、`skills/decision-records/references/decision-record-rules.md`、`skills/decision-records/references/maintenance-recovery.md`、`docs/skills/decision-records.md`
- 调查行为与规则：`skills/investigation-report/SKILL.md`、`skills/investigation-report/references/investigation-report-contract.md`、`docs/skills/investigation-report.md`
- 领域实现与生成边界：`tools/decision-records/`、`tools/investigation-report/`、`scripts/build/decision-records.ts`、`scripts/build/investigation-report.ts`、两套 skill 的 `scripts/` 与生成引用
- 长期判断与索引：`docs/decisions/`、`docs/decisions/decision-index.json`、`docs/investigations/investigation-index.json`
- 验证证据：`tools/decision-records/tests/`、`tools/investigation-report/tests/`、`docs/test-evidence/decision-records/`、`docs/test-evidence/investigation-report/`、`docs/test-evidence/test-evidence-index.json`
