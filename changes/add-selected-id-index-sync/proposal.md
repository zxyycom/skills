# Proposal

本 Change 为共享派生索引和三个当前消费者增加按指定领域 ID 精确接纳来源变化的同步模式，同时保持生成索引对完整来源集合全局新鲜。

## Why

Decision Records、Investigation Report 与 Test Evidence 的 `sync-index` 当前只支持从完整来源集合检查或重建整个工作区索引；已有 `stage-index`/选择性暂存只组合 Git pending 中的索引条目，并不会从领域来源同步工作区索引。调用方因此无法表达“这次只允许 ID A 的来源变化进入索引”：全量同步会一并接纳其他尚未准备好的手工变化，而只手工改一个索引条目又会破坏完整投影、关系验证和 source revision。

用户关注的是接纳范围精确，而不是减少扫描耗时。所需模式应完整读取和验证来源，但只有实际变化集合完全落在显式选择的 ID 内时才写入；存在未选择变化时必须零写入失败。

## Outcome

- 共享 Index Runtime 支持显式 `all` 与 `selected IDs` 两种同步 scope；selected scope 接收非空、唯一、规范的领域 ID。
- 三个派生索引 CLI 支持可重复 `--id <id>`；不带 `--id` 时保留当前全量同步，不改变 `--write` 的 check/write 区分。
- selected sync 完整构建和验证当前来源投影，计算相对当前持久索引的全部 entry/source-revision 变化；只有所有实际变化 ID 都已选择且集合级 metadata 未变化时才允许写入。
- 新增、修改和删除通过选择相应 ID 精确同步；ID rename 需要同时选择旧、新 ID。选择存在于旧索引或当前来源任一侧即可，额外选择未变化 ID 合法。
- 持久索引缺失、损坏、definition 不匹配、集合级 metadata 变化或出现未选择 ID 变化时，selected sync 零写入失败并给出应全量同步或补充选择的诊断。
- 成功时仍原子发布完整当前投影，不把未选择条目保留为故意陈旧状态；精确同步与选择性 Git staging 保持两个独立概念。
- selected sync 只接受 [`纯 ID Plan`](../separate-domain-ids-from-storage-details/) 建立的存储无关 ID，不重新暴露 `.md`、`changes/` 或其他路径细节。

## Scope

### Intended Change

扩展 `tools/index-runtime` 的同步类型、比较算法、诊断与结果 envelope，并在 Decision Records、Investigation Report、Test Evidence 的 `sync-index` CLI/SDK 中公开可重复 `--id` 选择；复用完整 projection、校验、漂移检测和原子写入，不实现按 ID 的局部来源读取或持久化半新鲜索引。

### Resulting Impacts

- shared runtime 必须严格读取旧索引作为 selected baseline，并能区分 entry 变化、per-ID source revision 变化与集合级 metadata 变化。
- 三个领域需要在 CLI 参数、领域 ID 校验、结果输出、固定契约、生成声明和测试中公开相同选择原则，同时保留各自来源验证和 mutation/lock 边界。
- 当前全量 `sync-index` 行为、查询时的新鲜度要求和 `stage-index` 的 Git pending 语义不能被 selected sync 弱化或合并。
- Task Graph 的 JSON 是权威状态而非从领域来源重建的派生索引；Change Plan 当前没有同类派生索引，二者不增加 `sync-index --id`。

## Success Criteria

1. 三个领域均可通过一个或多个纯 ID 执行 check/write scoped sync；无 `--id` 的全量行为保持兼容。
2. 只有 selected ID 变化时，write 成功且生成索引与对完整当前来源做全量重建的规范字节完全相同。
3. 存在任一 unselected ID 变化、集合 metadata 变化或非法 baseline 时，命令零写入失败并返回稳定、可行动的诊断。
4. 新增、修改、删除、rename、未变化选择、未知选择、重复/非法 ID、来源构建漂移和原子写入失败都有直接测试。
5. scoped sync 不读取 Git revision、不修改 pending，也不被误称为 `stage-index`；选择性 staging 继续只处理已经生成的工作区索引。
6. 共享 runtime、三个 skill 契约、源码、生成产物、类型/Schema、最小原生测试入口与 Test Evidence 账本一致，主仓库检查通过。

## Affected Owners

- `tools/index-runtime/` 的同步 API、类型、比较/序列化、诊断、README 与测试。
- `tools/decision-records/`、`skills/decision-records/`、`scripts/build/decision-records.ts` 及生成 CLI/声明。
- `tools/investigation-report/`、`skills/investigation-report/`、`scripts/build/investigation-report.ts` 及生成 CLI/声明。
- `tools/test-evidence/`、`skills/test-evidence-review/`、`scripts/build/test-evidence.ts` 及生成 CLI/声明。
- `docs/test-evidence/` 的最小原生测试 case 与统一派生索引。
- `changes/separate-domain-ids-from-storage-details/` 的前置纯 ID 契约。
