# Tasks

本任务清单先确认实施基线与显式 ID 契约，再按 Schema、分配、CLI、稳定 owner、生成产物和证据顺序交付。

## Readiness

- [x] 0.1 核对 proposal、design 与 tasks 指向同一目标，显式列出范围、非目标、稳定 owner 和成功标准。
- [x] 0.2 确认显式 ID 字符集、保留值、自动命名空间、大小写、当前索引占用与删除后复用、alias、`nextTaskId`、Schema v2 与 CLI `3.2.0` 没有阻塞实施的开放问题。
- [x] 0.3 核对 task-000005 与 task-000010 已成功；确认实施以 task-000040 集成后的主线为基线，并与 task-000037 串行。
- [x] 0.4 识别源码、行为说明、生成产物、决策门槛、原生测试和 test-evidence 账本的 owner，确认不直接编辑派生分发文件或索引。

## Implementation

- [ ] 1.1 只在 task-000040 已集成且 task-000037 未在重叠表面实施时同步最新主线；重新读取 task-graph 说明、长期决策、公开 CLI 版本和 skill 版本，任何基线变化若改变本设计则先返回 plan 复核。
- [ ] 1.2 在 task-graph 类型与 Schema owner 中建立自动、显式、联合 task ID 及 apply reference 的单一验证契约，保持 Schema v2，调整 `nextTaskId` 语义并把公开 CLI 版本提升到 `3.2.0`。
- [ ] 1.3 扩展 create operation、engine 与 service，使空闲显式 ID 原样创建、省略或当前索引占用时唯一自动分配、受控删除后同一显式 ID 可用于独立新 task、非法值拒绝、失败事务不消耗水位，且 ordered created IDs 与 alias 始终使用最终实际 ID。
- [ ] 1.4 为 `task create` 增加可选 `--id` 并让全部后续 task 命令、关系、remove 与 `index stage` 使用联合 ID validator，保持现有输出 envelope、parent sentinel 和 alias 语法。
- [ ] 1.5 同步 `skills/task-graph/SKILL.md`、`docs/skills/task-graph.md` 和 skill 独立版本，明确 CLI 裸 token、实际返回 ID、自动 ID 不复用、显式 ID 当前索引唯一、旧 runtime 前向边界和非目标。
- [ ] 1.6 新增自包含的 task-graph 后继决策，以 `修订` 关系指向实施基线中的直接前序，保留权威 JSON 索引、受控删除和无默认历史方向；实现与稳定 owner 对齐后建立为当前基线并同步决策索引。
- [ ] 1.7 通过既有 task-graph 生成入口同步分发 MJS、source map、SDK 声明和 task index JSON Schema，并复核生成内容只来自源码与行为 owner。

## Verification

- [ ] 2.1 用最小原生测试入口证明显式 ID 的长度、字符、保留空间和自动命名空间边界，以及联合 ID Schema、canonical round trip、`nextTaskId` 语义、自动编号不复用和显式 ID 删除后复用。
- [ ] 2.2 用最小原生测试入口证明空闲显式 ID、自动分配、占用回退、同批重复 ID、ordered created IDs、alias 解析和失败事务水位回滚。
- [ ] 2.3 用最小原生测试入口证明 CLI 的 `--id <id>` 与 `--id=<id>`、实际 ID 返回、全部 ID 消费命令和 `index stage` 均接受联合 task ID。
- [ ] 2.4 按一入口一 case 同步 task-graph test-evidence Markdown，并通过统一命令同步派生测试证据索引。
- [ ] 2.5 运行受影响的 task-graph 原生测试、生成漂移检查、决策记录严格检查和 test-evidence 严格检查，确认 source、生成 CLI、SDK 类型、JSON Schema、稳定说明与长期决策一致。
- [ ] 2.6 运行 `bun run check --full`，逐项复核 proposal 成功标准、稳定 owner、版本、生成产物和全部任务证据后再申请归档。
