# Design

本设计仿照决策记录的“受控目录表、路径归属、索引 metadata”模型，同时保留测试证据以 case ID 为稳定身份的领域差异。

## Context

- `1c4190d` 建立的测试账本索引决策明确写有“测试账本虽仍可使用单个 Markdown”，其 source revision 和 `show` 都围绕单一目录文本工作；当时没有测试主题目录表。
- `8dd0c02` 后的决策记录使用 `decision-domains.json`、`<domain-id>/<semantic-slug>.md`、`metadata.domains` 和路径派生 key，形成了完整的受控领域模型。
- 调查报告在相近时间采用了 `<category-id>/<semantic-slug>.md` 的主题源布局，但其一个索引项对应一个调查主题；测试证据的自然记录单位是最小原生测试入口对应的 case。
- 当前实现使用 `docs/test-evidence/cases/*.md`，一个文件包含多个 case，并在 state 中增加 `sourcePath`。它已经形成 config 和公开结果 schema v2、索引 definition v2、skill 版本 4 的可用多源基线，但不具备受控主题表和单 case 文件边界。
- 本 change 必须从上述当前版本继续演进，不能把已经进入仓库历史的 v2/版本 4 当作可忽略的未发布中间状态。

## Goals / Non-Goals

目标：

- 用一个受控主题表同时服务路径校验、索引 metadata、查询输出和主题选择。
- 让一个权威 Markdown 只承接一个 case，避免主题文件再次随 case 数量增长为局部巨型文件。
- 保持 case ID 是唯一稳定身份，主题只表达主要测试责任和物理维护边界。
- 让 agent 可先查询 topic，再按 topic、ID 或文本筛选 case，最后定点展开单份原文。
- 让源目录、派生索引和可分发 skill 使用同一套严格机器契约。

非目标：

- topic 不改变“一个最小原生测试入口对应一个 case”的登记粒度。
- 不让一个 case 同时属于多个 topic，也不新增 tags、影响面数组或层级主题。
- 不从 `Entry:`、测试路径、package 名称或源码内容自动推断 topic。
- 不把 topic 定义复制进每个 Markdown 或每个 index state。
- 不要求通用索引层理解测试主题、case Markdown 或测试入口。

## Decisions

1. 默认测试证据根目录为 `docs/test-evidence`，固定布局为：

   ```text
   docs/test-evidence/
   ├── test-evidence-topics.json
   ├── test-evidence-index.json
   ├── <topic-id>/
   │   └── <semantic-slug>.md
   └── ...
   ```

   项目可以通过配置替换根目录和索引路径，但根目录内部结构保持一致。
2. `test-evidence-topics.json` 使用独立 schema，保存按 ID 升序排列的 `{ id, description }`。topic ID 使用 kebab-case，描述提供稳定测试责任边界；ID 唯一且至少定义一个 topic。
3. 每个 case Markdown 必须直接位于一个 topic 目录中，并且恰好包含一个 `### Case <CASE-ID>: <title>` 及其 `Entry:`、`Contract:`、`Proves:`。文件名使用语义化 kebab-case，不重复 case ID 字段作为第二个身份 owner。
4. case ID 继续作为索引 `id` 和目录内全局唯一身份。`sourcePath` 只负责定位；topic 纠正需要移动文件并重建索引，但不改 case ID、Entry、Contract 或 Proves。
5. 路径第一段是唯一 topic 归属。v3 的 `state.sourcePath` 与公共结果都固定为
   catalog-root-relative 的 `<topic-id>/<semantic-slug>.md`，`show` 通过
   `catalogPath + sourcePath` 读取原文；Markdown 不新增 `Topic:` 字段，index
   state 不重复保存 topic；`keys.topic` 从 `state.sourcePath` 第一段派生并用
   `metadata.topics` 校验。
6. 索引 metadata 固定包含完整 `topics` 定义。公共 query 可按需要返回相关定义；`show` 返回目标 case 的 topic ID、description、紧凑 state 和完整 Markdown。
7. `sourceRevision` 对规范化主题表、配置中的 case ID pattern，以及按 POSIX 路径排序后的全部 catalog-root-relative case 路径与规范化正文做稳定 framing。v3 不再把 `catalogPath` 自身写入 revision；相同内容根移动后仍可复用同一索引语义。仅换行风格变化不应制造漂移，主题描述、文件移动、增删或正文变化必须制造漂移。
8. 根目录固定允许 `test-evidence-topics.json`、配置指向根目录内时的派生索引和可选 `README.md`；其他普通文件、符号链接和未知目录均失败。已存在 topic 目录必须至少包含一个 Markdown，只允许直接 case 文件，不允许嵌套目录。
9. 主题表可以定义尚无 case 的 topic；这类 topic 不创建空目录，但仍出现在 `topics` 命令和索引 metadata 中。
10. CLI 新增 `topics`，直接读取并校验权威主题表，不要求索引存在。`list` 接受至多一个 `--topic`，未知 topic 返回参数错误，已定义但无 case 的 topic 返回空结果及其定义。
11. `list`、`show` 和公共查询继续优先使用新鲜持久化索引；当前合法 Markdown 的只读内存投影策略沿用最终已确认的 test-evidence 查询契约，但无论走哪条路径都必须使用同一主题表和路径校验。
12. `check` 严格校验主题表、目录成员、单文件单 case、跨文件 ID 唯一性和索引新鲜度；`sync-index --write` 只重建统一索引，不写主题表或 case Markdown。
13. 相对当前多主题文件基线，配置和公共结果 schema 从 v2 提升到 v3，索引 definition 从 v2 提升到 v3，skill 版本从 4 提升到 5；通用状态索引外壳的 schemaVersion 继续服从其自身 owner。
14. 最终分发只接受主题根目录格式；旧单文件目录和当前 `cases/*.md` 格式由升级文档说明一次性迁移，不提供运行时双读、自动搬移或隐式 fallback。
15. 工具继续不读取测试源码、不执行 Entry、不生成 case。topic 目录发现只发现已经显式写入权威根目录的 case 文件，不等于测试入口发现或自动登记。

## Risks / Trade-offs

- 一个 case 一个文件会显著增加文件数量；统一索引和 topic 筛选正是为避免人工遍历这些文件，代价是迁移和批量审阅需要更好的清单与检查。
- case ID 与路径身份分离后，移动 topic 不要求改 ID，但所有直接文件链接必须更新；迁移必须检查仓库引用，不能只移动文件。
- topic 是唯一主要责任，跨工具共享测试可能难以分类；应选择拥有被证明契约的主要责任，不用多 topic 字段隐藏 owner 不清。
- 主题描述进入 source revision 后，文字边界变化会要求同步索引；这保证查询不会展示过期定义。
- 当前多主题文件基线与历史测试改造在同一仓库版本中落地。实施必须保持现有 case 和测试入口语义，并把 v2 到 v3 的兼容边界写入升级文档，不能把现有格式当作从未存在。
- 固定根文件白名单会拒绝消费者随意放置其他说明或资产；这是让 scanner、固定契约和目录成员保持一致所需的约束，额外材料应放在根目录之外或由未来契约显式扩展。
- v3 工具与分发产物完成后，本仓库仍暂时使用 v2 `.test-evidence.json` 和
  `cases/*.md`。由于本 change 明确不迁移真实仓库账本，目标测试、生成漂移、
  skill 结构和类型检查可以先形成稳定实现证据，但完整 `bun run check --strict`
  必然在仓库目录检查处失败。不得通过兼容双读或隐式 fallback 消除该失败；
  本 change 保持 active，直到紧随其后的
  `migrate-repository-test-evidence-to-topic-layout` 切换真实仓库目录并让完整检查
  通过，才满足原子交付门禁。

## Open Questions

无阻塞架构问题。本仓库最终 topic ID、description 和现有 case 归属由后续迁移 change 在实施前审阅，不属于可分发工具的通用契约。
