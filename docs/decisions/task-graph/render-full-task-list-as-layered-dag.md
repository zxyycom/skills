---
title: 将默认 task list 渲染为全量分层 DAG
status: active
alignment: aligned
createdAt: 2026-08-08T02:15:19Z
purpose: 让默认任务清单直接呈现推进结构与运行排斥，同时保持每个真实 task 和完整机器语义可恢复。
background: 平铺 raw 结果虽完整，却要求调用方重建层级、依赖与排斥；三类关系语义不同，不能压成同一种图边。
decision: 默认 task list 以父子和依赖形成 track、仅以依赖形成 layer，排斥关系独立进入 RUN MUTEX；视图始终全量且只折叠可恢复信息。
relations: []
---

## 目的

- 让默认任务清单直接回答有哪些推进线、任务位于哪一层，以及哪些任务不能同时运行。
- 保持 parent、dependency 与 exclusion 的不同领域语义，不用视觉分组制造新的调度含义。
- 让显示层降低重复信息时仍能从同一全量视图或 raw projection 恢复真实 task 与完整关系。

## 背景

- 平铺 raw task 字典适合机器消费，但人类或 agent 需要自行重建连接分量、依赖层级和并发排斥才能规划推进。
- Parent 表达结构与完成门禁，dependency 表达有向执行前置，exclusion 只禁止同时运行；把 exclusion 并入推进图会把并发限制误读成顺序。
- 过滤、自动收缩或用占位节点替代 endpoint 会使同一次输出无法验证完整关系，也会让显示 folding 丢失依据。
- 按 title 显示宽度自动换行或重排会让相同领域结果因语言和终端差异产生不稳定布局。

## 决策

- 采用: 默认 `task list` 是全量静态视图，索引中的每个 task 都以实际 task ID 恰好显示一次，不进行过滤、分页、自动收缩或隐藏。
- 采用: Parent 与 effective dependency 共同确定弱连通 track；dependency 单独确定有向 layer，parent 不改变 layer，track label 只承担本次输出导航。
- 采用: Effective exclusion 不进入 track 或 layer；全部排斥 pair 在独立 `RUN MUTEX` section 中对称去重，只有已经形成运行 blocker 的对端才同时标在受阻 node 上。
- 采用: 显示层只折叠能由同一全量视图恢复的普通未完成关系、反向关系和继承来源；终态与层级因果保持可见，完整 blocker 和关系来源保留在 raw projection 与显式 JSON 输出中。
- 采用: Track、node 与 mutex 使用实际 task ID 和图关系确定性排序；inline/block 选择由固定 render context 和关系项数量决定，不根据 title 或 reason 的 Unicode 显示宽度自动换行、截断、隐藏或重排。
- 不采用: 把 track 数解释为可并行数、把 exclusion 转成 dependency，以及为默认清单增加优先级、容量计算、自动筛选或交互布局。
