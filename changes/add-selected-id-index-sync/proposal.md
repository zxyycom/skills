# Proposal

本 Change 为共享派生索引和三个当前消费者增加“刷新指定 ID 索引”的同步模式，同时保持生成索引对完整来源集合全局新鲜。

## Why

Decision Records、Investigation Report 与 Test Evidence 的 `sync-index` 当前只支持从完整来源集合检查或重建整个工作区索引；已有 `stage-index`/选择性暂存只组合 Git pending 中的索引条目，并不会从领域来源同步工作区索引。调用方因此无法表达“这次只允许 ID A 的来源变化进入索引”：全量同步会一并接纳其他尚未准备好的手工变化，而只手工改一个索引条目又会破坏完整投影、关系验证和 source revision。

用户需要单独刷新一个或多个指定 ID 的索引，而不是减少扫描耗时。实现仍完整读取和验证来源，但只有实际变化集合完全落在显式选择的 ID 内时才写入；存在未选择变化时必须零写入失败。

## Outcome

- 共享 Index Runtime 支持显式 `all` 与 `selected IDs` 两种同步 scope；领域入口先把用户 selector 解析为非空、唯一、规范的领域 ID，再进入 selected scope。
- 三个派生索引 CLI 支持可重复 selector；不带 selector 时保留当前全量同步，不改变 `--write` 的 check/write 区分。
- Decision/Investigation selector 复用普通 ID-first 管线：去除兼容 `.md` 后缀，标准日期前缀解析成功就按精确 ID，解析失败就按 baseline/candidate 的 name 索引查 ID；重复 name 报 ambiguous。Test Evidence 没有独立 name 契约，仍按精确 Case ID 解析。
- selected sync 完整构建和验证当前来源投影，计算相对当前持久索引的全部 entry/source-revision 变化；只有所有实际变化 ID 都已选择且集合级 metadata 未变化时才允许写入。
- 新增、修改和删除通过选择相应 ID 精确同步；ID rename 需要同时选择旧、新 ID。选择存在于旧索引或当前来源任一侧即可，额外选择未变化 ID 合法。
- 持久索引缺失、损坏、definition 不匹配、集合级 metadata 变化或出现未选择 ID 变化时，selected sync 零写入失败并给出应全量同步或补充选择的诊断。
- 成功时仍原子发布完整当前投影，不把未选择条目保留为故意陈旧状态；精确同步与选择性 Git staging 保持两个独立概念。
- selected sync 的内部变化门禁只使用 [`纯 ID Plan`](../archive/separate-domain-ids-from-storage-details/) 建立的显式领域 ID；name 只存在于领域 CLI 的输入解析层，sourcePath 不作为 selector。
- selected sync 不充当正式 record rename 的第二阶段；未来 rename 命令仍由领域事务原子改写来源、关系、资源和索引，不能先留下半迁移来源再靠 scoped sync 补救。

## Scope

### Intended Change

扩展 `tools/index-runtime` 的同步类型、比较算法、诊断与结果 envelope，并在 Decision Records、Investigation Report、Test Evidence 的 `sync-index` CLI/SDK 中公开可重复 selector；领域层把 selector 解析为 ID 后再复用完整 projection、校验、漂移检测和原子写入，不实现按 ID 的局部来源读取或持久化半新鲜索引。

### Resulting Impacts

- shared runtime 必须严格读取旧索引作为 selected baseline，并能区分 entry 变化、per-ID source revision 变化与集合级 metadata 变化；同一 ID 的 name、sourcePath 或内容变化都属于该 ID。
- 三个领域需要在 CLI 参数、selector-to-ID 解析、结果输出、固定契约、生成声明和测试中公开相同 scope 原则，同时保留各自来源验证和 mutation/lock 边界。
- 当前全量 `sync-index` 行为、查询时的新鲜度要求和 `stage-index` 的 Git pending 语义不能被 selected sync 弱化或合并。
- [`记录 rename Draft`](../add-record-rename-transactions/)继续拥有领域原子迁移；本 Change 只为已经发生且允许接纳的来源变化提供索引 scope 门禁。
- Task Graph 的 JSON 是权威状态而非从领域来源重建的派生索引；Change Plan 当前没有同类派生索引，二者不增加 selected sync。

## Success Criteria

1. 三个领域均可通过一个或多个 selector 执行 check/write scoped sync；Decision/Investigation 的标准 ID 与唯一 name 得到相同 selected ID，无 selector 的全量行为保持兼容。
2. 只有 selected ID 变化时，write 成功且生成索引与对完整当前来源做全量重建的规范字节完全相同。
3. 存在任一 unselected ID 变化、集合 metadata 变化或非法 baseline 时，命令零写入失败并返回稳定、可行动的诊断。
4. 新增、修改、删除、rename、唯一/重复 name、标准/非法日期前缀、兼容 `.md`、未变化选择、未知/重复 selector、来源构建漂移和原子写入失败都有直接测试。
5. scoped sync 不读取 Git revision、不修改 pending，也不被误称为 `stage-index`；选择性 staging 继续只处理已经生成的工作区索引。
6. 共享 runtime、三个 skill 契约、源码、生成产物、类型/Schema、最小原生测试入口与 Test Evidence 账本一致，主仓库检查通过。

## Affected Owners

- `tools/index-runtime/` 的同步 API、类型、比较/序列化、诊断、README 与测试。
- `tools/decision-records/`、`skills/decision-records/`、`scripts/build/decision-records.ts` 及生成 CLI/声明。
- `tools/investigation-report/`、`skills/investigation-report/`、`scripts/build/investigation-report.ts` 及生成 CLI/声明。
- `tools/test-evidence/`、`skills/test-evidence-review/`、`scripts/build/test-evidence.ts` 及生成 CLI/声明。
- `docs/test-evidence/` 的最小原生测试 case 与统一派生索引。
- `changes/archive/separate-domain-ids-from-storage-details/` 的前置纯 ID 契约。
