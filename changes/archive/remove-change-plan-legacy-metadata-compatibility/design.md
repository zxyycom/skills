# Design

以一次性数据迁移换取单一 strict metadata 边界，使 active stage 的磁盘事实、类型和查询结果完全一致。

## Context

本 Change 建立时的实现基线如下：

- 规范 `changePlanMetadataSchema` 已只接受 Draft 与非空基线 Plan，writer 也只写这两种结构。
- 内部 `activeChangePlanMetadataSchema` 当时额外接受 implementation、shelved 和 null-base Plan；`readActiveChangePlanMetadata` 把前两者投影为 Plan，并让 checker 对 null-base Plan 保留 `stage: plan`、`metadata: null` 的特殊组合。
- 该兼容边界当时同时进入 checker、catalog、CLI plan、Git-distance 类型、测试 fixture、测试证据和三个长期文档 owner。
- 仓库当时仅有 `check-all-change-plans` 使用 implementation，`establish-task-correction-and-successor-evolution` 使用 shelved；两者都能按投影后的 Plan 通过检查。Archived Change 的 metadata 不参与读取。

## Goals / Non-Goals

目标：

- 让所有 active metadata 读取共享唯一 strict runtime schema，并让公共 stage 与磁盘 stage 一致。
- 删除兼容输入引出的类型、投影、null-base 距离和写入恢复分支。
- 迁移当前仓库全部已知旧 active metadata，使严格 reader 启用后现有 Change 集合仍可检查。
- 用原生测试证明旧输入失败、目标不被写入、无效成员仍可发现，并同步唯一测试证据 case。

非目标：

- 不为仓库外旧数据提供自动迁移、兼容期限或版本协商。
- 不改变 Draft/Plan/Archive 生命周期、tasks 三个区段、Git 距离算法、六个命令或 archived metadata 边界。
- 不借迁移刷新旧 Change 的基线、修改 artifacts、完成任务或归档。

## Decisions

### Intended Change

本 Change 采用一项核心调整：规范 metadata schema 成为 active stage 磁盘事实、runtime 类型、reader 与 writer 的唯一边界。

#### 单一 metadata schema 与 reader

- 删除 `legacyShelfSchema`、`activeChangePlanMetadataSchema`、`ActiveChangePlanMetadata` 和 `readActiveChangePlanMetadata`。
- Checker 直接调用 `readChangePlanMetadata`；stage 和 metadata 都来自同一个规范解析结果，不再需要 `canonicalMetadata` 投影。
- `inspectPlanVersionControl` 的 `baseCommit` 收窄为非空字符串；仓库没有 `HEAD` 仍使用既有不可用结果，不与旧 null-base metadata 混合。

该边界不改变 Draft/Plan/Archive lifecycle、tasks 三个区段、Git 距离算法、六个命令或 archived metadata 的不解析边界；也不建立迁移命令、schema version、兼容开关或弃用期。

### Resulting Impacts

下列处理都由单一 strict metadata 边界直接引起，并且是保持现有 Change 集合可维护、可验证所必需的实施影响。

#### 旧输入使用普通无效路径

- implementation、shelved、含 shelf 的对象、null-base Plan 和任何其他未定义字段都由 strict schema 拒绝。
- `list` 继续把目录作为 invalid active member 返回，stage 与 metadata 为 `null`；`show`、`check` 和 `check-all` 使用既有 `invalid-metadata` 诊断及领域失败退出。
- `plan` 只从 checker 返回的规范 Draft 或 Plan 开始；旧输入得到 `invalid-source-stage`/既有诊断，`archive` 也因无效 metadata 失败，不增加迁移命令、别名或旁路 parser。

#### 当前仓库数据一次性迁移

- `check-all-change-plans` 从 implementation 改为 Plan，原 `baseCommit` 不变。
- `establish-task-correction-and-successor-evolution` 从 shelved 改为 Plan，原 `baseCommit` 不变并删除 shelf。旧 shelf 原文仍保留在 Git 历史中，但不再占用当前 active metadata 契约。
- 迁移只改变 metadata 形状，不表示重新审阅 Plan，也不改变 tasks、Git 距离或归档授权。

#### 决策、文档和版本

- 用 `require-canonical-active-change-metadata` 完整后继修订已对齐的生命周期决策，承接 Draft/Plan/Archive 与六命令方向，并明确 active metadata 不提供旧状态兼容。
- 后继先以 `active + unaligned` 建立；只有严格 reader、数据迁移、文档、测试、证据和生成产物全部成为当前事实并通过验证后才标记 aligned。
- 固定 contract 删除兼容章节和所有投影结果；SKILL、人类介绍与 agent 入口只保留严格契约摘要。分发内容变化使 change-plan 独立版本递增。

#### 测试与证据重组

- 删除专门证明 legacy rewrite 的原生 lifecycle 入口及其 case。
- 将 metadata、check、catalog 和 CLI 的保留入口改为证明 strict rejection、invalid member discoverability 与无写入失败；不为每种旧 stage 建立重复入口。
- 若保留入口的测试意图或定位变化，同步其唯一 case；原生入口增删后同步统一派生索引。

## Risks / Trade-offs

| 风险或取舍 | 控制 |
| --- | --- |
| 仓库外仍有旧 active metadata 的项目升级后会立即失败 | 这是本次明确选择；诊断指向 `.change-plan.json`，维护者显式改写为 Draft 或带有效基线的 Plan，不增加永久兼容层 |
| 旧 shelved reason 从当前文件消失 | shelf 已无运行语义，历史仍由 Git 保存；不把它迁入新的长期 owner |
| `plan` 不再作为旧 metadata 的恢复命令 | 避免隐藏兼容旁路；先显式修复 metadata，再按正常语义审阅决定是否运行 `plan` |
| 修改多个测试内的旧 fixture 可能掩盖原生入口变化 | 先按测试意图区分删除、保留和改写，再一一同步 test-evidence case 与索引 |
| 工作区并行内容不属于本 Change | 按路径归属审阅 diff，不执行整仓 stage/reset，也不借用其他改动证明本 Change 的验证结果 |

## Open Questions

无。严格输入范围、两个迁移目标、失败行为、决策演进、测试证据和生成边界均已确定。
