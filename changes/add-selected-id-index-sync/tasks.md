# Tasks

任务先确认纯 ID 前置契约和三类消费者边界，再实现 shared scoped-sync 门禁、领域 CLI 适配与直接证据，最后通过全量检查证明没有引入半新鲜索引。

## Readiness

- [ ] 0.1 确认 `separate-domain-ids-from-storage-details` 已完成并归档，三个领域的 canonical ID 与索引键均为纯 ID；在此之前不实现临时的 `.md`/路径 selected API。
- [ ] 0.2 审计 shared runtime 与 Decision、Investigation、Test Evidence 的 full sync、来源 revision、领域 lock、结果/诊断和 CLI 参数边界，固定每个消费者的接入点与不受影响的 mutation 路径。
- [ ] 0.3 为 baseline/candidate 的集合字段和 per-ID 字段建立比较矩阵，确认 metadata、entry、revision、新增、修改、删除与 rename 都能被唯一分类。

## Implementation

- [ ] 1.1 在 Index Runtime 中增加显式 full/selected sync scope、规范 selected-ID 校验、扩展结果/诊断类型和 locale 无关排序，不改变 stage result 契约。
- [ ] 1.2 实现 selected baseline 严格读取、完整 candidate 构建、集合 metadata 门禁、entry/revision key-union diff、unselected-change 零写入失败及完整 candidate 原子发布。
- [ ] 1.3 在 Decision Records 的 `sync-index` CLI/SDK、固定契约和输出中接入可重复纯 Decision `--id`，保持完整集合/关系校验和现有 mutation 事务。
- [ ] 1.4 在 Investigation Report 的 `sync-index` CLI/SDK、固定契约和输出中接入可重复纯 Investigation `--id`，保持 collection lock、正式集合/关系/资源校验并排除 candidates。
- [ ] 1.5 在 Test Evidence 的 `sync-index` CLI/SDK、固定契约和输出中接入可重复 Case `--id`，将 topic/集合 metadata 变化限定为 full sync。
- [ ] 1.6 更新 Index Runtime README、三个 skill 行为入口、CLI help、skill 版本、build 适配、生成脚本、公开声明与 Schema，并明确 sync 和 stage 的不同作用。

## Verification

- [ ] 2.1 增加 Index Runtime 最小原生测试，覆盖 selected 无变化、新增、修改、删除、rename、额外未变化选择、未知/重复/非法选择、unselected changes、collection metadata、非法 baseline、来源漂移、中断和写入/回读失败。
- [ ] 2.2 证明 selected write 的规范字节与同一来源的 full rebuild 完全相同，失败路径保持原索引字节不变，full sync 仍可创建或修复 selected 模式拒绝的 baseline。
- [ ] 2.3 分别验证 Decision、Investigation、Test Evidence CLI 的 check/write、文本/JSON 输出、领域 ID 校验、lock/事务边界，以及 `stage-index` 不读取来源且不被 scoped sync 修改。
- [ ] 2.4 逐项维护受影响的 Test Evidence case 与统一派生索引，运行 Index Runtime 和三个领域测试、生成边界检查及 `bun run check`。
