# Tasks

Readiness 证据由 [`readiness-audit.md`](readiness-audit.md) 与 [`migration-manifest.json`](migration-manifest.json) 承接；以下 checkbox 记录已完成的实施和验证结果及其可核对证据。

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

- [x] 1.1 已通过 Decision Records 事务建立 6 组报告级后继并归档 6 条被替代前序；7 条相关 active 决策均已与当前实现对齐。证据：逐次 `mark-aligned` 后严格检查通过，后继 list/trace 指向 archived 前序。
- [x] 1.2 已在 `tools/shared/` 提供泛型关系边索引、双向 trace 与结构问题原语，Decision Records 已消费该实现且保留 archived target、关系类型、归并/拆分闭合和 evolve 事务。证据：8 个 shared relation graph 原生测试、Decision Records 严格检查与 Investigation Report 回归均通过。
- [x] 1.3 已将 Investigation Report parser、路径和类型切换为根目录直属 Investigation ID、固定 frontmatter、非空有序 tags、六种关系、单报告固定 H2 核心与可选资源；旧 topic/category/status/H3 容器和混合格式被拒绝。证据：76/76 Investigation Report 原生测试通过。
- [x] 1.4 已实现报告关系图投影与领域校验，覆盖直接前序、时间方向、普通单前序、纯归并、多后继拆分、反向边和无环性，并提供可定位诊断。证据：关系图、trace 与非法形状测试通过。
- [x] 1.5 已将索引定义切换为按 Investigation ID 投影 title、formedAt、question、tags、relations、resourceIds 和严格空 metadata；不再投影 sourcePath。证据：当前索引由报告 Markdown 重建，`check:investigations` 确认 33/33 报告和索引当前。
- [x] 1.6 已更新 check、sync-index 与 stage-index 的报告级语义、全量/局部证明边界和显式暂存责任。证据：CLI、索引、staging 与 scoped-validation 测试通过，当前全量检查通过。
- [x] 1.7 已实现 `set-relations` 的多 source 完整替换、图预演、revision 门禁、原子发布与恢复，并保持 Git pending 和无关报告字段不变。证据：事务、漂移、故障恢复、幂等和 pending 隔离测试通过。
- [x] 1.8 已更新 query、CLI options/output 和公共入口：移除旧 topic 查询表面，提供 tag AND、形成时间、关系类型、show、双向 trace 与 set-relations。证据：CLI help、query、show、trace 和旧参数拒绝测试通过。
- [x] 1.9 已将资源 ID 与 owner 校验切换为 Investigation ID stem，并保持报告级 resourceIds、共享引用、可见性、warning/error 边界和资源字节退出索引 revision。证据：资源 owner、链接、文件身份与 revision 测试通过。
- [x] 1.10 已按迁移清单完成 33 份独立报告、5 个资源 owner、当前维护链接与派生索引迁移，并删除旧主题目录与字段。证据：逐项清单对账、33/33 全量检查和当前索引通过。
- [x] 1.11 已同步 Investigation Report skill、固定契约、Schema、人类介绍、agents metadata、项目导航、AGENTS owner 路径和直接维护引用；长期 owner 只描述新模型、关系命令与无归档边界。证据：skill 版本为 20，`validate-skill` 与仓库链接验证通过。
- [x] 1.12 已同步 Investigation Report、shared 与 Decision Records 的构建适配、分发脚本、source map、声明和 Schema，并提升实际分发变更的 skill 版本。证据：生成一致性、hash/pack 输入审计和全仓门禁通过。
- [x] 1.13 已按实际最小原生入口更新 Test Evidence case、topic 账本和派生索引。证据：账本严格检查确认 604 个当前 case，受影响入口一对一且索引新鲜。

## Verification

- [x] 2.1 parser、路径和 Schema 测试已证明 Investigation ID、frontmatter 顺序、formedAt、非空有序 tags、六种关系、固定 H2 和可选资源的正反例；旧 topic/category/status/H3/混合格式均被拒绝。证据：76/76 Investigation Report 原生测试通过。
- [x] 2.2 shared 与 Decision Records 回归已确认边索引、trace、环检测、archived target、关系形状、生命周期事务、查询和恢复保持正确。证据：相关源码测试与严格 Decision Records 检查通过。
- [x] 2.3 Investigation Report 图测试已覆盖独立、六类关系、纯归并、完整拆分、缺失/重复/self/逆时间/非法形状、直接与间接前序及多分支环；代表性关系语义已按报告正文校准。证据：关系图测试和当前关系图全量检查通过。
- [x] 2.4 索引、query、show、trace 与 stage 测试已证明 ID 直接定位、无 sourcePath 投影、tag AND、形成时间、关系类型、文本、双向图、选中增加/修改/删除/改名、旧 definition 拒绝和确定性序列化。证据：相关 76/76 原生测试通过。
- [x] 2.5 事务与 CLI 测试已证明 set-relations 的单/多 source 替换、显式清空、非法分组、拆分原子建立、预演、漂移、故障恢复、幂等和 pending 隔离；成功时 Markdown 与索引同源。证据：关系事务测试通过。
- [x] 2.6 资源测试已证明报告级 owner、共享引用、链接原文、精确路径、普通文件、版本控制可见性、引用 error、未引用 warning 和资源字节 revision 边界；旧 topic owner 与 reportIndex 不被接受。证据：资源测试通过。
- [x] 2.7 迁移清单已逐项对账报告数量、形成时间、四项核心、附加章节、资源引用和必要链接；tags 与关系未从旧顺序补造，状态事项已退出或交接。证据：33/33 报告全量检查和迁移清单对账通过。
- [x] 2.8 已在权威工作区运行生成 CLI 的 check、list、show 与 trace。`set-relations` 和 `stage-index` 的可逆写入均在独立 `/tmp` Git fixture 验证；后者确认 cached 只包含索引，Markdown 不被暂存，未在权威集合制造测试副作用。证据：CLI 代表性操作与事务测试通过。
- [x] 2.9 Decision Records 严格检查及相关 list/show/trace 已确认报告级后继、archived 前序、关系图和 alignment 均符合当前事实，没有 topic 级模型的冲突 active 决策。证据：严格检查为 297 条决策、117 active、113 aligned、4 unaligned、180 archived、0 candidates。
- [x] 2.10 受影响 Test Evidence 已同步并通过严格检查；每个当前最小原生入口恰有一个权威 case，删除入口已退出账本，重命名关系可追踪。证据：604-case 账本与派生索引当前。
- [x] 2.11 Investigation Report、shared 与 Decision Records 的源码测试、生成一致性、skill validator 和打包输入审计已完成。证据：76/76 Investigation Report 测试、生成检查、`validate-skill` 和全仓门禁通过。
- [x] 2.12 链接检查、`rg`、生成 diff 和包内容审计已确认旧索引 keys/state 的 `category`、`status`、`latest-report-at`、`reportCount`、`reportTitles` 与 `reportIndex` 已退出；集合级同步结果的 `reportCount` 不属于旧 topic 投影。旧路径关系目标、兼容 reader、双写、迁移命令和辅助升级脚本均未残留于当前 owner 或分发物；形成时资源与 archived Change 命中已按其 owner 分类。
- [x] 2.13 已运行 `bun run typecheck`、`bun run validate`、相关专项检查和全仓 quick/full gate，全部通过；没有以并行无关失败降低目标门禁。证据：全仓门禁与打包输入审计通过。
- [x] 2.14 已逐项复核 proposal 成功标准、稳定 owner、长期决策、迁移对账、关系事务恢复和残余风险；当前任务已取得明确归档授权，并通过固定 `archive` 入口保留完整历史材料。
