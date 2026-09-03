# Design

本设计将 rename 作为 Decision 和 Investigation 各自拥有的显式身份迁移事务，并把日期 ID、名称解析和 legacy 兼容视为前置契约；本文仍处于 Draft，必须先固定引用范围和 recorded-history 门禁再进入 Plan。

## Context

- [`保留型工件重名调查`](../../docs/investigations/260903-explore-name-collisions-in-retained-artifacts.md)确认 rename 适用于错误名称和格式迁移，不适用于为了创建合法同名实例而改写正确历史。
- [`日期前缀身份 Change`](../adopt-date-prefixed-record-identities/)负责 `YYMMDD-<name>.md`、唯一名称解析和 legacy 共存。本 Change 不复制其创建或 selector 规则；实现顺序上应先固定该契约。
- Decision basename 是稳定 ID。已建立记录可能被其他 Decision relation 引用，索引以 ID 为键并保存 sourcePath/source revision，candidate 也可能在同批 publish/evolve 关系中互相引用；stage 明确要求旧、新 ID 共同表达改名。
- Investigation basename 同时决定正式或 candidate 路径、索引键、关系 target 和 `_resources/<investigation-id-stem>/...` owner 前缀；其他正式报告与 candidates 都可能引用该 owner 的资源。
- 两个领域现有 mutation 的锁、revision、tombstone、原子发布和恢复结果不完全相同。Rename 需要复用各自机制，而不是抽象成只会调用 `rename(2)` 的共享实现。
- Change Plan 不属于本 Change。[`complete-change-plans-by-deletion`](../complete-change-plans-by-deletion/)单独负责取消 archive 并在完成后删除 active 目录，不为 Change 建设历史身份迁移机制。

## Goals / Non-Goals

目标：

- 为单个记录的身份纠错和显式格式迁移提供一条可审阅、可预演且不覆盖的正式路径。
- 在一次领域事务中同步全部由该领域拥有的 ID、关系、索引和资源事实。
- 对已进入 Git HEAD 的身份迁移提供与破坏性影响相称的显式确认，并保留普通 Git 历史。
- 让失败诊断说明冲突对象、未闭合引用、写入范围和下一步，不留下半改名状态。
- 让两个 skill、CLI、公开声明、分发产物和测试分别与其 rename 契约一致。

非目标：

- 不为 Change Plan 增加 rename；完成后的 Change 由独立 Change 删除并通过 Git 恢复。
- 不用 rename 自动解决合法重名或同日同名创建冲突。
- 不提供批量迁移、自动重命名全部 legacy 记录、正则替换或通用路径重构平台。
- 不修改正文的历史语义、formedAt、createdAt、status、alignment 或 relations type。
- 不扫描或改写仓库外系统、远端链接、Git 历史提交或无法证明归属的自由文本。
- 不把两个领域的事务源码合并为共享 rename runtime；只有已经存在且语义相同的文件系统原语可以继续复用。

## Decisions

### Intended Change

#### 公共命令意图

每个领域增加语义等价但参数可按既有 CLI 适配的入口：

```text
rename <source-selector> --name <new-semantic-name> [--preflight]
rename <source-selector> --to-id <new-complete-id> --migrate-id [--preflight]
```

普通 `--name` 保留已有日期前缀，只替换语义名称；它是日常纠错入口。`--to-id --migrate-id` 用于 legacy 格式迁移或确需改变完整身份的维护场景，必须显式给出完整目标，不从 Git 时间、文件时间或当前时间猜测历史日期。两个目标模式互斥。

Source 按日期前缀身份 Change 的完整 ID/唯一名称 resolver 解析。目标必须符合领域 ID 语法，在完整适用集合中未占用，并且不能与 source 相同。`--preflight` 完成与正式执行相同的集合、引用、revision、目标和恢复准备，但不获取 mutation 提交点、不写文件、不保存 receipt。

#### Decision rename

Decision 事务至少拥有：

1. source candidate、active 或 archived Markdown 的最终路径；
2. 全部 candidate 与已建立 Decision 中指向旧 ID 的 relation targets；
3. 已建立集合的 index key、state `sourcePath` 和 source revision；
4. 同一操作需要形成的 Git pending 选择说明，但不自动 stage。

事务在锁内重读完整集合和索引，预演替换后的关系图、位置与索引，再以不覆盖移动 source、改写关系来源并原子发布索引。Rename 不改变 status、alignment、createdAt、正文判断或 relation type。任何引用无法解析、最终图无效、索引陈旧或 source/target 漂移都在提交点前失败。

#### Investigation rename

Investigation 事务至少拥有：

1. source candidate 或正式报告的最终路径；
2. 全部正式报告和 candidates 中指向旧 ID 的 relation targets；
3. 正式 index key、state 和 source revision；
4. `_resources/<old-id-stem>/` owner 树到新 stem 的不覆盖移动；
5. 全部正式报告和 candidates 中引用旧 resource IDs 的受管引用。

事务预演最终报告图、资源 owner 唯一性、资源引用闭合和完整索引。存在目标 report、candidate、resource owner 或无法迁移的受管引用时失败；成功后旧 ID 和旧 owner 前缀不再出现在当前正式集合或 candidates 中。Rename 不改变 `formedAt`，因此变更日期前缀的显式迁移还必须满足 dated ID 与 `formedAt` UTC 日期的一致性。

#### 提交、恢复与版本控制

两个 rename 命令复用对应领域 mutation lock、revision 与恢复结果表达。目标已经进入 Git HEAD 时，正式执行要求领域专属的显式 recorded-history 确认；该确认只授权当前工作树身份迁移，不改写历史提交。成功输出至少包含 source ID、target ID、更新的关系/资源数量和 mutation outcome。

### Resulting Impacts

- **Decision Records：** 新增 CLI/SDK rename surface、集合级 relation rewrite、ID-keyed index 重建和事务恢复测试；现有 stage 仍要求调用方显式选择旧、新 ID，本命令不写 pending。
- **Investigation Report：** rename 必须与 publish、set-relations、discard、resource owner 和 stage-index 共用集合锁及 revision 语义，并覆盖 candidate/formal、关系、资源和索引组合恢复。
- **长期决策：** 分别为 Decision 与 Investigation 建立或演进身份迁移判断；跨领域只记录公共意图，不把不同领域的原子范围误写成统一事务。
- **分发与验证：** 修改两个工具源码、对应 build 产物、skill 契约、版本和公开声明；所有新增或修改的最小原生测试入口维护独立 Test Evidence case 并同步索引。
- **实施依赖：** 日期前缀身份 Change 先固定完整 ID、名称 selector 和 legacy 语法；本 Change 再以该稳定输入实现 rename，避免重复修改 CLI 参数和 parser。

## Risks / Trade-offs

| 风险或取舍 | 控制 |
| --- | --- |
| 全集合引用改写比单文件移动昂贵 | Rename 是低频维护事务，优先闭合正确性；使用当前集合索引/扫描并在锁内保护 revision |
| Investigation 资源 owner 扩大事务范围 | 把 owner 目录和全部受管引用纳入同一预演与恢复，不能只移动报告文件 |
| Decision candidate 与正式关系可能交叉引用 | 扫描正式集合与全部合法 candidates，按最终 ID 图统一验证 |
| 已记录文件改名会在 Git 中表现为删除与新增 | 要求显式 recorded-history 确认，并让 Git 自身保存历史；不实现历史重写 |
| 普通 rename 与 legacy 迁移混用会误改日期 | 默认只接受新语义名称并保留日期；改变完整 ID 必须使用独立参数和确认 |
| 两个 Change 并行实现会重复改 CLI parser | 本 Change 明确依赖日期身份 Change，先固定 selector 再实现 rename |

## Open Questions

1. Candidate rename 是否允许其他未选择 candidate 同时引用 source；若允许，是否把这些 candidate 纳入同一事务，还是要求调用方先用现有编辑流程解除引用？
2. 已进入 Git HEAD 的 rename 确认参数应按两个领域统一命名，还是沿用各自现有 discard/history 术语？
3. `--preflight` 是否复用现有 mutation 结果 envelope，还是建立两个领域共同的 rename preview 最小字段；不得为统一输出而丢失资源或关系范围。
4. Legacy `--to-id` 迁移是否允许改变日期前缀，还是只允许从无日期 ID 补入由权威时间字段证明的日期？
