---
title: Release Gate 按测试文件并集批量执行
id: 260909-batch-release-test-execution
status: active
alignment: aligned
createdAt: 2026-09-09T14:16:36Z
purpose: 让 Release 测试成本随唯一输入增长，并在完整身份未变时复用成功证明。
background: 逐 Check 启动 Bun 使完整门禁重复初始化且调度变化会放大竞争。
decision: Release 以有界 worker pool 执行 Bun 测试文件并集并投影结果；本地只复用完整身份精确匹配的成功证明。
tags:
  - project-tooling
relations: []
---

## 目的

- 让完整 release 门禁的测试成本随本次唯一测试输入增长，而不是随表示同一输入的 Check 数量和子进程初始化次数增长。
- 保留 Vibe 中每个稳定 Check 的独立 outcome、依赖语义、诊断与 release 终结关系；证明命中必须显式可见，不能把缓存时延误述为冷运行成本降低。

## 背景

- 原 release Definition 为每个 Bun semantic Check 和 Bun test package Check 分别启动进程；同一测试文件可同时被语义 Check 与 package 聚合入口引用，Bun 运行时和模块图也在多个进程重复初始化。
- 单纯增加 scheduler 容量会让内部还会启动 Git、Node 或 worker 的测试进程争抢四个可用 CPU；Check 增减或关键路径变化后，依赖某一排序的收益不能稳定保留。
- Bun 能用隔离 worker 执行多个测试容器并产生 JUnit；JUnit suite 的文件身份可以在一次执行后恢复各原 Check 的结果，而不把聚合容器登记为新的测试证据入口。

## 决策

- 采用: Release 为没有生成前置的 Bun semantic Check 和显式登记的 Bun test package Check 构造一次 invocation-local 批次。批次对测试文件取稳定并集，以有界隔离 worker 执行；同一文件被多个 Check 引用时只执行一次。Base 与增量 Gate 按 owner impact contract 选择语义测试；Node 测试、带生成前置的分发测试以及非测试命令继续使用原入口。
- 采用: 批次报告必须是结构有效、恰好覆盖全部请求文件且每个文件只出现一次的 JUnit。每个原 Check 只从自己文件集合的 suite 恢复成功或失败；进程异常、报告缺失/畸形、suite 缺失/重复，或非零退出却没有失败 suite 时 fail closed 为 unavailable。一个测试组失败不阻止通过 `observes` 等待 leader 的其他组形成自己的 outcome。
- 采用: 批次对稳定文件并集按位置轮转分成最多四份，同时启动四个独立 Bun 进程，每个进程顺序执行自己的分区并产生独立 JUnit。曾采用的单进程 `bun test --parallel=4` 在同步 Git 子进程密集的测试中出现 worker 持续占满 CPU 且测试 timeout 无法中断的故障，因此不作为 CI cold 边界；独立进程分区在重复 cold 样本中保持可终止且结果稳定。
- 采用: 第一个批次 Check 负责启动分区 worker pool，其余批次 Check 观察 leader 终态后投影已形成的结果，不新增 provider Check，也不改变完整 Definition 的稳定 Check ID 集合。Leader 汇总各 worker 的完整 transcript；每个投影 Check 保存自己的命令、映射状态和共享 transcript 定位。
- 采用: Release 额外声明四个 `cpu-work` admission units；批次占用全部四个 units 和一个外部进程 admission，其他非投影 Check 各占一个，避免分区进程与外层 Check 竞争。原有外部进程和仓库扫描容量继续分别限制 Check 入口与扫描；批次内部并行由自身固定边界负责。该资源只约束 invocation 内实际工作，不把等待投影冒充资源消费者。
- 采用: 新增可批量 package test 时必须同时登记其显式文件并校验与 `package.json` 命令一致；semantic catalog 自动提供批次容器。新增 Check 会增加真实的新测试工作，但不会为重复文件再启动批次或重复执行文件。
- 采用: Gate 测试以不同产品分支、错误语义或交付边界为准入依据，不以 fixture 数量代替独立价值。纯数量扩张且未触发新分支或性能契约的规模用例不进入 Gate；组合查询 fixture 只保留证明分页所需的最小数量，实际跨过产品分页上限的用例仍作为功能回归。Index Runtime 的显式性能基准保留为独立按需命令，不进入 base 或 release。
- 采用: 本地只在成功证明同时精确匹配完整工作区内容、工具链与进程环境身份，以及批次 Check/文件映射、worker 数和证明格式时省略批次进程。只有所有 suite 通过且结束快照与起始快照相同才原子发布证明；缺失、损坏、漂移或任一身份变化都 fresh 执行。CI 与显式 `--cold` 禁止读取证明，且命中状态写入调用级机器摘要和 transcript。该证明只覆盖批次测试，不覆盖 Node、生成前置、原生扫描或 release 交付 DAG。
