---
title: "决策快照查询与阶段、事件成本收敛"
id: "261011-decision-snapshot-stage-and-event-costs"
formedAt: "2026-10-11T11:47:58Z"
question: "决策纯索引查询、写前验证及事件处理的重复扫描能否在保留职责和输出边界的同时收敛？"
tags:
  - "decision-records"
  - "performance"
  - "semantic-fidelity"
relations:
  - type: "复查"
    target: "261009-skill-cli-repeated-process-and-source-access"
    summary: "复查决策阶段扫描，并扩展查询、事件与呈现成本"
---

## 形成时背景

前序调查在 2026-10-09 观测到 Skill CLI 重复获取，其中 Decision domain 暂存集合读取为 `(N+1)²`。本轮在源码基线 `223805466196410174d8c58111489f5d7933ed33` 和已批准的发布快照语义下复查决策阶段，并扩展到查询、事件接纳、终端图和关系筛选。两轮样本与版本各自解释当时的观测。

## 调查目的

区分必要的全集验证与逐选择项、逐边、逐节点重复扫描，在保留身份、方向、事件闭合、预算、pending 和写前漂移保护的条件下收敛成本。纯索引查询采用已批准的发布快照语义，其余优化以选择结果和终端文本等价为验收条件。

## 调查范围与依据

- 对照实际执行 Git 基线的原函数、原生成 CLI 与本轮工作树实现；下表“原实现”和“本轮实现”分别表示这两组运行。
- 2026-10-11，在 Node 26.8.2、Bun 1.4.2 下记录实际 `fs/promises.readFile` 次数、图边 type getter 访问、渲染关系列表 getter 访问和旧 evidence 数组迭代项数。计数器保留原操作；耗时不是验收指标。规模参数互不混用：N 是正式来源文件数，S 是 stage 选择数，d 是事件边数，V/E 是渲染切片节点/边数。
- 查询使用基线真实集合 N=379。stage 的隔离比较只调用写前验证阶段、不写真实 pending；原生测试另用 N=10/100、S=1/5/20，以及隔离 Git 仓库验证 all/index/domain 的 fresh 读取与零写入失败。
- 事件和渲染使用 d/V=10、100、1000 的合成星形、链和事件样本。七份原终端完整文本形成[原生 golden 输入](../../tools/decision-records/tests/fixtures/trace-render-goldens.json)，覆盖切片外 owner、重叠事件上下文和摘要转义；新输出只允许增加声明来源的一行。
- 发布新增决策后真实集合为 N=380；生成 Node CLI 的 list、trace、metadata 搜索各总 readFile=1、Markdown readFile=0，全部退出 0 且 stderr 为空。对原生成 CLI 的旧 N=379 样本，各总 readFile=380、Markdown readFile=379。规模增加一条记录不影响零来源读取结论。
- 原/新事件适配器另以真实发布集合及稀疏重划、归并加普通边、拆分/归并星形，遍历全部 anchor、三方向、depth=0/1/2/all、budget=1/2/3/5/10/50/1000，共 34,440 次完整 selection 深比较通过，包含 trace/context、coverage、frontier 与 blockedEvent。
- 稳定回归入口包括[快照](../../tools/decision-records/tests/queries/query-snapshot.test.ts)、[阶段来源](../../tools/decision-records/tests/staging/stage-sources.test.ts)、[事件接纳规模](../../tools/decision-records/tests/records/trace-admission-complexity.test.ts)、[方向与事件](../../tools/decision-records/tests/records/trace-event-admission.test.ts)、[文本呈现](../../tools/decision-records/tests/cli/cli-output-trace.test.ts)、[关系筛选](../../tools/decision-records/tests/queries/relation-filter-complexity.test.ts)。Case 账本承接各最小测试的证明义务。

## 调查结果与边界

### 观察与原因

| 对象与指标 | 原实现 | 本轮实现 |
| --- | --- | --- |
| list/trace/metadata 每次读取正式 Markdown（原 N=379，本轮 N=380） | 379 | 0 |
| N=379，S=1/5/20，写前阶段 readFile | 379 / 1895 / 7580 | 379 / 379 / 379 |
| 拆分 d=10/100/1000，根扩展边 type 访问 | 110 / 10100 / 1001000 | 20 / 200 / 2000 |
| 归并同规模，根扩展边 type 访问 | 110 / 10100 / 1001000 | 30 / 300 / 3000 |
| 链/星形 V=10/100/1000，关系列表访问 | 220 / 20200 / 2002000 | 20 / 200 / 2000 |
| 事件形同规模，关系列表访问 | 274 / 25249 / 2502499 | 20 / 200 / 2000 |
| type-only evidence d=10/100/1000，复制旧数组项数 | 45 / 4950 / 499500 | 0 |

根因分别是：查询主动核对全集 revision；stage 对每个选项重新全量发现；事件适配器按每条边重建完整成员；渲染按节点反查全集且按事件过滤全集边；关系 evidence 追加时 spread 全部旧项。

修复将事实复用限定在对应生命周期：stage 每个写前阶段全量发现一次；trace 每次查询复用完整事件成员，每个 from/direction 独立生成直接邻接交集并按事件去重；render 每次呈现构建反向与事件边上下文；筛选 evidence 在私有 builder 中追加后统一去重排序。

### 有意行为改变与保留边界

纯索引成功声明 published-index、unchecked、非 fallback，正常快照查询没有来源 warning。索引加载还完整验证领域关系：缺失关系 target 等非法图在加载时失败关闭；基线仅检查结构与来源位置，该反例可进入 trace 后产生运行错误。快照来源声明和非法图提前拒绝是本轮有意行为变化。

show 仍只读取所选当前正文；content 搜索既有验证与降级未改变。stage 每个 fresh 阶段保留 expected 路径失败/身份变化、重复 ID、删除身份他处重现、路径/字节漂移及三种 scope 的 pending 保护；准备阶段事实不代替写前获取。锁、HEAD、CAS 和恢复继续由既有事务边界承接。

事件仍按方向和直接邻接与事件成员的交集区分 trace/context，稀疏重划不会把所有 context 变成可扩展 trace；普通边导致的事件内直接到达也保留。depth、budget、frontier、blockedEvent 仍由共享遍历承接。

### 复杂度与适用范围

stage 单个写前验证阶段的来源读取由 Θ(SN) 降为 O(N)，另计所选路径和字节比较。合法拆分/归并星形的事件成员扫描由平方级降为线性，仍有排序；重划 unit 的规范化成本另随不同 direct-set 的数量和成员规模增长。渲染核心遍历为 O(V+E)，另计排序和实际输出；event-context 边选择使用局部成员交集而非全边重扫。evidence 构造不再平方复制，最终去重、排序和分页保持。

索引完整验证仍有 O(N+E) 遍历及既有排序成本，trace 加载后还需构建查询图。本轮证据覆盖上述合法样本和列出的非法图反例；超大真实图的峰值内存、稳定时延、其他错误图算法和并发原子快照均未验证，操作计数只证明指定工作负载下的成本变化。
