---
status: active
alignment: aligned
createdAt: 2026-07-22T09:44:09Z
---

# 使用字段化对齐状态命令

## 索引摘要
- 目的: 让查询和状态命令显式维护对齐字段，并用决策与实际 owner 的比较验证状态变化。
- 背景: 对齐关系属于 Markdown 元数据；让命令依赖专门正文结构会把事实比较误写成存储契约。
- 决策: activate 显式设置 alignment，mark-aligned 只更新字段，check 校验结构与投影；正文不随对齐状态分叉。

## 目的
- 让每个 CLI 命令的名称、参数和实际状态变化直接对应，不从正文、关系或索引默认值猜测对齐状态。
- 让日常查询同时看到已对齐和尚未对齐的活动决策，并能按任务需要筛选。
- 让标记已对齐建立在完整决策与实际行为 owner 的事实核对上，而不是状态写入或专门章节的存在上。

## 背景
- 一项活动决策已经生效，但当前实现可能尚未达到要求；查询需要同时显示生命周期和对齐关系。
- Markdown frontmatter 是对齐字段的事实源，JSON 索引只提供查询投影。
- 当前差距属于决策与实际 owner 的比较结果，不是 CLI 需要解析和长期维护的另一套正文格式。
- 修订、替代、判定无效和归并只表达判断演进，不承担生命周期或对齐状态切换。

## 决策
- 采用: `list` 默认返回全部活动决策，包括 `aligned` 和 `unaligned`；`--alignment aligned|unaligned|all` 可与主题和生命周期筛选组合。
- 采用: `list` 和 `trace` 同时显示生命周期与对齐状态；`show` 在完整 Markdown 前显示路径、生命周期、对齐状态、创建时间和临时 `pending` 标记。
- 采用: `activate <path> --alignment aligned|unaligned` 首次激活或重新激活决策；首次激活写入 `createdAt`，命令成功后活动记录立即生效。
- 采用: `aligned` 和 `unaligned` 候选使用相同正文结构；`activate` 只校验显式 alignment 字段，不从正文推断差距或完成条件。
- 采用: `mark-aligned <path>` 只允许活动决策从 `unaligned` 变为 `aligned`；调用前由人类或 agent 将完整决策与当前实现、行为 owner 和事实比较，CLI 不把状态写入当作实施行为。
- 采用: 不提供把已建立的 `aligned` 决策改回 `unaligned` 的日常命令；事实偏离按一致性问题处理，新的未来方向通过新决策表达。
- 采用: `archive <path...>` 把决策设为 `archived` 并把 alignment 设为 `null`；它不改变其他记录，也不根据关系隐式激活后续决策。
- 采用: `sync-index --write` 从全部决策 Markdown 完整重建索引，alignment 只原样投影；`check` 校验元数据组合、正文结构、投影和关系图。
- 采用: 路径尚未进入 Git `HEAD` 的记录只在查询输出中临时标记为 `pending`，不把 `pending` 写入决策文件或索引。
- 采用: 所有状态命令在写回前构建并验证完整候选 Markdown 与索引，失败时恢复原文件；关系本身不改变生命周期或对齐状态。

## 关系
- 修订: [使用对齐感知的决策命令](use-alignment-aware-decision-commands.md)
