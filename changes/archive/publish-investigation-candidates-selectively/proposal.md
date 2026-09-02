# Proposal

本 Change 为 Investigation Report 增加不属于正式报告集合的 authoring candidate、可重复只读发布预检和按显式 ID 选择的批量 publish 事务，同时保留根目录正式报告与 `sync-index` 的全量恢复语义。

## Why

当前调查根目录中的每份规范报告 Markdown 一写入就属于正式集合，新报告只能先手工放入正式根目录，再依赖集合级 `sync-index` 验证完整关系、资源并更新索引。机械 metadata、关系闭包、资源和索引错误因此会在报告已经进入正式集合后才暴露，且正常创建与全量恢复使用同一动作。

调查报告需要一个集合外 authoring workspace，让内容可以先收敛并按显式批次预检、发布；但它不能成为新的 active/archived 生命周期，也不能改变“正式根目录报告写入即建立”或让普通 publish 静默吸收未选择的手工正式来源漂移。

## Outcome

- `investigation-report new` 根据显式 Investigation ID、title、formedAt、question、tags 和直接关系参数，在调查根目录用保留候选文件名原子且不覆盖地写入规范 scaffold；候选正文采用正式固定章节和资源链接语法但允许暂时为空。
- 候选文件与正式报告共用调查根，使 `./_resources/...` 在 authoring 与正式位置具有相同含义；候选身份不匹配正式 Investigation ID，正式报告发现、索引 source revision 和正式查询始终忽略它。
- `new` 的退出状态只表达输入与候选创建。创建成功后，正文 incomplete、辅助 preflight attention 或 unavailable 分别报告但不使命令失败，也不诱导调用方重跑 `new`。
- `candidates` 与 `show-candidate <id>` 发现候选、原文、机械 body/resource readiness 和定位诊断，不把这些结果称为语义审核或发布授权。
- `publish <id...> --preflight` 对显式候选批次重复执行只读最终集合预演；普通 `publish <id...>` 在同一准备结果上重新加锁和校验后，原子建立且只建立选中候选，并更新完整正式索引。
- `discard-candidate <id>` 显式清理一个 authoring candidate；删除其 owner 资源或 Git `HEAD` 已记录内容时继续要求独立参数确认，不扩大为正式报告 discard。
- `publish` 是候选进入正式集合的正常事务入口，但不是形式上的唯一建立机制。手工写入正式根目录的完整报告仍立即属于正式集合，只有显式 `sync-index` 才能全量验证并接纳这类正式来源变化。
- 创建、查询和 preflight 不保存 receipt、不继承确认；普通 publish 重新检查正式基线、选中候选、资源、关系、Git warning、锁和漂移。

## Scope

### Intended Change

- 为调查根目录增加保留候选文件类 `_candidate.<investigation-id>`，以及 `new`、`candidates`、`show-candidate`、`discard-candidate` 命令；候选不是正式 report ID，也没有 status、archive 或索引 entry。
- 让候选使用正式 report frontmatter、正文顺序和 `./_resources/<resource-id>` 语法；扩展资源验证以识别候选 owner 和共享引用，同时保证正式索引与正式查询忽略候选。
- 增加 `publish <id...> [--preflight]`：从可靠正式报告/索引基线和显式选择构造最终集合，验证完整关系图、资源和索引后，以可恢复事务把候选改名为正式报告并发布索引。
- 保留 `sync-index` 对正式根目录的全量恢复与显式接纳职责；普通 publish 发现未选择正式来源漂移时拒绝并要求先运行 `sync-index`。
- 使用当前共享诊断和 Investigation mutation outcome 契约表达创建、候选清理、发布前失败、完整回滚、恢复不完整与提交后清理。

### Resulting Impacts

- 调查根目录成员契约、报告发现、候选路径安全、跨候选/正式身份冲突、默认检查和维护恢复需要支持保留候选文件，但正式 Investigation ID 和根目录正式报告语义保持不变。
- 资源 owner 校验需要同时识别集合外候选的 authoring ownership；候选自己的资源提前位于最终 `_resources/<id-stem>/`，publish 不改写链接或搬迁资源，但必须保护并复核受影响资源 snapshot。
- 批量 publish 需要可靠正式索引基线、选中候选闭包、空集合首次建立、完整最终图/index 构造、集合锁、目标改名、索引提交点和恢复诊断。
- `sync-index`、正式 `list/show/trace`、默认/scoped check、`set-relations`、正式 `discard` 和 `stage-index` 的候选忽略或安全检查边界需要显式固定，避免候选被无关动作吸收。
- “调查关系不产生生命周期”与“报告级索引由完整正式集合派生”的长期判断需要 successor Decision 分别承接 authoring workspace 和选择性正常发布入口。
- Skill 行为、固定契约、恢复说明、人类介绍、维护源码、公开类型、生成 CLI/Schema、版本、测试与 Test Evidence 需要同步。

## Success Criteria

- `new` 从规范且不重复的显式参数创建 `_candidate.<investigation-id>`，字段与章节顺序稳定；非法参数、正式/候选身份冲突、符号链接、锁或原子发布失败不产生目标文件，也不覆盖已有内容。
- 候选创建成功时退出 `0` 并报告路径；body/resource incomplete、关系 attention 或 Git/index preflight unavailable 不伪装为创建失败，输出指向编辑、候选查询或 `publish --preflight`，而不是重跑 `new`。
- 正式 `list/show/trace`、正式索引 state/source revision 和 `stage-index` 完全忽略候选；默认 check 只让候选路径安全、跨集合身份冲突和无法可靠区分成员的错误阻断正式集合，候选正文/resource readiness 使用候选诊断。
- 候选与正式报告使用同一 `./_resources/...` 链接字节；候选可引用自己的预置资源或既有正式 owner 资源，publish 不改写链接、不移动资源，并在发布前验证路径、owner、引用、成员身份和版本控制可见性；单纯资源字节变化不成为索引或 publish 漂移。
- `publish --preflight` 对单报告、归并和拆分批次提供完整只读最终集合结果且零写入；普通 publish 重新读取全部事实，只把选中候选改名为正式报告并更新索引，未选择候选和无关工作保持不变。
- 正式来源或索引基线漂移时 publish 不猜测混合结果；全新无报告且无索引的集合允许首次 publish，其他缺失、损坏或陈旧基线要求先显式 `sync-index`。
- 发布前失败不改变候选、正式报告、资源或索引；写入后失败返回准确的 `rolled-back`、`partial-or-unknown` 或提交结果。成功后正式集合、完整关系图、资源和索引一致。
- `discard-candidate` 只删除显式候选及经确认的 owner 资源，保护其他正式/候选引用和 Git 已记录内容；正式 `discard` 的职责不变。
- `sync-index` 的帮助和契约明确其全量恢复/接纳职责，手工正式来源变化不会被普通 publish 静默吸收。
- 对应 successor Decisions 在行为落地并验证后建立；生成物、skill 版本和一入口一 case 的测试证据同步，定向测试及 `bun run check` 通过。

## Affected Owners

- 调查行为与规则：`skills/investigation-report/SKILL.md`、`skills/investigation-report/references/investigation-report-contract.md`、`skills/investigation-report/references/maintenance-recovery.md`、`docs/skills/investigation-report.md`
- 领域实现与公开类型：`tools/investigation-report/`
- 生成与分发：`scripts/build/investigation-report.ts`、`skills/investigation-report/scripts/`、`skills/investigation-report/references/investigation-index.schema.json`
- 长期判断与索引：`docs/decisions/`、`docs/decisions/decision-index.json`、`docs/investigations/investigation-index.json`
- 验证证据：`tools/investigation-report/tests/`、`docs/test-evidence/investigation-report/`、`docs/test-evidence/test-evidence-index.json`
