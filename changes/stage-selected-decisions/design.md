# Design

本设计说明如何从指定 `filesystem` 决策构造完整、可校验的 `pending` 决策快照，并通过共享版本管理层替换受控范围；设计不改变决策生命周期或持久索引的事实来源。

## Context

- [按指定决策构造待提交快照](../../docs/decisions/decision-records/stage-selected-decisions.md)拥有独立命令、显式选择和同源完整索引的长期方向。
- [由共享版本管理层承接待提交快照写入](../../docs/decisions/version-control/manage-pending-snapshot-writes.md)拥有受控范围替换、底层隔离和失败恢复的长期方向。
- [决策记录领域契约](../../skills/decision-records/references/decision-record-rules.md)规定决策 Markdown 与 `decision-domains.json` 是权威来源，`decision-index.json` 是从完整已建立决策集合生成的派生查询快照。
- [版本管理中间层](../../tools/shared/version-control.md)当前提供 `revision`、`pending` 和工作区读取，公共接口尚不提供 `pending` 写入。两条新长期决策均为 `active + unaligned`，因此这里描述的是待实现目标，不是当前行为。

本 design 固定使用以下术语：

| 术语 | 在本 change 中的含义 |
| --- | --- |
| `revision` | 命令运行时的当前已提交不可变版本，也是目标决策集合的默认基线。 |
| `filesystem` | 命令运行时磁盘上的决策集合；它可以同时包含多个尚未进入 `revision` 的变化。 |
| `pending` | 准备进入下一版本的完整版本管理快照；当前实现可由 Git index 承载，但公共语义不依赖该实现。 |
| 决策源集合 | `decision-domains.json` 与全部已建立决策 Markdown；完整索引从这批来源派生。 |
| `pending` 决策范围 | 决策根内的领域目录表、全部已建立决策 Markdown 与完整派生索引；该范围作为一个整体被替换。 |

- `activate`、`evolve`、`archive` 等生命周期命令直接修改 `filesystem` 决策文件，并在同一可恢复事务中同步 `filesystem` 索引；它们不读取、维护或区分 `pending`。
- 当前索引生成路径从 `filesystem` 读取来源。为了生成不同于 `filesystem` 完整集合的 `pending` 索引，同一解析、投影、`sourceRevision` 和序列化路径需要能够消费内存中的目标来源快照。
- `decision-index.json` 的 `sourceRevision` 覆盖领域目录表和全部已建立决策 Markdown，因此聚合索引的部分差异不能独立表达一个合法的待提交决策集合。

## Goals / Non-Goals

目标：

- 让调用者通过独立命令显式选择要进入 `pending` 的决策变化。
- 让目标 `pending` 决策源集合只由 `revision` 基线和指定 `filesystem` 路径确定，不受其他 `filesystem` 或既有 `pending` 决策变化影响。
- 让 `pending` 中的决策 Markdown、领域目录表和完整索引来自同一目标来源，并在写入前通过完整校验。
- 让共享版本管理层拥有范围替换、路径约束、底层写入和失败恢复；decision-records 只拥有目标决策语义。
- 保持 `filesystem` 与 `pending` 决策范围外内容不变，并保留生命周期命令现有责任。

非目标：

- 不改变决策的候选、建立、生效、对齐、归档或演进语义。
- 不让 `pending` 或提交历史成为决策成员、生命周期或索引成员的事实源。
- 不从关系图、文件时间、版本差异或最近命令自动推断选择集。
- 不在本 change 中提供领域目录表的局部选择、通用提交编排、索引分片或多后端框架。
- 不把“公共边界不暴露底层信息”解释为已经支持多种版本管理系统；当前实现只需支持 Git。

## Decisions

以下选择只展开当前 change 的实现语义；若实施需要改变长期 owner、独立命令或显式选择方向，先演进对应长期决策，再同步本 design。

1. **命令入口与输入**：新增独立命令 `decision-records stage <decision-path...>`。命令至少接收一个决策根相对 POSIX Markdown 路径，拒绝重复路径、非法路径、决策根外路径、领域目录表和索引路径。它不读取此前命令历史，也不是生命周期命令的选项。
2. **单路径变化解释**：每个指定路径只由它在 `revision` 与 `filesystem` 中的存在性确定：

   | `revision` | `filesystem` | 目标变化 |
   | --- | --- | --- |
   | 不存在 | 存在 | 新增 `filesystem` 内容 |
   | 存在 | 存在 | 用 `filesystem` 内容替换 |
   | 存在 | 不存在 | 删除 |
   | 不存在 | 不存在 | 输入无效，命令失败 |

   重命名由调用者同时选择旧路径的删除和新路径的新增；命令不推断重命名。
3. **目标来源构造**：目标决策源集合等于完整 `revision` 决策源集合叠加且仅叠加指定路径的 `filesystem` 状态。既有 `pending` 不参与构造；未指定决策使用 `revision` 内容，其他 `filesystem` 变化保留在磁盘。完整替换后，决策范围内未指定的既有 `pending` 变化因此恢复为 `revision`。
4. **领域目录表**：存在 `revision` 决策基线时，目标来源固定使用其中的 `decision-domains.json`，忽略该文件的 `filesystem` 与既有 `pending` 变化。没有决策基线时，首次集合才从 `filesystem` 读取完整合法的领域目录表。指定决策依赖目标目录表中不存在的领域时，命令在写入前失败；首版不合并或局部选择目录表变化。
5. **索引生成与预写校验**：`filesystem` 和既有 `pending` 中的 `decision-index.json` 都不作为输入。decision-records 让现有领域解析、投影、关系校验、`sourceRevision` 和确定性序列化路径消费内存目标来源，生成完整索引。目标来源与索引在任何 `pending` 写入前通过完整校验；候选、非法关系、无效生命周期组合、陈旧领域归属或遗漏的共同变化均使命令失败，选择集不会被静默扩展。
6. **共享范围替换**：共享版本管理层接收字面仓库相对路径范围、目标文件集合和必要的一致性前提，完整替换该范围并保留范围外 `pending` 内容。操作在应用前保存原范围，应用后读回核对；对可处理失败恢复原范围，恢复不完整时停止并报告恢复边界。当前实现只需支持 Git，Git 命令、index、对象 ID、文件模式、锁和原始错误解析保留在共享层内部；decision-records 不直接回退到 Git。
7. **结果与既有命令**：成功结果列出指定决策、生成的完整索引以及从 `pending` 决策范围移除的其他变化；失败结果区分输入、目标校验、版本管理操作和恢复阶段。退出码使用 `0` 成功、`1` 行为或环境失败、`2` 参数错误。生命周期命令、`sync-index --write` 和普通 `check` 继续只针对 `filesystem`；`stage` 校验并写入自己构造的目标 `pending`，但不修改 `filesystem`。

## Risks / Trade-offs

- 共享版本管理层从只读 `pending` 查询扩展到受控写入，增加了外部状态变化和失败恢复责任；范围隔离、读回核对和故障测试必须证明范围外内容不变。
- `stage` 成功后，`filesystem` 完整索引与 `pending` 完整索引可能有意不同。输出和行为文档必须明确所指快照，避免把合法差异误判为索引漂移。
- 首版不选择领域目录表变化，因此新增领域与决策需要其他明确流程或后续扩展；当前命令拒绝构造依赖 `revision` 目录表之外领域的目标集合。
- 最后一次成功的 `stage` 调用决定 `pending` 中的完整决策范围；并发调用由共享版本管理层的一致性前提和恢复语义约束，不合并不同调用者的选择集。
- 当前实现依赖可用的 Git 环境，但公共契约不泄漏 Git 专属信息；这满足当前消费者，同时不承诺多版本管理系统兼容。
- 每次命令重建完整索引，成本随决策集合增长；它复用既有千级集合索引路径，以正确性和可恢复性优先，不在本 change 建立增量索引协议。

## Open Questions

无。
