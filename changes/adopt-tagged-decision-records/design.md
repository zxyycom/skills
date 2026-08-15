# Design

本设计只承接 Decision Records 标签化。目标模型使用稳定 Decision ID、记录级非空 tags、当前 `sourcePath` 和生命周期状态拆开现行领域路径的多重责任，并通过一次手工、不兼容的仓库更新切换权威模型。

## Context

- [`docs/repository-model.md`](../../docs/repository-model.md) 要求单个 skill 的行为、产物与验收由对应 skill owner 承接。本 Change 只改造 Decision Records，不建立跨资源公共模型。
- 当前 Decision Records 以 `docs/decisions/<domain-id>/<semantic-slug>.md` 组织。`decision-domains.json` 定义 20 个领域；路径第一段同时参与记录身份、关系目标、查询投影和选择性暂存。
- 当前严格检查通过，共有 274 条已建立记录，其中 113 条 active、161 条 archived，当前没有 candidate。274 条记录的 basename 都符合小写 ASCII kebab-case，并在 Decision Records 集合内唯一，因此能够在不改 basename 的前提下映射为目标 Decision ID；逐项输入和漂移指纹由 [`readiness-audit.md`](readiness-audit.md) 与 [`readiness-inventory.json`](readiness-inventory.json) 承接。
- [`classify-decisions-by-controlled-domain-path`](../../docs/decisions/decision-records/classify-decisions-by-controlled-domain-path.md)、[`project-domains-into-decision-queries`](../../docs/decisions/decision-records/project-domains-into-decision-queries.md)、[`use-persisted-index-for-routine-queries`](../../docs/decisions/decision-records/use-persisted-index-for-routine-queries.md) 与 [`query-candidates-directly-from-source`](../../docs/decisions/decision-records/query-candidates-directly-from-source.md) 是会被目标身份、分类、索引或集合边界实质改变的现行已对齐基线。标签化不能原地改写这些记录，必须通过最小自包含后继集合和合法关系事务演进。
- [`upgrade-decision-domains-after-real-pressure`](../../docs/decisions/decision-records/upgrade-decision-domains-after-real-pressure.md) 是 active + unaligned 的领域演进方向；[`use-physical-archive-boundary-for-decision-search`](../../docs/decisions/decision-records/use-physical-archive-boundary-for-decision-search.md) 是 active + unaligned 的物理归档方向。本 Change 需要明确前者的后继或退出关系，并完整落实后者的身份、定位、事务与搜索边界。
- 当前工具把 `<domain-id>/<semantic-slug>.md` 写入 `relations[].target`、索引 entry ID 与 state path、CLI 参数、查询结果、stage 选择和来源 revision。路径语法影响 parser、扫描、索引、查询、生命周期、关系事务、stage、Schema、生成产物与测试，不能只移动 Markdown 而不迁移行为契约。
- 当前索引使用通用 `schemaVersion: 3` 和 Decision Records `definitionVersion: 5`，以相对路径作为 entry/source-revision ID，以 `metadata.domains` 保存领域表，并提供 `domain`、`status`、`alignment` keys。目标仍复用通用索引外壳，但必须提升领域 definition version 并替换这些 Decision Records 专属字段。
- 当前 `list` 默认筛选 active，只有显式 `--status archived|all` 才返回历史；candidate 由独立源码查询发现。目标模型保留这条消费行为。
- [`stage-selected-decisions`](../../docs/decisions/decision-records/stage-selected-decisions.md) 继续拥有完整索引、显式选择和单次替换 pending 决策范围的不变量。标签化只移除其中对领域表和领域路径的依赖。

## Goals / Non-Goals

目标：

- 让每条决策拥有一个或多个可维护 tags，并通过 tag、status、alignment 与全文条件组合查询。
- 让 Decision ID 不再由领域目录或当前/归档位置决定，并让改名与移动具有不同、可校验的语义。
- 让索引保存 Decision ID 到唯一当前 `sourcePath` 的映射，使关系和维护命令不依赖领域路径。
- 让 archived 记录进入一个可整体排除的物理边界，同时保留生命周期权威、历史查询、关系追踪、重新激活和失败恢复。
- 让领域表、领域路径、旧查询参数和路径关系目标在同一次权威切换后退出，不形成 domain/tag 双事实源。
- 保留完整集合校验、source revision、候选边界、关系策略、Git 历史预检、选择性 pending 快照和原子恢复责任。

非目标：

- 不改造其他资源类型，也不建立跨资源 tag 或 ID 契约。
- 不把 status、alignment、关系类型、候选/活动/归档状态或物理位置编码成普通 tag。
- 不让 tags 改变一条决策是否应拆分、演进、归档或对齐；分类维护不能代替决策语义审阅。
- 不提供旧格式兼容 reader、兼容 CLI、升级期双 Schema、迁移命令或任何辅助升级脚本。
- 不为旧物理路径提供永久链接、重定向、symlink、稳定 URI 或双权威副本。

## Decisions

### 术语与权威

| 对象 | 目标含义 | 权威来源 |
| --- | --- | --- |
| Decision ID | 记录 basename，包含 `.md`、不包含目录；目录移动保持 ID，basename 改变是显式身份迁移 | 权威 Markdown 的文件名 |
| tags | 非空的记录级分类 token 集合；不表达生命周期、关系、对齐或事实状态 | 权威 Markdown frontmatter |
| status | `candidate`、`active` 或 `archived` 的生命周期事实 | 权威 Markdown frontmatter |
| sourcePath | 相对 decision root 的当前 POSIX 源路径；只负责定位，不参与 Decision ID | 文件系统当前成员；已建立记录由派生索引投影 |
| relation target | 指向直接前序的稳定 Decision ID | 后继 Markdown 的 `relations[].target` |
| decision index | 以 Decision ID 为键，投影 status、alignment、tags、`sourcePath`、摘要和关系的可重建查询快照 | 从完整合法权威来源派生 |

同一快照中一个 Decision ID 必须只解析到一个普通 Markdown 文件。索引、位置与 tags 都不能反向补造或改写 Markdown 的身份、生命周期和决策语义。

### 物理布局与生命周期投影

```text
docs/decisions/
├── decision-index.json
├── <decision-id>             # candidate 或 active
└── archive/
    └── <decision-id>         # archived
```

1. `status` 是生命周期权威，位置是强制一致的物理投影。根目录直属 Decision Markdown 只能是 candidate 或 active，`archive/` 直属 Markdown 只能是 archived；checker 拒绝状态—位置不一致和跨位置同 ID。
2. 一个统一索引覆盖全部已建立 active 与 archived 记录，以 Decision ID 为 entry key，并以 `state.sourcePath` 保存当前位置。archive 不建立第二索引；candidate 不进入正式索引，由根目录源码查询发现。
3. `archive` 在同一事务中将源从根目录移动到 `archive/`、写入 archived status 并重建索引；重新激活执行反向移动并建立本次 alignment。预检、并发复核、失败恢复和最终严格检查覆盖源、目标与索引组合。

### 索引与来源 revision

1. 通用索引外壳继续使用 `schemaVersion: 3`；Decision Records 的 `definitionVersion` 从 `5` 提升为 `6`，明确拒绝旧定义。目标 metadata 是严格空对象 `{}`，不保留领域目录投影或新的 tag catalog。
2. 索引 entry 与 `sourceRevision.entries` 都以 Decision ID 为键。entry state 保存 `sourcePath`、title、status、alignment、createdAt、purpose、background、decision、tags 和 relations；不再保存或派生 domain。
3. `sourceRevision` 的单条指纹覆盖规范 Decision ID、当前 `sourcePath` 和规范化 Markdown 内容，使正文、tags、身份或位置变化都能被并发复核发现。空 metadata 仍按通用索引契约产生确定性 metadata revision。
4. 索引 keys 固定为多值 exact `tag`、exact `status` 与 exact `alignment`。candidate 继续排除在正式索引之外，由根目录权威源码发现。

### Tags 与查询

1. `tags` 位于每条 Decision Markdown frontmatter 的 `decision` 之后、`relations` 之前，使用 YAML sequence，并且至少包含一个元素。
2. Decision basename 符合 `^[a-z0-9]+(?:-[a-z0-9]+)*\.md$`。每个 tag 符合 `^[a-z0-9]+(?:-[a-z0-9]+)*$`，在单条记录内唯一，并按 locale 无关的字符串词法升序排列。
3. 手工更新现有记录时，先把原 domain ID 写为初始 tag。额外 tags 只有在记录内容提供明确依据时才增加；本次更新不要求重新设计 274 条记录的完整分类。
4. tags 是当前分类提示，可以在不改变 Decision ID、正文语义、生命周期或演进关系的前提下维护。已建立记录的纯 tag 修改属于分类维护，但仍必须重建索引并通过严格检查；tags 不承接历史分类谱系。
5. `domains` 命令和 `--domain` 一起删除，不增加替代的 tag catalog 命令。`list` 接受可重复的 `--tag <tag>`，重复参数使用 AND：结果必须同时包含全部指定 tags。OR、NOT、层级、别名和权重不属于当前契约。
6. `list` 默认只返回 active；显式 `--status archived|all` 才扩展范围。list/show/trace/candidates 输出使用 Decision ID、`sourcePath` 和 tags，不再返回 domain 定义；show 通过 `sourcePath` 只读取目标正文。
7. Readiness 已逐条审阅 20 条 domain description，并确认其稳定含义均由现有 skill 或项目 owner 承接。删除领域表时不重复迁写这些概览，也不复制成 tag 注册表；实施前若 owner 事实变化，先更新审计附件。

### 选择性暂存与身份变化

1. `stage <decision-id...>` 按 Decision ID 选择目标；普通目录移动不要求调用方同时提供旧、新路径。同一 ID 在 `revision` 与 `filesystem` 中具有不同 `sourcePath` 时，目标 pending 把旧位置删除和新位置增加作为一次移动。
2. basename 改名会产生旧、新两个 Decision ID，调用方必须同时显式选择两个 ID；旧 ID 只存在于 `revision` 表示删除，新 ID 只存在于 `filesystem` 表示新增。
3. 已有新模型基线时，未选择记录继续使用 `revision` 的 Markdown 与 `sourcePath`；首次建立集合时从 `filesystem` 构造完整合法新模型。stage 从目标 Markdown 重建统一索引，不读取 filesystem 或 pending 索引作为权威输入。
4. 最后一次成功 stage 仍完整替换 pending 中的 Decision Records 范围并保留范围外 pending 内容。无效 ID、选择不闭合、目标新模型不合法、revision 漂移或 pending 冲突都在写入前失败；不提供旧 domain revision 的读取或转换分支。
5. 本仓库的一次性权威切换以旧 domain revision 为基线，因而不能使用只接受新模型的目标 stage。该批变更通过普通版本控制文件选择整体进入 pending，并在提交前核对完整 Decision Records 范围；新模型进入 revision 后，后续选择性暂存才使用目标 stage。

### 稳定引用与普通链接

1. Decision Records 自己拥有的 `relations[].target`、show/trace/lifecycle/stage 选择参数和索引 entry key 全部使用 Decision ID；reader 通过完整来源或索引解析当前位置。
2. 其他 owner 中保存的仓库路径仍是物理路径，除非该 owner 明确建立 Decision ID 字段。不能因为字段包含路径就擅自将其改成语义 ID。
3. 本仓库内由当前维护 owner 承接的普通 Markdown 链接在权威切换中逐项手工更新，并运行项目链接检查。Decision Records 生命周期事务不自动改写其他 owner 的链接。
4. Archived Change、调查随附资源和其他明确保存形成时字节的材料不因当前路径变化而重写；当前调查主题中的可维护链接只按 Investigation Report owner 允许的链接修正方式处理。Readiness 清单必须区分当前导航引用、结构化语义引用、形成时快照和纯历史文本。
5. 仓库外引用旧物理路径的链接在文件移动后失效。本 Change 不提供兼容层或自动更新能力。

### 手工不兼容切换

本 Change 通过普通文件编辑、版本控制移动、普通版本控制文件选择和现有检查入口完成一次不兼容切换。实施期间不创建迁移命令、升级脚本或临时转换脚本，也不在 `scripts/`、`tools/`、Skill 分发物或未提交工作区中保留此类辅助实现。

实施顺序和逐项证据由 [`tasks.md`](tasks.md) 拥有。本设计只固定以下依赖约束：

1. 先从实施时最新 revision 复核审计清单和关系图，再使用现行生命周期入口建立两个未对齐后继；不得让旧身份、查询或 stage 判断在没有合法后继时退出。
2. parser、扫描、索引、查询、生命周期和 stage 必须先形成只接受目标模型的闭合实现与测试，再进行仓库权威来源切换；最终结果不得混合新旧身份。
3. 旧 revision 无法由目标 stage 读取，因此首次权威切换使用普通版本控制文件选择；目标模型进入 revision 后，选择性暂存才回到 Decision Records stage。
4. 只有目标实现、手工切换、owner、生成物和验证全部成立后，才能把两个后继及物理归档方向标记 aligned。

[`readiness-audit.md`](readiness-audit.md) 承接审计结论、关系预览、domain description 与引用处置；[`readiness-inventory.json`](readiness-inventory.json) 承接 274 条记录的精确映射。两者只用于人工核对和漂移检查，不是新 Schema、运行时输入或可分发升级工具。更新前后对账依赖权威源、Git diff、checker 和测试结果，不从目标索引反向生成 Markdown。

## Risks / Trade-offs

- **手工更新遗漏：**274 个文件、关系、索引和链接需要逐项修改，且没有升级脚本补偿。Readiness 清单、分批复核、完整集合 checker、链接检查和迁移前后对账是必要门禁。
- **破坏性格式切换：**目标 Skill 发布后不能读取旧 domain 工作区；这是已接受的不兼容边界，而不是待补兼容能力。
- **生命周期多文件写入：**status、位置与索引若被当成多个权威会漂移。Markdown status 保持唯一生命周期权威，位置和索引只作为受检投影；生命周期事务仍需恢复组合状态。
- **分类语义损失：**把 domain ID 写成 tag 只能保留筛选 token。Readiness 已确认 20 条 description 的稳定含义均有现成 owner；实施时按审计映射保留这些 owner，不把领域表概览误当成需要复制的新规范。
- **tag 漂移：**自由 tags 降低重组成本，也允许近义词和拼写分叉。严格语法与确定性排序只能降低机械漂移，不能识别近义词或替代基于记录内容的语义审阅。
- **链接失效：**Decision ID 只稳定工具内语义引用。当前维护链接由本次变更手工更新；形成时快照保留旧字节，仓库外旧路径失效是明确接受的结果。

## Open Questions

无。目标契约、查询组合、物理布局、兼容边界和更新方式已经确定。

实施时发现的新事实若改变上述契约，先修订 Design；只改变基线数量、指纹或引用清单时，更新 Readiness 审计并按 `tasks.md` 继续。
