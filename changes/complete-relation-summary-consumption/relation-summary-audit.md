# Relation Summary Audit

本附件保存关系摘要消费的改前证据和逐入口判定，供实施者按需复核。目标行为由 [design.md](design.md) 承接，实施后的测试证据由 [tasks.md](tasks.md) 跟踪。

## Evidence Boundary

审计基线：2026-09-12（UTC），HEAD `d16becdff292f69bf9ebe5654f4dde4f75e76e91`。证据分为 owner 契约、源码读取和实际执行；下文分别标明。

- 正式集合执行只读查询和两域全量 check，均通过；索引与来源一致。
- 隔离样例使用每域两个人工记录，通过领域短命令指定独立 root，执行 44 次 CLI 调用，覆盖创建、候选读取、建立、替换、rename、部分生命周期和非法绑定。样例 root 无 Git、hook 或真实资源。
- E8 另用内存图调用源码选择与 renderer，证明代表性选集及改前输出。
- 未执行真实删除、暂存、故障注入、并发恢复、多后继写入和资源发布；这些路径依据契约与源码。人工正文只验证机械行为，摘要质量须以真实正文审阅。

## Coverage Baseline

| Domain / 来源范围 | Records | Edges | 有摘要 | 无摘要 |
| --- | ---: | ---: | ---: | ---: |
| Decision / 全部 | 348 | 289 | 8 | 281 |
| Decision / active | 128 | 109 | 6 | 103 |
| Decision / archived | 220 | 180 | 2 | 178 |
| Investigation / 正式集合 | 42 | 24 | 3 | 21 |

两域合计 302 条边无摘要。计数排除候选；Decision check 同时报告 0 candidate，Investigation 未另行枚举候选。

重算时先在仓库根执行：

```bash
bun run decision-records -- check --root .
bun run investigation-report -- check --root .
```

检查通过后，读取两个索引的 `entries`，按来源 entry 的 `relations[]` 展开；Decision 分组使用来源 status。存在 summary 字段计为有摘要，输入 trim 后为空的摘要按契约省略。以下为只读统计片段：

```bash
bun - <<'JS'
import { readFileSync } from 'node:fs';
for (const path of [
  'docs/decisions/decision-index.json',
  'docs/investigations/investigation-index.json'
]) {
  const records = Object.values(JSON.parse(readFileSync(path, 'utf8')).entries);
  const edges = records.flatMap(record => record.relations);
  const withSummary = edges.filter(edge => Object.hasOwn(edge, 'summary')).length;
  console.log({ path, records: records.length, edges: edges.length,
    withSummary, withoutSummary: edges.length - withSummary });
}
JS
```

## Evidence Findings

### E1

**关系筛选缺少独立命中边投影。**

实跑 Decision `list --status all --related-to 260909-write-explanatory-relation-summaries --direction predecessors --detail`，返回 `260905-add-optional-relation-summaries`，未显示 anchor 指向它的摘要；该结果自身 relations 为空。

实跑 Investigation `list --related-to 260912-isolate-ci-version-control-test-load --direction predecessors --detail`，返回前序 `260911-explain-ci-cold-proof-test-failure`。公开 query API 的 `state.relations` 指向另一更早前序，属于结果自己的出边，而非本次筛选依据。

两域源码先将匹配关系收敛为 ID 集合，list 结果保留各记录自身完整关系：见 [Decision 筛选](../../tools/decision-records/src/decision-query-relation-filter.ts)、[list](../../tools/decision-records/src/decision-query-list.ts)、[Investigation 筛选](../../tools/investigation-report/src/query-search-selection.ts)、[list 投影](../../tools/investigation-report/src/query-index.ts)。P1 因此保留筛选边的真实来源。

### E2

**文本命中与关系筛选是两类证据。**

Decision `search '保留字段兼容' --in metadata` 输出摘要命中的 matchedRelations；`search '具体演进' --in metadata --related-to 260905-add-optional-relation-summaries` 输出 `matchedFields: title`、`matchedRelations: none`。后者命中关系，但没有摘要文本命中。

Investigation `search '在后续 CI 失败中复查环境分叉与调度边界' --in metadata` 返回实际摘要及边。content 输出原文命中行。见 [Decision search renderer](../../tools/decision-records/src/cli-output-search.ts)、[Investigation query renderer](../../tools/investigation-report/src/cli-query-commands.ts)。P2 用独立块承接关系筛选。

### E3

**完整替换可以移除摘要，事务回执未展示该变化。**

隔离样例先建立带摘要的 after→before，再以同 type/target、不传 summary 的完整集合替换。Decision evolve 与 Investigation set-relations 均成功；写后 show 确认旧 summary 消失，两域 check 通过。清空关系也只输出通用动作回执。

Decision evolve 预检报告 `Decision lifecycle preflight passed`，成功报告 `Evolved successors`；新候选 activate 报告动作及归档前序。Investigation publish 预检/成功报告所选 ID，set-relations 报告 `Investigation relations updated for`，且没有公开 preflight 选项。

[Decision 事务准备](../../tools/decision-records/src/decision-relation-transaction.ts) 已有原/最终关系，随后 [lifecycle 输出](../../tools/decision-records/src/cli-lifecycle-execution.ts) 收敛为 changes/message；[Investigation publish](../../tools/investigation-report/src/cli-candidate-create.ts) 和[关系结果](../../tools/investigation-report/src/cli-relation-commands.ts) 也没有最终集合。P3 从领域结果保留核对信息。

### E4

**Decision trace 事件的匿名 detail 缺少具体 target。**

实跑 `bun run decision-records -- trace 260909-use-native-vibe-gate-controls --direction predecessors --depth 1 --root .`：每条归并摘要在 source predecessors、事件 detail、target successors 中出现三次；事件同一 source 下的两条 detail 不带各自 target。

两域普通边和 JSON 已透传存在的摘要；缺省时终端仅显示 type/对端。JSON entry 保留全部直接关系，文本只展开切片内部边。Investigation 生产文本/JSON 和隔离无摘要样例均已实跑。

见 [Decision trace 文本](../../tools/decision-records/src/cli-output-trace-text.ts)、[事件组织](../../tools/decision-records/src/cli-output-trace-events.ts)、[Investigation trace 文本](../../tools/investigation-report/src/trace-output.ts)。复杂事件补充见 E8，目标表达见 P4。

### E5

**完整读取、候选准备和状态/身份维护承担不同任务。**

隔离实跑确认 new/candidates 返回路径与 readiness，show/show-candidate 原样展示 Markdown。Decision 内部 show 含 projection，Investigation 正式 show API 含 state；其 candidate API 返回 markdown/readiness。

两域 rename 预检/执行报告身份映射和受影响关系数，写后索引证明 target 已更正、summary 原样保留。Decision mark-aligned、archive、archived activate 只返回状态动作。P5 保留上述职责。

见 [Decision 查询输出](../../tools/decision-records/src/cli-output.ts)、[mutation 输出](../../tools/decision-records/src/cli-mutation-commands.ts)、[Investigation candidates](../../tools/investigation-report/src/cli-candidates.ts)、[maintenance](../../tools/investigation-report/src/cli-maintenance-commands.ts)。

### E6

**两域现有公共 API 边界不同。**

实际导入分发模块：Decision 仅导出 runDecisionRecordsCli、scanDecisionRecords、validateDecisionRecords、renameDecisionRecord；list/query 与 lifecycle preparation 属于内部表面。Investigation 公开 query/show/trace、candidate、publish 和 set-relations 等函数。CLI JSON 模式均限于 trace。

边界由 [Decision 分发声明](../../skills/decision-records/scripts/decision-records.d.mts)、[源码导出](../../tools/decision-records/src/cli.ts)、[Investigation 公共声明源](../../tools/investigation-report/api/check-investigations.d.mts) 核对；新增消费结果分别落在 P1/P3 指定的内部或公开位置。

### E7

**默认三条预览能够覆盖多数来源，完整读取仍有必要。**

按受检索引重算：Decision 有 243 个非空关系来源，其中 217 个恰有一条、237 个至多三条、6 个超过三条，最大六条；Investigation 的 24 个非空关系来源均为一条。

related-to 下，来源 target 唯一与无环约束使每个邻居对应一条连接 anchor 的边；type-only 可以命中同一来源的多条出边。P1 将三条限制用于展示，领域结果保留全部匹配边。

### E8

**context 来源需要逐边承接摘要。**

通过 `bun -e` 构造内存记录，调用 Decision `traceDecisionRelations`、`printDecisionTextTrace` 和 Investigation `traceInvestigationRelations`、`renderInvestigationTrace`。A/B/S/X/Y 是样例标识，摘要分别为甲/乙/丙职责等独立文本；此观察覆盖源码图选择/渲染，未经过完整 CLI 或 Markdown 校验。

下表均使用 depth 1、maxRecords 50；coverage.complete 为 true、frontier 为空。renderer entries 取 trace/context 选中节点及其完整出边。

| 输入：Domain、边、anchor / direction | trace / context | 改前文本观察 |
| --- | --- | --- |
| Decision，S 归并 A/B，S / predecessors | A,B,S / 空 | S 主体与 A/B 镜像带对端，事件再打印两条匿名 detail |
| Decision，X/Y 拆分 A，X / predecessors | A,X / Y | X 主体和 A 镜像展示边；事件重复 X 摘要并展示 context Y 摘要 |
| Decision，X 重划 A、Y 重划 A/B，X / predecessors | A,X / B,Y | Y→A 在 A 镜像可读；Y→B 仅由事件中 Y 的匿名 detail 承接 |
| Investigation，S 归并 A/B，A / successors | A,S / B | S 的事件将摘要分别附到 A/B，context B 有摘要 |
| Investigation，X/Y 拆分 A，X / predecessors | A,X / Y | A 的事件将摘要分别附到 X/Y，context Y 有摘要 |

额外运行 Investigation 归并图、anchor S、predecessors、depth 0：仅 S 入选，entries 仍保留其到 A/B 的关系，文本只显示节点与深度 frontier。目标布局和测试条件见 P4。

## Decision Command Audit

每行对应一类命令语义；P1–P6 指向 design 中的目标契约。“源码”表示该分支尚未通过事务实跑验证。

| 入口 | 改前结果 | 采用行为 / 证据 |
| --- | --- | --- |
| list，无关系条件 | 记录概览，领域结果含自身关系 | 保持概览；P1，源码及实跑 E1/E5 |
| list --related-to，方向/type 组合 | 按连接筛选记录，无匹配边解释 | 增加筛选边；P1，源码及前驱/后继实跑 E1 |
| list --relation-type | 只列对应来源 | 有界展示匹配类型边；P1，源码 E1/E7 |
| search --in metadata | 实际摘要命中返回 matchedRelations | 保留文本证据，另给筛选依据；P2，实跑 E2 |
| search / --in content | 原文行，关系条件筛选来源 | 保留 previews，另给筛选依据；P2，源码 E2 |
| show、show-candidate | 完整 Markdown | 保持；P5，实跑 E5 |
| candidates、new | 记录/路径及 readiness | 保持，语义读取走 show-candidate；P5，实跑 E5 |
| activate 新候选，含 preflight | 动作及归档前序 | 完整关系核对；P3，实跑 E3 |
| activate archived，含 preflight | 状态回执，关系保留 | 保持；P5，实跑 E5 |
| evolve，含替换/清空/预检/组合 discard | 动作回执 | 完整关系核对；P3，替换/清空/预检实跑 E3，组合删除仅源码 |
| rename，含 preflight | 映射与引用数量 | 保持；P5，实跑 E5 |
| mark-aligned、archive | 状态动作 | 保持；P5，实跑 E5 |
| discard 单独删除 | 删除对象及引用检查 | 保持删除与阻断责任；P5，源码 |
| trace 文本 / JSON | 摘要可读，事件 detail 匿名 | 局部文本调整；P4，实跑 E4/E8 |
| check | 数据/索引有效性 | 保持合法缺省；P6，实跑 |
| sync-index | 投影与选择范围 | 保持回执及摘要透传；P6，源码 |
| stage | pending 选择数量/范围 | 保持；P6，源码 |

## Investigation Command Audit

| 入口 | 改前结果 | 采用行为 / 证据 |
| --- | --- | --- |
| list，无关系条件 | 记录概览，API 含 state | 保持；P1，源码及实跑 E1/E5 |
| list --related-to，方向/type 组合 | 筛选记录，无匹配边解释 | 增加筛选边；P1，源码及前驱实跑 E1 |
| list --relation-type | 只列对应来源 | 有界展示匹配类型边；P1，源码 E7 |
| search --in metadata | 实际摘要命中返回 matchedRelations | 保留文本证据，另给筛选依据；P2，实跑 E2 |
| search / --in content | 原文行及截断信息 | 保留 previews，另给筛选依据；P2，源码 |
| show、show-candidate | 完整 Markdown 与各自结构结果 | 保持；P5，实跑 E5/E6 |
| candidates、new | 路径/readiness | 保持，语义读取走 show-candidate；P5，实跑 E5 |
| publish，含 preflight | 所选 ID | 完整关系核对；P3，实跑 E3 |
| set-relations | sourceIds，无公开预检 | 完整关系核对及新增预检；P3，实跑 E3 |
| rename，含 preflight | 映射与引用数量 | 保持；P5，实跑 E5 |
| discard-candidate、discard | 对象、资源及引用阻断 | 保持；P5，源码 |
| trace 文本 / JSON | 边与事件摘要 | 统一缺省标记及边界；P4，实跑 E4/E8 |
| check / --id | 数据、索引和资源检查 | 保持合法缺省；P6，全量实跑，scoped 源码 |
| sync-index | 完整/selected 投影回执 | 保持及透传摘要；P6，源码 |
| stage-index | 所选索引 entry 的暂存范围 | 保持；P6，源码 |

help 承接接口说明；手工候选编辑的读取责任沿 new → 编辑 → show-candidate 流程。

## Verification Boundary

正式集合的查询和检查、隔离单来源写入/rename、E8 图选择与改前 renderer 已取得执行证据。非法摘要 target 在两域均返回领域退出码 1，样例 docs 文件前后 SHA-256 映射一致，最后两域 check 通过。

完整回归、故障恢复、多来源写入及目标 renderer 验证由 tasks 的 Verification 承接；这里的改前观察不作为改后测试通过证据。
