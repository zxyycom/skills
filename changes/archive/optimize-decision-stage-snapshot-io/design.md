# Design

本设计把性能修复组织为“批量取得 revision 快照、完整构造领域目标、锁内复用 pending entries、只在变化时发布”四个阶段，使实现者无需在性能与正确性之间自行补造取舍。

## Context

- [`stage-selected-decisions-by-stable-id.md`](../../docs/decisions/stage-selected-decisions-by-stable-id.md) 是 Decision Records stage 语义 owner：目标必须以 revision 完整集合为基线，只叠加显式 Decision ID 的 filesystem 状态，并从完整目标 Markdown 重建统一索引。
- [`manage-pending-snapshot-writes.md`](../../docs/decisions/manage-pending-snapshot-writes.md) 是 pending 写入 owner：共享版本管理层负责锁、一致性前提、完整范围替换、实际写入读回和恢复；Git object ID、index entry、模式和命令不能越过共享边界。
- [`tools/shared/version-control.md`](../../tools/shared/version-control.md) 当前因过去没有现实消费者而未提供批量 revision 内容读取。Decision Records 已经形成明确需求：`readDecisionBaseline` 先列出完整范围，再逐文件读取同一 revision。
- 隔离复现已经把首要成本定位到 Git N+1：revision 基线按文件重复解析 revision、查询 tree 和读取 blob，pending 目标又按文件创建 blob；完整领域校验不是本 Change 的退出对象。
- 本设计使用 `N` 表示目标 pending 决策范围内的文件数（包含索引），使用 `K` 表示无法从锁内当前范围复用、因而需要创建新 blob 的目标文件数。完整领域构造仍是 O(N)；目标只要求 Git 子进程从 O(N) 收敛为 O(1 + K)。

优化前与目标数据流：

```text
优化前: revision paths -> N × (resolve + tree + blob) -> complete target
        -> lock -> N × hash -> optional index write -> readback

目标: revision scope -> list paths/filter derived index -> one resolve/tree + blob batch -> complete target
      -> lock/expected checks -> reuse unchanged entries + K × hash
      -> no-op return OR one index write -> readback
```

## Goals / Non-Goals

目标：

- 让实现者能够从本文恢复受保护语义、优化边界、阶段依赖和可检查的性能出口。
- 保留完整 revision 基线、显式选择、完整索引重建、所选来源复核、锁内 CAS、范围隔离、实际写入读回和恢复。
- 为真实批量消费者建立不泄漏 Git 表示的共享 revision snapshot 能力。
- 让 unchanged 目标不写 Git index，让 changed 目标只为 K 个不可复用文件创建 blob。
- 以进程调用复杂度作为稳定门禁，以墙钟数据说明收益和平台边界。

非目标：

- 不减少完整 Decision Markdown 的领域校验，不把未选择 filesystem 内容作为目标输入，也不使用持久索引代替权威 Markdown。
- 不拆分 `decision-index.json`，不建立增量索引、缓存数据库、常驻 Git 进程或新的索引兼容版本。
- 不改变 stage CLI、选择身份、pending 冲突、恢复错误或生命周期语义。
- 不把 Git tree entry、object ID、文件模式、index 路径或锁加入公共版本管理类型。
- 不用无界进程并发掩盖线性调用数，不因 Windows 症状扩大为新的 CI 平台矩阵或多版本管理后端框架。

## Decisions

### Intended Change

1. **建立批量 revision 内容边界。** 在 `VersionControlRepository` 增加 `readRevisionFiles(revision: RevisionId, options?: ListVersionControlFilesOptions): Promise<VersionControlFile[]>`。`pathScopes` 沿用现有字面仓库相对路径语义：省略或传入空数组表示整个 revision，没有匹配文件时返回空数组；结果按规范仓库路径稳定排序。Git 实现只解析一次 revision，以一次递归、NUL 分隔的 `ls-tree` 取得路径、模式和 object ID，接受 `100644`、`100755` 与 `120000` blob，拒绝 Gitlink、非 blob 和异常记录，再调用现有 `readGitBlobs` 一次读取全部唯一 blob 并映射回文件。缺失 blob 或 Git 失败保持 `operation-failed`。现有单文件和仅列路径操作继续保留，并与批量结果对账。
2. **让 Decision Records 只消费批量公共语义。** `readDecisionBaseline` 先列出 decision scope 路径并排除 `decision-index.json`；若过滤后没有 Markdown 路径，直接返回空基线，不能把空 `pathScopes` 传给批量读取而读取整个 revision。否则通过一次批量内容操作读取剩余 Markdown，验证每个路径可映射为唯一 Decision ID，并沿用现有 UTF-8 解码、稳定排序和 Markdown 来源构造。先过滤保持派生索引不作为 Markdown 基线输入；后续选中 filesystem overlay、完整关系校验、索引生成/回读及选中来源二次复核不变。
3. **在锁内按目标内容复用 Git entry。** `replacePendingFiles` 复制 index 并完成 current revision、expected 成员、普通文件表示和字节核对后，以当前 stage-0 entries 与已读取文件建立路径映射。只有 entry 模式为目标普通非可执行模式、路径相同且字节等于目标时才能复用；删除目标不创建 blob，其他目标文件继续通过 `hash-object -w` 建立普通文件 entry。比较和复用只存在于 Git 实现内部。
4. **明确无变化与实际写入分支。** 目标 entries 构造完成后，若与锁内当前 entries 完全相同，则不调用 `update-index`，不执行只用于验证新写入的第二次读取，也不以锁副本替换当前 index；操作清理锁文件并返回与公共契约一致的成功结果。若 entries 不同，则继续一次 index 更新、写后 entry/字节读回、原子 rename 和现有恢复流程。两条分支都必须先完成锁内 revision 与 expected files 核对。
5. **用复杂度证据固定退出。** Git 集成测试使用只在目标操作期间计数的可控 Git executable 或等价注入点，分别建立 150/300 文件的 unchanged 与单 Decision 修改场景。门禁使用 proposal 的 20/25 次上限并同时证明目标内容；不得把 fixture 初始化、commit 或结果审阅命令计入 stage 调用数。实施记录优化前后调用直方图和同机墙钟，真实 Windows 复测仅在环境可用时补充，不阻塞由平台无关复杂度已经证明的结果。

### Resulting Impacts

| Owner | 必要影响 | 验证责任 |
| --- | --- | --- |
| 共享版本管理公共接口 | 增加批量 revision 内容读取；公共值仍只有 revision、路径与字节 | 类型检查；全 revision、无匹配、单/多 scope、顺序、模式、SHA 和失败测试 |
| Git revision reader | 共享 tree 解析和一次 batch blob 读取，消除逐文件重复解析 | 与现有单文件/路径列表结果对账；异常记录与对象缺失失败 |
| Git pending replacement | 复用安全 entry，分开 no-op 与 actual-write 发布路径 | expected/CAS、普通文件限制、范围隔离、readback、恢复和并发测试 |
| Decision Records stage | 过滤派生索引路径后批量读取完整 revision Markdown，其余领域流程不变 | 增删改移、未选择变化隔离、完整索引、来源漂移和规模调用数 |
| 分发制品 | 共享源码可能进入 Change Plan、Decision Records、Investigation Report、Task Graph 与 Test Evidence bundle；只同步实际受影响产物 | 对五个 consumer 运行各自 sync/check；版本承载变化时提升对应 skill 版本 |
| Test Evidence | 修改后的最小测试节点需要对应权威 case | 单 case 文件、topic 映射与派生索引一致 |

既有两条 active + aligned 决策已经完整拥有“稳定 ID 构造完整快照”和“共享层管理 pending 写入”。当前方案只改变这些契约内部的批处理与等价结果发布，不新增长期方向。实施若发现必须放宽 expected/readback/recovery 或向公共接口暴露 Git 表示，先停止并重新审阅长期决策，而不是把偏离隐藏在性能优化中。

## Risks / Trade-offs

- **公共接口扩张：**批量读取增加共享维护面。真实 Decision Records 消费者和通用 revision/path/bytes 结果使该能力归属成立；接口不接收 Decision ID，也不返回 Git entry。
- **tree 批处理语义漂移：**递归 tree 记录可能包含可执行文件、符号链接或 Gitlink。实现必须与现有 revision 读取可接受模式对账，对无法表示的对象整体失败，不能静默跳过。
- **错误复用文件模式：**相同字节不代表相同目标表示。复用同时要求 stage 0、目标普通非可执行模式和同路径；否则重新创建目标 entry。
- **no-op 跳过必要检查：**快路径只能跳过“实际写入之后才需要”的发布与读回，不能跳过锁、current revision、expected entries/files 或目标 entries 构造。
- **调用计数测试耦合实现：**精确命令名可能演进，因此门禁约束总调用上限和结果，不固定一份永久命令序列；失败测试继续验证公共语义。
- **领域 O(N) 仍存在：**完整 Markdown 和索引构造仍随集合增长。完成本 Change 后若同机分阶段证据表明领域计算成为主要瓶颈，再建立独立 Change；本次不预建增量协议。

## Open Questions

无。公共批量读取已有现实消费者，安全复用和 no-op 的前提已明确，性能与正确性均有可执行验收。
