# Tasks

本清单按“契约与 Schema → mutation → find service → CLI/SDK → owner 与生成物 → 测试证据”的顺序实施 `task-000008`。完成出口是 tags/find 公共行为、分发产物、长期 owner 和可独立检索测试证据在同一集成基线上互相一致。

## Readiness

- [ ] 0.1 复核 proposal、design 和 tasks 指向同一产品结果：tags 只用于发现，find 只定位 task，完整拓扑和详情继续分别由 `task list`、`task show` 拥有。
- [ ] 0.2 确认 `skills/task-graph/SKILL.md`、`docs/skills/task-graph.md`、task-graph 长期决策、`tools/task-graph/src/`、生成链和 test-evidence 是准确 owner，且没有第二份接口或 Schema 真源。
- [ ] 0.3 确认单个 tag token、每 task 最多 5 个 tags、可选持久化字段、create 输入、全量 update-tags、clear、同值 replacement、全部 execution phase、`updatedAt`、update-content 保留和 schema v2 兼容契约没有歧义。
- [ ] 0.4 确认 design 没有 Open Questions，并确认 find 的四类 singleton 条件、非空输入边界、单 tag 限制、交集、默认 `idle`/`running`/`failed`、completed opt-in、包含非空 result summary 的文本字段、空结果、返回形状和固定 task ID 排序没有歧义。
- [ ] 0.5 从中央 task graph 和当前 Git 状态确认 task-000040 的 result/版本语义已经集成，并确认 task-000037 没有并行修改相同 task-graph 核心 owner；存在重叠时先协调串行顺序，不自行 claim 或改写关系。
- [ ] 0.6 检查目标路径现有 diff，确认没有来源不明的重叠改动；基于最新集成版本决定 task-graph CLI minor version、skill metadata version 和决策索引基线。

## Implementation

- [ ] 1.1 在 `tools/task-graph/src/types.ts` 和 `schema.ts` 增加可选 canonical `content.tags`、tag token 与最多 5 个 tags 校验、`CreateTaskContentInput`、`update-task-tags` operation、`FindTasksOptions` 与 `TaskFindMatch`，保持 `UpdateTaskContentOperation` 不接受 tags、schema v2 旧索引可读，并从 Valibot 生成一致 JSON Schema。
- [ ] 1.2 在 engine 中实现 update-task-tags 的全量 replacement 与 clear：验证 task 和 tags、允许全部 execution phase、只更新 tags/`updatedAt`，并调整 update-content 使其保留现有 tags；保持 apply alias、revision、拓扑保护和 canonicalization 行为正确。
- [ ] 1.3 在 `TaskGraphService` 中实现一次 index 快照上的 `findTasks`；按 design 固定条件校验、默认 phase 集合、交集、空结果和 task ID 排序，不计算 projection 或访问第二数据源。Tags mutation 只进入既有 `apply`，不增加 service 便利方法。
- [ ] 1.4 在 CLI help 与 dispatch 中增加 `task create --tag`、`task update-tags` 和 `task find`；分别校验 mutation 多个不同 tag 与 find 单 tag，保持 update-tags 的 native runtime 门禁和 find 的只读边界，并复用标准 JSON envelope。
- [ ] 1.5 更新 task-graph 公开导出与协议 minor version；运行生成链同步 `skills/task-graph/scripts/task-graph.mjs`、source map、SDK 声明树、顶层声明和 `references/task-graph-index.schema.json`，只在现有生成闭包确实不足时修改 `scripts/build/task-graph.ts`。
- [ ] 1.6 更新 `skills/task-graph/SKILL.md`、`docs/skills/task-graph.md` 和 skill metadata version，使 tags 生命周期、update-tags、find 默认集合、CLI/SDK 责任及非目标与实现一致，不在行为说明中复制完整源码类型。
- [ ] 1.7 新增 task-graph 长期决策并同步 `docs/decisions/decision-index.json`，只记录 tags 作为发现元数据、直接扫描权威 index 和不建立搜索平台的长期理由；基于 task-000040 的已集成内容处理 decision index 与文档冲突。
- [ ] 1.8 为新增或修改的每个最小原生测试入口各维护一个 `docs/test-evidence/` case，并同步统一派生索引；测试实现与 case 一一对应，不用聚合 runner 代替独立证据。

## Verification

- [ ] 2.1 用 Schema 与 canonical serialization 测试覆盖：旧 index 无 tags、合法中文/ASCII tag、1/64 token 边界、每 task 5 个通过与 6 个失败、非法空白或 shell 字符、前导 `-`、缺少字母数字、超长、重复值、排序和空集合省略。
- [ ] 2.2 用 engine/store 测试覆盖：create tags、batch alias、全量 replacement、同值 replacement、clear、revision conflict、task 不存在，以及 `idle`、`running`、`succeeded`、`failed`、`cancelled` 全 phase 更新；确认非法 replacement 不消费 revision，claim、renew、release、complete、fail、retry、cancel、update-content 及基线已经存在的 reopen 都保留 tags，其他 content/state/lease 不变，成功 mutation 的 revision/`updatedAt` 符合既有规则。
- [ ] 2.3 用 service 测试分别覆盖 ID 精确、title 子串、tag 精确、text 对 title/goal/acceptance/context/result summary 的匹配与 references/tags 排除、title 120/121 与 text 2000/2001 的长度边界、空值和首尾空白、组合交集、至少一个条件、默认 phase、精确 ID 仍服从默认过滤、includeCompleted、title 重名、零结果和固定 task ID 排序。
- [ ] 2.4 用 CLI 测试覆盖 create/update-tags/find 的 help 与 argv：mutation 多 tag、重复值、clear 互斥和缺失输入，find 单 tag/重复 tag、completed flag、标准 JSON result，以及 find 不加载 native runtime、update-tags 需要 mutation runtime。
- [ ] 2.5 用公开源码导出、生成 SDK 声明和分发 bundle 测试验证 `CreateTaskContentInput`、`UpdateTaskTagsOperation`、`FindTasksOptions`、`TaskFindMatch`、`findTasks`、协议版本和运行结果一致；验证 serialize/parse round trip 与 `index stage` 保留 tags，运行 `bun run sync:task-graph-cli` 后确认 `bun run check:task-graph-cli` 无漂移。
- [ ] 2.6 运行 `bun run test:task-graph-cli`、`bun run check:task-graph-index` 和 `bun run validate-skill -- skills/task-graph`，确认目标源码、native transaction、当前中央 index 兼容性和 skill 结构通过。
- [ ] 2.7 运行 test-evidence 的同步与检查，确认每个新增或修改测试入口都有唯一 case 且派生索引为当前状态；记录实际命令和结果。
- [ ] 2.8 运行 `bun run check`，必要时按仓库约定补充 `bun run check --full`；审查最终 diff 只涉及 proposal 允许的 owner，没有引入 tag registry、第二索引、通用搜索协议、任意状态过滤或 task-000037 的成功重开语义。
- [ ] 2.9 仅依据三个 artifacts 和其中指向的稳定 owner 做一次实施阅读复核：实施者必须能恢复 tags 权威位置与生命周期、create/update 契约、find 查询与默认集合、CLI/SDK 分工、兼容边界、冲突顺序和完成证据，且不能再依赖本次对话补充产品判断。
