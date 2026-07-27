# Proposal

本 change 把 `test-evidence-review` 当前按主题文件聚合 case 的目录改造成受控主题
分层、单 case 文件和统一派生索引；本文是仍保持 active 的实施计划，通用实现可以
先形成“可交接迁移”证据，但只有下游真实仓库迁移与完整 strict check 共同通过后
才完成并归档。

## Why

测试账本在 `1c4190d` 接入通用状态索引时，解决了按 case ID 查询、分页、同步和定点展开问题，但仍明确使用单个 `cases.md` 作为权威源。当前实现已把它扩展成 `cases/*.md`，虽然减少了单文件写入热点，却仍以文件名隐式表达主题、允许一个主题文件聚合大量 case，也没有主题定义、边界说明、主题筛选或索引 metadata。

决策记录已经形成更完整的分层模型：目录表定义受控领域，路径第一段表达唯一归属，索引 metadata 向读取方提供定义，统一索引从全部 Markdown 派生。测试证据需要采用同类结构，但继续以 case ID 而不是文件路径作为稳定身份。

## Outcome

- `catalogPath` 指向测试证据根目录，而不是单个 Markdown 或无定义的主题文件集合。
- 根目录中的 `test-evidence-topics.json` 唯一定义 topic ID 与责任边界。
- 每个 case 独占 `<topic-id>/<semantic-slug>.md`；路径第一段表达唯一主题归属，一个文件不再聚合多个 case。
- case ID 继续作为跨主题唯一索引身份；移动主题不改变 case ID，但会改变源路径并使索引陈旧。
- `test-evidence-index.json` 的 metadata 提供完整主题定义，topic 查询键从源路径派生。
- CLI 提供 `topics`，并让 `list`、`show` 和严格检查直接呈现或校验主题信息。
- 工具继续只处理显式 case，不扫描测试源码、不执行 `Entry:`、不自动收集或注册 case。

## Scope

纳入范围：

- 测试证据主题目录表、目录路径、单 case Markdown、跨文件 case ID 唯一性和根目录成员规则。
- 配置、source revision、状态索引 metadata/state/keys、查询、show、同步和诊断。
- `topics`、`list --topic`、`show`、`check` 与 `sync-index` 的 CLI 和机器接口。
- `tools/test-evidence/` 源码、测试、Schema、公共声明以及 `skills/test-evidence-review/` 的生成产物。
- `test-evidence-review` 的行为入口、固定目录契约、人类说明和单文件升级说明。
- 当前“直接子级主题 Markdown”实现的收敛或替换。

不纳入范围：

- 迁移本仓库现有 case 正文、确定本仓库最终主题表或修改历史测试实现；这些由下游
  `migrate-repository-test-evidence-to-topic-layout` change 承接，本 change 只保留
  两者原子关闭所需的门禁，不实施真实仓库迁移。
- 源码 marker、测试入口采集、自动登记、后台同步或执行 `Entry:`。
- 将 lint、类型检查、生成物检查、安全扫描或其他工程校验纳入测试账本。
- 多主题归属、标签系统、主题层级、别名、兼容双读或自动猜测 case 应属于哪个主题。
- 修改通用索引协议；本 change 只消费其现有类型化 metadata 和领域 key 能力。

## Success Criteria

可交接迁移的独立证据：

- 测试证据根目录只有允许的根文件和已定义 topic 目录；未知、嵌套、空的 topic 目录以及 topic 目录中的非 Markdown 内容都会被拒绝。
- `test-evidence-topics.json` 是 topic ID 和描述的唯一事实源；定义可以暂时没有 case，此时不创建空目录。
- 每个 Markdown 恰好包含一个合法 case，case ID 在全部 topic 中唯一，且索引身份不依赖文件路径。
- 索引 metadata 完整投影 topic 定义，topic key 从 `sourcePath` 第一段派生并由 metadata 校验。
- source revision 覆盖规范化主题表、全部排序后的源路径和 Markdown 正文；主题定义、成员或正文变化都会使旧索引失效。
- `topics` 能在索引不存在时读取合法主题表；`list --topic`、`show` 和查询结果能够提供相关 topic 定义。
- 发布接口相对当前多主题文件基线只有一个明确升级出口。
- test-evidence 行为测试、生成漂移检查、skill 结构验证和类型检查通过，足以把只接受
  v3 的通用实现交接给真实仓库迁移；该证据不要求本 change 范围外的 v2 账本已经
  切换，也不表示 change 已完成。

迁移后共同关闭证据：

- 下游 migration change 把真实仓库配置、topic 表、case 路径和派生索引一次性
  切换到 v3；本 change 不增加 v2 双读、隐式 fallback 或临时兼容路径来提前消除
  迁移门禁。
- 通用实现与真实仓库迁移组合后运行 `bun run check --strict` 并通过；在这项共同
  证据建立前，本 change 保持 active、验证任务 2.5 保持未完成且不得归档。

## Affected Owners

- `skills/test-evidence-review/SKILL.md` 与 `references/catalog-contract.md`：触发后行为、主题目录和索引契约。
- `tools/test-evidence/`：主题表、目录扫描、索引领域适配、CLI、Schema、声明和测试。
- `tools/index-runtime/`：只作为现有 metadata、key、同步和查询协议的前置 owner。
- `scripts/build/test-evidence.ts` 与生成检查：可分发脚本、Schema、声明和 source map。
- `docs/skills/test-evidence-review.md` 与 `docs/tooling.md`：人类入口和工具链说明。
- `docs/decisions/test-evidence-review/`：主题路径、case 身份和统一索引的长期判断。

## Dependencies

本 change 的通用实现没有其他 active change 前置依赖，只依赖当前已发布的通用
索引 metadata 与查询能力。达到“可交接迁移”的独立证据后，它向
`migrate-repository-test-evidence-to-topic-layout` 提供最终目录和工具契约，但
仍保持 active：不引入 v2 双读、隐式 fallback 或兼容分支，也不单独归档。只有
下游迁移完成并让组合状态通过 `bun run check --strict` 后，本 change 才能完成
验证任务 2.5 并与迁移 change 共同关闭；此后
`audit-repository-native-test-ledger` 才能审计最终 case 路径。
