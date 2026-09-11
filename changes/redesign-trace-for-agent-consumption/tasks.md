# Tasks

本清单按“确认当前集成基线 → 建立共享受限选择 → 接入两个领域 → 切换 JSON 消费契约 → 同步文档、生成物和证据”的顺序实施，并以可独立复核的完整 Gate 作为退出条件。

## Readiness

- [x] 0.1 确认产品取舍：默认 direction=both、depth=5、maxRecords=50，maxRecords 合法范围为正安全整数；事件按完整接纳单元处理，字段采用紧凑投影，frontier 只承接续查边界。
- [x] 0.2 复核当前 Decision 与 Investigation 索引规模、关系形状、trace 入口、共享图 owner 和当前源码责任边界，并据此刷新 proposal 与 design。
- [x] 0.3 检查 Git 状态、目标 diff、两个 skill 当前版本和同 owner Changes：工作区只有本 Plan 改动，其他相关 Plans 尚未进入 implementation；后续由本 Plan 独占同 owner 实施批次。
- [x] 0.4 枚举依赖 Decision records+edges、Investigation reportIds+edges 或文本 stdout 的查询、CLI、测试和分发入口，并将当前 owner map 写入 design。
- [x] 0.5 按领域关系规则核对选择示例和计划测试形状：两后继及三后继拆分、纯归并、稀疏 Decision 重划、上下文提升、范围外关系目标和 summary 缺失都能由合法图表达。

## Implementation

- [x] 1.1 在共享 graph owner 中增加已归一化的 trace limits、membership、frontier、coverage、blocked event 和接纳单元类型，并实现 breadth-first、稳定顺序、唯一记录预算与首个超预算单元停止的纯选择流程。
- [x] 1.2 为 Decision 构造 `ordinary`、完整 `split`、纯 `merge` 和完整 `reallocation` 事件接纳 adapter；从一次索引快照投影规定字段，并把查询成功类型从 records+edges 切换为共享 envelope。
- [x] 1.3 为 Investigation 构造 `ordinary`、完整 `split` 和纯 `merge` 事件接纳 adapter；从一次索引快照投影规定字段，并把 trace success 从 reportIds+edges 切换为共享 envelope。
- [x] 1.4 将两个公开 trace options 收敛为可选 direction、可选 maxDepth 和可选 maxRecords；实现默认值、`maxDepth=null`/CLI `--depth all`、非负安全整数深度、正安全整数预算及默认/显式 limits 回显。
- [x] 1.5 更新两个 CLI 的 trace 参数与 help，使完整和受限成功结果使用同一稳定 JSON；保持参数错误、selector/索引失败、stdout/stderr 和退出状态边界，并同步仓库内消费者。
- [x] 1.6 更新两个 `SKILL.md`、固定关系契约和人类说明，使 agent 能恢复 membership、事件闭合、limits、coverage、frontier、外部 relation target、summary 缺失及续查方式；保留 `trace-output-examples.md` 的非规范讨论材料身份。
- [x] 1.7 按实施基线分别递增 Decision Records 与 Investigation Report skill 版本，通过正式 sync 入口重建 MJS、source map 和公开声明；复用现有 build adapter，并只针对实际生成缺口调整适配器。
- [x] 1.8 为每个新增或修改的最小原生测试入口维护唯一 Test Evidence Case，并通过正式入口同步 `test-evidence-index.json`。

## Verification

- [x] 2.1 用共享图测试证明默认/显式 limits、depth 0/all、predecessors/successors/both、BFS 与 UTF-16 稳定顺序、context promotion、同时 depth/max 截断和普通记录预算 frontier。
- [x] 2.2 用共享与 Decision 测试证明 `split`、纯 `merge`、稀疏 `reallocation` 均原子接纳；首个事件放不下时只保留 anchor seed，选择停止且不部分接纳或跳过该单元，`recordIds` 与最小 `requiredMaxRecords` 正确。
- [x] 2.3 用两个领域测试证明 `traceIds`、`contextIds`、`entries` key 不变量、字段裁剪、原始 relations、范围外 target、可选 summary 和单索引快照语义。
- [x] 2.4 用源码 CLI 测试覆盖默认与所有显式参数、完整与受限 JSON、字节稳定排序、无文本残留、非法参数退出 2、selector/索引失败退出 1，以及 stdout/stderr 分流。
- [x] 2.5 用公开 API、生成声明和真实分发 CLI 测试证明两个领域的 options、success 类型和运行时输出一致；运行 `bun run test:relation-graph`、`bun run test:decision-records-cli` 与 `bun run test:investigation-report-check`。
- [x] 2.6 运行两个正式 sync 后执行 `bun run check:decision-records-cli`、`bun run check:investigation-report-check`、对应 `validate-skill`、`bun run check:decisions` 和 `bun run check:investigations`，确认生成无漂移且索引契约未被意外改写。
- [x] 2.7 同步并检查 Test Evidence Cases 与索引，确认全部新增或修改测试节点可独立选择、单独报告，并与 Contract/Proves 对应。
- [x] 2.8 运行 `bun run check` 和 `bun run check --full`；审查最终 diff 只覆盖本 proposal 的 owner，不引入 cursor、独立 edges、Markdown 正文加载、summary 推断或双轨文本兼容。
- [x] 2.9 仅依据 Change artifacts 和链接的稳定 owner 做实现阅读复核：实现者必须能恢复默认值、事件接纳、确定性、coverage、字段投影、失败通道、生成边界与验证出口，且 design 保持无 Open Questions。
