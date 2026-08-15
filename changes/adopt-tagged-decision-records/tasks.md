# Tasks

本清单按“复核最新事实与决策谱系 → 实现仅支持新模型的代码契约 → 手工切换权威来源 → 同步 owner、生成物与证据 → 完整验收”的顺序推进；完成出口是 Decision Records 只使用稳定 ID、非空 tags 和统一定位索引，且仓库中不残留旧 domain 能力或升级辅助实现。

## Readiness

- [x] 0.1 已读取仓库模型、导航、工具链、编码规范、Change Plan 固定契约、Decision Records Skill 及领域规则，并确认 proposal、design、任务范围和稳定 owner 使用同一 Decision Records 标签化目标。
- [x] 0.2 已确认目标契约：每条记录的 tags 必须非空；重复 `--tag` 使用 AND；active/candidate 直属决策根且 archived 直属 `archive/`；更新不兼容旧模型并完全手工进行，不提供公开或临时升级脚本。
- [x] 0.3 已用当前严格检查确认 20 个 domains、274 条已建立记录、113 条 active、161 条 archived、0 条 candidate；274 个 basename 均符合目标语法且在 Decision Records 集合内唯一，因此既有记录可以保留 basename 映射为目标 ID。
- [x] 0.4 已用 CodeGraph 和路径盘点定位类型、frontmatter、路径、扫描、索引、查询、生命周期、关系、history baseline、stage、CLI/API、生成与恢复边界；当前至少 31 个源码、生成物、说明或测试文件直接含 domain 能力，Decision Records 有 17 个原生测试文件和 89 个现有 Test Evidence case。
- [x] 0.5 已审阅当前长期决策：身份/分类/索引/候选查询与 stable-ID stage 需要最小自包含后继集合；`upgrade-decision-domains-after-real-pressure` 需要退出；`use-physical-archive-boundary-for-decision-search` 保持为待落实方向；既有关系、持久查询、候选容错和 pending 隔离中未被目标改变的不变量继续保留。
- [x] 0.6 已核对当前工作区改动均可归因于本 Change 文档、直接引用修正和派生调查索引同步；相邻 Investigation Report、Test Evidence 标签化 Change 不是本 Plan 的依赖或共享契约。其他 active Plan 可能新增 Decision Records 或测试证据，实施写入必须串行复核，不吸收其领域功能。
- [x] 0.7 已建立 [`readiness-audit.md`](readiness-audit.md) 和按需读取的 [`readiness-inventory.json`](readiness-inventory.json)：逐项记录 274 条既有记录的旧 ID/路径、目标 ID/路径、status、alignment、初始 tag、目标关系与来源指纹，另列两个计划后继、20 条 domain description 的稳定 owner 处置，并区分当前链接、结构化语义引用、形成时资源和归档历史。
- [x] 0.8 已在 Plan 基线重新运行 Decision Records 严格检查、CodeGraph 影响检查、active Change 查询和 Git 状态审阅；确认 274 条记录、20 个 domains、0 个 candidate、无 basename 冲突，skill 版本 25、索引 definition 5、生成入口和并行所有权均与设计盘点一致。实施时的新鲜度复核由任务 1.1 继续门禁。
- [x] 0.9 已在 [`readiness-audit.md`](readiness-audit.md) 预览两个最小后继、六个直接前序及 `归并`/`修订`/`替代` 关系，确认全部前序存在于基线 Git tree、混合单后继关系集合满足当前机械策略；持久查询、候选容错和 stage 隔离的未改变含义明确保留，物理归档方向继续 active + unaligned。本次未写入任何长期决策。

## Implementation

- [ ] 1.1 实施开始时重新运行严格检查、CodeGraph 影响检查、active Change 查询、Git 状态与 [`readiness-inventory.json`](readiness-inventory.json) 漂移核对；若数量、ID、指纹、版本、生成入口或写入所有权变化，先更新审计附件和 Plan。事实未漂移后，使用当前 Decision Records 生命周期入口建立 `use-stable-decision-ids-tags-and-location-index.md` 与 `stage-selected-decisions-by-stable-id.md` 两个自包含后继，按 Readiness 关系预览让旧 domain 身份、查询、升级和 stage 基线合法退出，并让两个新方向保持 unaligned 直到完整事实落地。
- [ ] 1.2 在 `tools/decision-records/src/types.ts`、`decision-path.ts`、`decision-metadata.ts` 及直接 owner 中建立唯一 `Decision ID`、`sourcePath` 与非空 tags 契约；更新 frontmatter 解析、字段顺序、序列化和公共类型，删除 domain catalog 类型、路径身份解析和 domain 派生字段，并让旧 frontmatter、旧路径 ID 与混合模型严格失败。
- [ ] 1.3 重构来源发现、记录扫描、状态快照、来源 revision 和索引定义：只发现根目录 candidate/active 与 `archive/` archived Markdown，拒绝状态—位置不一致和跨位置重复 ID；把 definition version 提升到 6、metadata 固定为空对象、entry/revision 以 ID 为键、state 保存 `sourcePath` 与 tags，并用 tag/status/alignment keys 构造统一索引。
- [ ] 1.4 更新查询 context、service、CLI args/output 和手写 API 声明源：删除 `domains` 与 `--domain`，让 record 参数只接收 Decision ID，增加可重复 `--tag` 的 AND 过滤，并让 list/show/trace/candidates 返回 ID、`sourcePath` 和 tags；保留默认 active、显式 archived/all、候选源码容错和 show 单正文读取边界。
- [ ] 1.5 更新 lifecycle、relation graph、history baseline 与文件事务：关系目标只使用 Decision ID；archive/重新激活在同一可恢复事务中移动源、改变 status 并重建索引；预检和回滚同时保护旧/新位置、Markdown 与索引，Git `HEAD` 历史判断通过 ID 和实际 revision 位置解析，不把位置重新当成身份。
- [ ] 1.6 更新 `stageDecisionRecords` 及版本控制组合：按 Decision ID 比较 revision 与 filesystem，同 ID 不同 `sourcePath` 形成一次移动，basename 改名要求旧/新 ID 同时选择；未选择成员使用 revision，新集合从 filesystem 引导，目标 Markdown 重建完整统一索引，且无效选择、漂移或 pending 冲突在写入前失败。
- [ ] 1.7 按 [`readiness-inventory.json`](readiness-inventory.json) 逐项修改权威 Decision Markdown：为每条记录写入至少一个初始 tag，将 candidate/active 移至根目录、archived 移至 `archive/`，把全部 `relations[].target` 改为 Decision ID；使用目标 `sync-index --write` 从合法来源重建索引，不直接编辑索引，也不编写批量迁移、临时转换或兼容脚本。由于 revision 仍是旧模型，本次整体切换通过普通版本控制文件选择进入 pending，不调用目标 stage；新模型提交后才恢复专用选择性暂存。
- [ ] 1.8 按 [`readiness-audit.md`](readiness-audit.md) 已确认的 owner 处置删除 `decision-domains.json`：20 条 description 均已有稳定 owner，无需迁写；不复制成 tag catalog、迁移 manifest 或第二事实源。
- [ ] 1.9 按各 owner 手工更新当前维护链接、路径示例和结构化引用，包括 active Change、项目导航、协作说明与当前调查主题；不重写 archived Change、调查随附资源或其他形成时字节，纯历史文本保持可辨识的形成时语境，并同步任何受影响的派生调查索引。
- [ ] 1.10 重写 `skills/decision-records/SKILL.md`、`decision-record-rules.md`、`maintenance-recovery.md` 与 `docs/skills/decision-records.md`，只说明目标 ID/tags/layout/query/lifecycle/stage 契约；同步 `AGENTS.md`、`docs/navigation.md` 和必要项目说明，并提升 Decision Records skill 独立版本。
- [ ] 1.11 更新 `scripts/build/decision-records.ts` 的声明/Schema输入与 `tools/decision-records/api/decision-records.d.mts`，通过 `bun run sync:decision-records-cli` 生成 CLI bundle、source map、声明和 definition-6 JSON Schema；只修改源码或声明 owner，不直接实现生成产物中的行为。
- [ ] 1.12 重组 Decision Records fixtures 与最小原生测试入口，删除只证明 domain catalog/领域路径的旧入口，保留仍成立的生命周期、关系、查询、恢复与 pending 隔离证据，并新增 tags、稳定 ID、统一布局、位置事务和 ID-based stage 的成功及失败覆盖。
- [ ] 1.13 按 `test-evidence-review` 契约为每个新增、修改、重命名或删除的最小原生测试入口逐项同步 `docs/test-evidence/decision-records/` case，并通过统一命令重建派生 Test Evidence 索引；不把聚合 runner、fixture 或内部断言记录为独立 Test。
- [ ] 1.14 在目标实现、仓库手工切换、owner 和测试全部通过后，使用 Decision Records 生命周期命令把核心后继、stage 后继及 `use-physical-archive-boundary-for-decision-search` 按实际事实标记 aligned，并同步索引；未完整落地的判断保持 unaligned，不以 Plan 任务状态代替对齐证据。

## Verification

- [ ] 2.1 用最小原生 parser/Schema 测试证明 tags 必填非空、token 语法、去重与确定性排序成立，Decision ID 只取合法 basename，旧 domain frontmatter/路径/metadata 和未知字段严格失败，规范 Markdown 能 round trip。
- [ ] 2.2 用扫描、快照和索引测试证明 root 与 `archive/` 的成员边界、status—位置一致性、全集合 ID 唯一、definition 6、严格空 metadata、ID-keyed source revision、`sourcePath` 指纹和 tag/status/alignment keys 均确定且可重建。
- [ ] 2.3 用查询与 CLI 测试证明默认 active、显式 archived/all、单 tag 与重复 tag AND、空结果、ID/sourcePath/tags 输出、候选容错和 show 正文读取成立；`domains`、`--domain`、路径 ID、OR/NOT 与旧定义均明确拒绝或不存在。
- [ ] 2.4 用 lifecycle、关系、Git-history 和 transaction-recovery 测试证明 archive/重新激活保持 ID 与正文语义、移动位置并同步 status/index，关系按 ID 解析 active/archived 前序；并发源或索引漂移在写前拒绝，任一步失败可恢复旧/新位置、Markdown 和索引组合。
- [ ] 2.5 用 stage 测试证明同 ID 跨位置移动只需选择一次、basename 改名必须选择旧/新 ID、增加/修改/删除与首次集合仍可表达，未选择 filesystem 变化保持隔离，完整 pending 索引与 Markdown 同源，revision/pending 漂移及旧 domain 基线无写入失败。
- [ ] 2.6 以 [`readiness-inventory.json`](readiness-inventory.json)、其映射摘要和 Git diff 人工核对 274 条既有记录一一映射，除获批身份改名外 basename 不变，title/purpose/background/decision/body、status、alignment、createdAt 与关系图语义保持；新增后继另行计数，20 条描述都有明确去向且没有混合新旧模型。
- [ ] 2.7 运行仓库链接检查并逐类复核引用：当前维护链接全部指向新位置，结构化 Decision Records 引用全部使用 ID，形成时资源与 archived Change 未被重写，调查主题的链接修正及派生索引符合 Investigation Report owner，仓库外旧路径不被伪装为兼容。
- [ ] 2.8 运行 `bun run test:decision-records-cli`、`bun run check:decision-records-cli` 与 `bun run validate-skill -- skills/decision-records`，确认源码、CLI bundle、source map、声明、definition-6 Schema、skill version 和帮助文本一致。
- [ ] 2.9 运行 `bun run decision-records -- check --root .`，并用 list/show/trace/candidates、tag AND、archive/重新激活和 stage 的代表性真实工作区操作核对新模型；涉及可逆生命周期验证时使用专用 fixture 或临时仓库，不在权威集合制造测试副作用。
- [ ] 2.10 运行受影响的 Test Evidence 同步与严格检查，确认原生入口与 case 一一对应、删除项退出账本、重命名关系可追踪且派生索引新鲜；同时运行 Investigation Report 检查确认链接修正后的主题与索引一致。
- [ ] 2.11 以 `rg`、生成 diff 和包内容审计确认 `decision-domains.json`、domain catalog/parser、`domains`、`--domain`、旧 index metadata、旧路径关系目标、兼容 reader、双写分支、迁移命令和任何辅助升级脚本均未残留在当前源码、稳定 owner 或分发物中；历史快照命中需明确归类而不是机械改写。
- [ ] 2.12 运行 `bun run typecheck`、`bun run validate` 与 `bun run check --full`，记录每项实际结果；若并行工作导致无关失败，保留精确诊断并继续证明本 Change 的目标入口，不降低最终完整门禁。
- [ ] 2.13 逐项复核 proposal 的成功标准、长期后继关系与 alignment、生成物、skill 版本、当前链接和手工更新清单；仅向未参与设计的实施审阅者提供 proposal、design、tasks、Readiness 审计及其按需清单和稳定 owner，确认其能恢复目标模型、手工边界、任务顺序和验收证据，无需本次对话补充判断后再申请归档。
