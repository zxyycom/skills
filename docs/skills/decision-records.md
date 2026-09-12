# Decision Records

`decision-records` 保存会长期影响后续选择的判断：**采用什么方向、为什么采用、适用边界，以及如何演进**。它让后来者恢复取舍理由，并区分当前基线、已确认的未来方向与历史判断。

本页是人类的定位入口。Agent 从 [SKILL.md](../../skills/decision-records/SKILL.md) 开始执行；代码、配置、规范和项目文档仍提供当前事实，任务进度与执行日志由当前任务承接。

## 什么值得记录

当一项判断持续影响行为、责任边界、兼容性、风险处理或验收，且未来需要回放采用理由时，适合形成决策。最小对象是一条能整体独立修订、替代、归档和判断对齐的长期判断。

普通事实、一次性任务和执行结果不需要因此成为决策。普通工作形成重要取舍时，可以先提出候选；记录与实施分别服从当前授权。

## 怎样理解记录状态

| 状态 | 含义 |
| --- | --- |
| `candidate` | 尚未建立的候选；`alignment` 与 `createdAt` 为 `null`，留在正式索引外，先完成正文和审核。 |
| `active` | 已建立且仍须在当前工作中恢复的判断。 |
| `archived` | 已建立但退出当前依据的历史判断，保留最后对齐状态和演进历史。 |

已建立记录的 alignment 必为 `aligned` 或 `unaligned`。对 active 而言，前者是已经核对的当前事实，后者是约束相关选择的已确认未来方向；后者仅在当前任务明确纳入交付时实施。archived 只保留最后一次核对时的状态，不能据此断言其方向今天仍适用。candidate 的 `null` 只表示尚未建立。完整字段与动作规则见[决策记录规则的生命周期与对齐](../../skills/decision-records/references/decision-record-rules.md#生命周期与对齐)。

CLI readiness 只说明结构与正文准备情况。一般语义审查、记录选择和委托内取舍由 agent 自行完成；超出范围、缺少关键判断或明确要求人工确认时才询问，删除等高风险操作仍需精确授权。

## 怎样演进

候选收敛、原判断误述或理由补足在原记录完善。真实采用方向改变且前后均有独立回放价值时，才形成自包含后继；独立新判断可以不与旧记录建立关系。Git 提交、同主题或出现纠正本身不足以证明演进，具体边界见[决策记录规则](../../skills/decision-records/references/decision-record-rules.md#记录边界与有效演进)。

一个记录包含多个可独立演进的方向时，应拆分为自包含后继，而不是标记“部分对齐”。已对齐记录与当前事实偏离时，需要报告一致性问题；新的未来目标另行表达。

建立或调整直接关系时，用简短摘要说明后继对该前序具体保留、改变或承接了什么，让演进图同时表达连接与变化含义。

生命周期、关系和身份维护通过领域 CLI 完成。归档保留历史；明确剔除记录时使用独立删除动作。工具需要额外确认或无法完整恢复时，应停在其报告的边界，按维护规则继续。

## 维护已建立集合

升级到要求非空 alignment 的 definition 前，先核对全部 active 与 archived Markdown 都有 `aligned` 或 `unaligned`，并保留 Git 中可恢复的基线。再用严格 `check` 区分合法来源、索引问题和非法 alignment。来源合法而 definition 过期时，按[索引恢复](../../skills/decision-records/references/maintenance-recovery.md#索引恢复)全量重建并复验。缺失或非法 alignment 时，停止集合维护，按[原位字段恢复](../../skills/decision-records/references/maintenance-recovery.md#已建立-alignment-无效)确认历史证据和针对性授权；不要把生命周期操作、旧索引或默认值当作恢复手段。

## 从哪里开始

- 查找既有判断：已知 ID 或唯一 name 用 `show`，按分类、状态或关系浏览用 `list`，按主题发现用 `search`，追溯演进用 `trace`。关系条件下的 list/search 另返回导致命中的 `filterRelations`，与文本命中证据分开；普通发现不展开全部关系。
- 阅读演进切片：`trace` 默认同时追溯两个方向、深度 5、最多 50 条记录；`--json` 获取同一份查询成功结果的 JSON 索引切片。终端图只展开切片内部边，已读取但缺少摘要会标记，context 只为闭合事件加入。以 coverage、frontier 和可选 blocked event 判断是否要扩大范围重查，不把切片外关系视为缺失。
- 起草或维护：[Skill 入口](../../skills/decision-records/SKILL.md)负责判断、流程与交付；[决策记录规则](../../skills/decision-records/references/decision-record-rules.md)负责身份、正文、生命周期、关系与维护约束。
- 获取命令参数：本仓库使用 `bun run decision-records -- --help`。
- 遇到工具、索引或写入异常：按[状态与维护恢复](../../skills/decision-records/references/maintenance-recovery.md)处理。
