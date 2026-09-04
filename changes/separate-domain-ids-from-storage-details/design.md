# Design

本设计把领域实体身份、物理映射和任意路径引用拆成三个明确概念，并以一次受检迁移把 Change、Decision 与 Investigation 的公开身份收敛为纯 ID。

## Context

- [`Decision Records 固定规则`](../../skills/decision-records/references/decision-record-rules.md)当前把含 `.md` 的 basename 定义为稳定 Decision ID；`sourcePath` 已经单独保存 root 或 `archive/` 下的位置。
- [`Investigation Report 固定契约`](../../skills/investigation-report/references/investigation-report-contract.md)当前同样把含 `.md` 的 basename 定义为 Investigation ID；candidate 文件、正式报告与资源 owner 都由该 basename 或 stem 映射。
- [`Change Plan 固定契约`](../../skills/change-plan/references/change-plan-contract.md)当前公开 `changeName` 与绝对 `changeDirectory`，单项 CLI 直接接收 Change 目录；调用者因此常把 `changes/<name>` 当成“ID”。
- Test Evidence Case ID 与 Task ID 已经是领域语义身份。Case 的 `sourcePath` 和 Task 的各种引用字段不等于 ID，证明仓库不需要把所有可定位信息压进一个字符串。
- [`日期前缀身份 Draft`](../adopt-date-prefixed-record-identities/)和 [`记录 rename Draft`](../add-record-rename-transactions/)仍在设计期，可以改为消费纯 ID 基线，而不需要维护已实现的第二套格式。
- ID 纯化会改变长期身份契约、索引键和关系 target，达到 Decision 记录门槛；Change artifacts 只保存实施上下文，不能代替对应长期 owner。

## Goals / Non-Goals

目标：

- 让所有领域实体 ID 遵循“只表达领域身份，不表达存储位置或文件类型”的共同原则。
- 保持每个领域自己的 namespace、语法、唯一性范围和 resolver，不建立全仓库 ID registry。
- 让 ID、path 和自由引用在类型、字段名、CLI 参数与诊断中可区分。
- 以确定性迁移闭合当前关系、索引、生成契约和测试，而不是让新旧规范长期混写。
- 为后续按 ID 精确同步提供稳定、无存储细节的 selector 契约。

非目标：

- 不要求 ID 与文件 basename 完全无关；Decision/Investigation 仍可用 `<id>.md` 作为确定性物理映射。
- 不移除日期前缀语义、Case ID 前缀或 Task ID 前缀；这些是领域身份的一部分，不是存储根或扩展名。
- 不把 Investigation Resource ID、测试 locator、Git branch/commit、URL 或明确的 path/reference 字段统一改造成实体 ID；Resource ID 当前是受管资源池内的复合 locator，本 Change 不改变其 owner。
- 不建立跨领域全局唯一性、通用 allocator、UUID 或中央 resolver。
- 不在本 Change 实现 record rename 或按 ID 精确同步；它们各自使用纯 ID 作为前置契约。
- 不重写 Git 历史、仓库外引用或无法证明属于受管结构字段的正文文本。

## Decisions

### Intended Change

#### 目标模型与实施依赖

| 领域实体 | 规范 ID 示例 | 物理位置示例 | 本 Change 的处理 |
| --- | --- | --- | --- |
| Change | `add-selected-id-index-sync` | `changes/add-selected-id-index-sync/` | 新增 `changeId`，根和 status 单独选择 |
| Decision | `260904-some-decision` | `docs/decisions/260904-some-decision.md` | 从 ID、关系和索引键移除 `.md` |
| Investigation | `260904-some-investigation` | `docs/investigations/260904-some-investigation.md` | 从 ID、关系和索引键移除 `.md` |
| Test Evidence Case | 现有 Case ID | `docs/test-evidence/<topic>/<slug>.md` | ID 已与 `sourcePath` 分离，保持不变 |
| Task | 现有 Task ID | 无固定文件映射 | 保持不变 |

实施依赖固定为：

```text
separate-domain-ids-from-storage-details（本 Plan）
├── add-selected-id-index-sync
└── adopt-date-prefixed-record-identities
    └── add-record-rename-transactions
```

下游 Change 只有在本 Plan 完成并归档后才能实施；它们可以继续完善方案，但不得先形成带 `.md` 或目录前缀的新公开 ID。

#### 共同身份边界

公开字段或参数只有在表示领域身份时才命名为 `id` 或 `<domain>Id`，并满足：

1. 不包含领域根，例如 `changes/`、`docs/decisions/` 或 `docs/investigations/`。
2. 不包含生命周期位置，例如 `archive/`。
3. 不包含 `.md` 等文件扩展名。
4. 唯一性由领域集合定义；领域类型由调用的命令、API 或结构化 `{ kind, id }` 上下文提供，不拼进 ID。
5. 位置单独由 `sourcePath`、`changeDirectory`、`changeRoot` 或其他明确 path 字段表达。

本 Change 不抽取共享语法 parser。Change、Decision、Investigation、Case 与 Task 的合法字符和生命周期规则不同；只共享可观察原则，各 owner 继续验证自己的 ID。

#### Decision 与 Investigation

Decision/Investigation 的规范 ID 从现有合法 Markdown basename 确定性移除最后的 `.md`：

```text
260904-some-record.md  ->  260904-some-record
```

正式文件继续映射为 `<id>.md`；Decision archive 映射为 `archive/<id>.md`；Investigation candidate 映射为 `_candidate.<id>.md`。去除后缀不移动现有文件，Investigation 的 `_resources/<id>/...` owner 物理形状也无需变化。

全部规范 selector、关系 source/target、索引 entry key、source revision key、SDK 类型和结构化结果只使用纯 ID。当前受管 Markdown 关系和派生索引通过领域 checker 先完整预演、再按现有事务边界迁移；任何歧义、悬空引用、无效集合或写入漂移都零写入失败。

旧的 `<id>.md` 形状不再作为规范 ID 写入长期契约。为避免无必要地破坏已分发调用，现有入口可以在边界层把可无歧义识别的旧值作为 legacy selector 接收并立即规范化，也可以为真实路径提供明确的 path 参数；两者都不得让旧形状进入结构化输出、关系或索引。新入口（包括后续 `sync-index --id`）只接受纯 ID。兼容 parser 必须先按固定语法分类，不能依靠目标恰好存在或搜索顺序猜测。

#### Change Plan

Change Plan 将直接子目录 basename 定义为相对 `changeRoot` 唯一的 `changeId`。规范命令表面按下列信息解析：

- `list` 仍按显式或默认 `changeRoot` 发现集合。
- `show <change-id>` 默认选择 active；读取历史时使用显式 archived status 选择。
- `check <change-id>`、`plan <change-id>` 与 `archive <change-id>` 只选择 active Change。
- 所有单项命令用显式 `--change-root <path>` 覆盖默认根；不把根路径和 ID 拼成一个位置参数。

结构化输出增加 `changeId`，保留 `changeDirectory` 作为解析后的绝对位置。现有 `changeName` 若没有独立语义则由 `changeId` 取代，而不是长期保留两个同值身份字段。内部文件系统事务仍接收已解析且经过安全检查的目录，不把纯 ID 直接当作任意路径。

现有单项命令的位置参数采用一条确定性兼容规则：不含路径分隔符且符合 Change ID grammar 的值按 `changeId` 解析；绝对路径或含路径分隔符的值按 legacy change-directory 解析。解析不查询“哪个目标恰好存在”来决定参数类型。CLI help 和新调用统一使用 `changeId + --change-root + status`；legacy directory 成功结果仍只输出规范 `changeId` 和独立 `changeDirectory`。

#### 数据与契约迁移

实施采用单次规范数据 cutover：

1. reader 和 selector 先能区分纯 ID、旧 `<id>.md` selector 与受管路径，并在内存中只产生纯 ID；writer 从这一步开始只生成纯 ID。
2. 在完整集合预检通过后，按领域事务边界改写受管 Markdown 关系，再从同一最终集合重建派生索引；任何一步失败都不得留下新旧关系混合的已承诺集合。
3. 更新仓库内调用点、CLI help、skill 契约、Schema/声明和生成产物，并运行受管内容审计。
4. 切换完成后，长期 owner 只把纯 ID 描述为规范身份；旧格式只保留在明确标注的输入兼容边界、Git 历史、历史调查上下文或迁移测试 fixture 中。

自由文本只在它承担当前受管结构契约且可由 parser 精确定位时改写。Task Graph `references` 等开放字符串不会仅因内容像路径就自动转换；如果某个字段实际承诺领域 ID，应先把字段类型和 owner 说清，再纳入迁移。

### Resulting Impacts

- **长期决策：** 需要以 successor Decision 演进当前“含 `.md` basename 是 Decision ID”的判断，并在仓库模型中固定 ID/path 分离原则；旧 Decision 保留历史，不原地伪装成一直采用纯 ID。
- **Decision Records：** ID grammar、Markdown parser、关系图、candidate/active/archive resolver、query/lifecycle/stage、index definition、JSON Schema/声明和全部输出发生协同变化；现有文件无需移动。
- **Investigation Report：** ID grammar、candidate/formal resolver、关系图、资源 owner 绑定、query/publish/discard/stage、index definition、Schema/声明和输出协同变化；资源 ID 的 owner 首段继续等于纯 Investigation ID。
- **Change Plan：** 六个固定命令的单项选择语法、active/archived status 选择、结果字段、源码与生成脚本需要升级；目录安全、Plan 基线和 archive 事务本身不改变。
- **相关 Draft：** 日期前缀身份使用 `YYMMDD-<name>`，rename 使用 source/target 纯 ID；二者明确依赖本 Change，避免实现顺序重复迁移。
- **后续精确同步：** [`按 ID 精确同步 Plan`](../add-selected-id-index-sync/)只接受本 Change 定义的纯 ID，不能把 `.md` 或 `changes/` 重新带回 shared runtime/CLI。
- **测试证据：** 修改或新增的最小原生测试入口逐项更新 Test Evidence case；Case ID 本身不改变，catalog 索引按既有流程同步。

## Risks / Trade-offs

| 风险或取舍 | 控制 |
| --- | --- |
| 改变已有 CLI 与持久 ID 形状会影响脚本和分发使用者 | 更新全部仓库调用点和生成产物；旧输入只在确定性边界规范化，输出与持久状态保持单一纯 ID |
| 关系与索引迁移不完整会制造悬空引用或双重身份 | 迁移前构造完整最终集合并用领域图/Schema 校验，按领域事务发布，失败零写入或返回既有恢复结果 |
| Change ID 只在 `changeRoot` 内唯一 | 所有脱离默认根的操作同时携带显式 `changeRoot`；不虚构跨根全局 ID |
| 去除 `.md` 后仍由 filename stem 推导 ID | 这是确定性存储映射而非公开身份包含文件细节；真正需要解耦 basename 的证据另立 Change |
| 开放 reference 字符串可能仍含路径 | 只保证命名和类型声明为 ID 的表面；任意引用保留其 owner 语义，避免误迁移 |
| 与日期身份、rename、精确同步并行会重复修改 parser | 本 Change 先实施；三个下游 Change 在 Readiness 中检查其完成和契约版本 |

## Open Questions

无。共同原则、领域范围、cutover 方式和下游依赖已经确定；实施中若发现某字段究竟是 ID 还是 path 无法由当前 owner 判断，应暂停该字段迁移并先修订本设计，而不是按字符串外形猜测。
