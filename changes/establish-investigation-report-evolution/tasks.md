# Tasks

Readiness 已由 [`readiness-audit.md`](readiness-audit.md) 和 [`migration-manifest.json`](migration-manifest.json) 闭合；后续从长期决策演进开始，实施报告级模型和一次性迁移，最后分别证明领域行为、共享回归、数据对账与全仓交付。

## Readiness

- [x] 0.1 已读取项目与领域规则，核对 Git、10 个 active Changes 和受影响 owner；没有发现改变本 Plan Outcome 或授权边界的并行工作。
- [x] 0.2 已通过现行严格检查并固定 12 topics、33 reports、5 resources、形成时间、核心章节、状态、链接、索引 entry、source revision 与可重复指纹。
- [x] 0.3 已逐份审阅 33 个目标 Investigation ID、title、question、初始 tags、直接关系和正文映射；ID 集合唯一，无顺序编号，12 份报告显式保持空关系。
- [x] 0.4 已固定 5 个资源的目标 owner、resource ID、全部引用、Git 可见性、普通链接和形成时字节保留边界。
- [x] 0.5 已审阅全部`调查中`与`暂停`状态；只有 Skill 重路由继续由 `task-000068` 协调，其余状态直接退出，两个无协调价值的终态 task 进入精确清理范围。
- [x] 0.6 已恢复 7 条直接相关 active 决策并确定 6 组闭合动作：5 个`修订`、1 个双后继`拆分`，另 1 条决策保持。
- [x] 0.7 已用 CodeGraph 确定 parser、索引、事务、CLI、生成与测试调用面，以及 shared relation graph 的 4 项最小 API；Decision 生命周期和领域关系形状留在原 owner。
- [x] 0.8 已盘点 Investigation Report 的 58 个现有最小入口，确定 55 个 Case ID 保留、3 个替代和 9 个新增入口；本 Change 不依赖 Test Evidence 标签化或跨资源 ID。
- [x] 0.9 已固定迁移、Task Graph、关系事务与生成写入目标、revision 漂移门禁和 Git 恢复来源；迁移辅助逻辑不进入仓库或分发表面。

## Implementation

- [ ] 1.1 按 Readiness 方案建立并审核 Investigation Report 长期后继决策，使用 Decision Records 合法关系与生命周期事务演进被目标实质改变的 active 决策；实现完成前保持对齐状态真实，并在每次事务后运行严格检查。
- [ ] 1.2 在 `tools/shared/` 抽取泛型关系边索引、正反向 trace、缺失目标、自环、重复与环检测原语，并让 Decision Records 改用共享实现；保留决策专属 archived 目标、关系类型、归并/拆分闭合和 evolve 事务。
- [ ] 1.3 重构 Investigation Report 的路径、类型和 Markdown parser：建立根目录直属 Investigation ID、固定 frontmatter、非空有序 tags、六种关系、单报告固定 H2 核心和可选资源声明，严格拒绝旧 topic/category/status/H3 容器与混合格式。
- [ ] 1.4 实现调查关系图投影与领域校验，覆盖直接前序存在性、时间方向、普通单前序、纯归并、多后继拆分、反向边和全图无环；诊断同时定位 source ID、target ID、relation type 与可行动原因。
- [ ] 1.5 将调查索引提升到新的不兼容 definition：entry 与 source revision 以 Investigation ID 为键，state 投影 title、formedAt、question、tags、relations 和 resourceIds，不保存可由 ID 计算的 sourcePath；metadata 保持为空，keys 改为 tag、formed-at、relation-type 与 text。
- [ ] 1.6 更新 check、sync-index 与 stage-index：全量检查证明完整关系图、资源集合和索引新鲜度，scoped check 明确局部证明边界，sync 从新报告源重建索引，stage 按 Investigation ID 选择 entry 且继续不自动暂存报告或资源。
- [ ] 1.7 实现 `set-relations` 多 source 完整替换及底层事务：按顺序解析每个 `--source` 下的重复 `--relation <type=target>` 或显式 `--clear-relations`，一次预演全部替换后的完整图，保护所有目标 source 和 index revision，组合写入所选 Markdown 与工作区索引，在失败时恢复完整旧组合或返回明确恢复诊断，并保证不修改 Git pending 或其他报告字段。
- [ ] 1.8 更新 query、CLI options/output 与公共入口：删除 category/status/latest/topic/reportIndex 参数和输出，增加重复 tag AND、形成时间范围、关系类型、`show`、双向 `trace` 与 `set-relations`，并让帮助、错误、退出码和 JSON 输出拥有明确语义。
- [ ] 1.9 将资源 ID 与 owner 校验迁移到 Investigation ID stem，更新 `./_resources/` 链接解析、报告级 resourceIds 投影、共享引用、可见性和 warning 边界；保持资源字节退出索引 revision 的现有责任。
- [ ] 1.10 按已审阅清单把全部旧 H3 报告迁移为独立根目录 Markdown，迁移资源 owner 和当前维护链接，删除旧 category 目录与主题字段，并从新权威源重建索引；迁移写入前后保存可核对计数与指纹结果。
- [ ] 1.11 更新 `skills/investigation-report/SKILL.md`、固定契约、索引 Schema、人类介绍、agents metadata、项目导航、AGENTS owner 路径和直接维护引用，只说明新模型、关系命令与无归档边界，不保留迁移说明。
- [ ] 1.12 同步 Investigation Report 和受影响 shared/Decision Records 的构建适配、分发脚本、source map、声明与生成 Schema，提升所有实际改变分发内容的 skill 独立版本，并核对 updater hash 与包输入。
- [ ] 1.13 按原生测试入口实际变化创建、更新、重命名或删除 Test Evidence case，维护 topic 账本和统一派生索引；每个 case 只对应一个可独立选择和报告的最小入口。

## Verification

- [ ] 2.1 用 parser、路径和 Schema 测试证明合法 Investigation ID、frontmatter 字段顺序、formedAt、非空有序 tags、六种关系、固定 H2 核心和可选资源成立，并严格拒绝旧 topic、category、status、H3 多报告及未知混合格式。
- [ ] 2.2 用 shared 与 Decision Records 回归测试证明抽取后的边索引、trace 与环检测结果保持，Decision Records 的 archived 目标、关系形状、生命周期事务、查询和恢复没有改变。
- [ ] 2.3 用 Investigation Report 图测试覆盖独立、补充、复查、修正、推翻、纯归并、完整拆分、缺失目标、重复、自环、逆时间、非法形状、直接/间接前序和多分支环，并人工校准代表性关系语义。
- [ ] 2.4 用索引、query、show、trace 与 stage 测试证明 Investigation ID 直接定位、无 sourcePath 投影、tag AND、形成时间、关系类型、text、正反向图、增加/修改/删除/改名选择、旧 definition 拒绝和确定性序列化成立。
- [ ] 2.5 用事务与 CLI 测试证明 `set-relations` 的单 source 与多 source 完整替换、显式清空、同 source 重复、非法分组、原子建立多后继拆分、图预演、source/index 漂移、写入故障、完整恢复、幂等结果和 pending 隔离；成功后无需另行 sync 即得到同源 Markdown 与工作区索引。
- [ ] 2.6 用资源测试证明报告级 owner、共享引用、链接原文、精确路径、普通文件、版本控制可见性、被引用 error、未引用 warning 和资源字节不影响索引 revision；旧 topic owner 和 reportIndex 不再被接受。
- [ ] 2.7 以迁移清单逐项对账新旧集合，证明报告总数、形成时间、四项核心、附加章节、资源引用和必要链接没有丢失或错误重绑；逐条审阅 tags 与关系，确认没有从旧顺序补造边、没有序号式占位 ID，并核对状态事项已退出或交接。
- [ ] 2.8 运行 Investigation Report 的目标 `check`、`list`、`show`、`trace`、`set-relations` 和 `stage-index` 代表性真实工作区操作；可逆写入验证使用 fixture 或临时仓库，不在权威集合制造测试副作用。
- [ ] 2.9 运行 Decision Records 严格检查与相关 list/show/trace，确认新后继、归档前序、关系图和 alignment 符合当前事实，没有冲突 active 决策继续描述 topic 级模型。
- [ ] 2.10 运行受影响 Test Evidence 同步与严格检查，证明全部当前最小原生入口有且只有一个权威 case、删除入口退出账本、重命名关系可追踪且派生索引新鲜。
- [ ] 2.11 运行 Investigation Report 与受影响 shared/Decision Records 的源码测试、生成一致性检查、skill validator 和打包输入审计，确认脚本、声明、source map、Schema、帮助文本和 skill version 同步。
- [ ] 2.12 用链接检查、`rg`、生成 diff 和包内容审计确认旧 topic/category/status/latest/reportCount/reportTitles/reportIndex、路径关系目标、兼容 reader、双写、迁移命令和辅助升级脚本未残留于当前 owner 或分发物；形成时资源与 archived Change 命中按其 owner 分类。
- [ ] 2.13 运行 `bun run typecheck`、`bun run validate`、相关专项检查和 `bun run check --full`，记录实际结果；并行无关失败保留精确诊断，但不降低目标门禁。
- [ ] 2.14 逐项复核 proposal 成功标准、稳定 owner、长期决策、迁移对账、关系事务恢复和残余风险；只有全部任务与证据完成且获得归档授权后才归档 Change。
