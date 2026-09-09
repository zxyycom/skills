# Design

本设计以独立进程分区消除重复测试输入和 Bun worker 挂起，以 owner impact 修正测试分层，并用可审计的精确成功证明满足重复本地 release 的反馈目标。

## Context

- 原始三次 release Gate 为 49.3、42.0、45.3 秒，累计 Check 工作约 130–147 task-seconds。
- 单进程批次架构曾把 strict full 降至 35.6–39.9 秒，批次单独执行 34 个容器、704 个测试为 20.6 秒；suite 时间和除以四个 workers 为 19.0 秒，说明余量主要是真实测试。
- 原 release-only 归因为 526 项、59.3 suite-seconds，base 为 199 项、20.1 suite-seconds。差异来自成熟领域的大量 Git/事务集成测试，不是 Check 投影数量。
- 单进程 `bun test --parallel=4` 后续出现隔离 worker 在同步 Git 子进程回收处持续占满 CPU、超过两分钟且 timeout 无法中断。把同一并集轮转分为四个独立 Bun 进程后，审查前连续三次批次均为 21.35、21.35、21.60 秒且 704 项全通过。
- 测试价值审查后批次为 34 个容器、701 项测试；审查期间 cold release 样本为 41.4–43.9 秒，完全相同输入 proof 命中为 16.6–16.7 秒且未启动批次进程；该差异继续显式区分真实测试成本与复用时延。

## Goals / Non-Goals

- 目标：让冷测试成本随唯一文件而非 Check 进程数增长，并以进程隔离避免 Bun worker 挂起。
- 目标：让产品测试按 owner impact 进入日常反馈，同时保留 Check ID、故障归因、依赖和诊断。
- 目标：只对完整身份精确一致的本地成功批次复用证明，并明确区分命中与 cold 成本。
- 非目标：不删减有效失败场景，不缓存失败或部分批次，不省略非批次 Check，不复制上游原生 scanner。
- 非目标：不继续按当前热点微调 scheduler 排序，也不把语义 Check 拆成逐测试节点。

## Decisions

### Intended Change

#### Test reasonableness

- Test Evidence 搜索的 1001 个 Case 恰好跨过生产分页上限 1000，属于功能分页回归；10,000-entry 精确查询与 Investigation Report 1,000-report 查询没有触发新分支或声明性能阈值，删除而不是仅优化 fixture。
- Test Evidence 组合筛选只需 13 项即可证明 offset 10、limit 3，Decision/Investigation facet 也不需要 10,000 个相同内存条目重复已有计数语义；Index Runtime 的显式性能退化基准保留为按需命令但不进入 Gate。Task Graph 双 checkout 可移植构建和各事务恢复窗口仍证明不同外部行为，保留。
- Decision stage 只需明显高于 Git 调用阈值 20/25，fixture 从 300 降为 64，仍能识别逐条调用回归。
- `test:test-evidence-project` 与三个语义 Check 执行同一文件，故只从 Gate 移除；稳定人工脚本保留。纯规模测试不因已有 Case 获得 Gate 准入，Case 与入口一并删除或按实际功能意图收敛。
- 领域 Check 按共同 Contract 与失败 owner 分成 `3/5/5/8/5` 组。合成单个工具 Check 会损失归因，拆成逐测试则放大 catalog。

#### Release test batch

1. 从无 `dependsOn` 的 Bun semantic Checks 自动取得单容器，从 package scripts 显式登记多容器，并核对 `package.json`。
2. 对文件取稳定并集，按位置轮转到最多四个分区；四个独立 `bun test ... --reporter=junit` 进程并行执行，每个进程内部不启用 Bun `--parallel`。
3. 每份 JUnit 必须有唯一 root，恰好一次覆盖自己的请求文件并给出一致计数；合并集合恢复原 Check outcome。进程 unavailable、报告缺失/畸形、suite 缺失/重复或非零退出没有失败 suite 时 fail closed。
4. 第一个批次 Check 是 leader，其余通过 `observes` 等待而不继承业务失败。Leader 汇总四个 worker 完整 transcript，并保留 worker 子目录；投影 Check 保存共享定位。

#### Exact success proof

1. Release activation 捕获与 base receipt 相同的完整工作区、工具链和环境 snapshot；证明另绑定 Check/文件映射、分区算法、worker 数和格式版本。
2. 只有 fresh 批次所有 suite 通过且结束 snapshot 与起始 fingerprint 相同，才以临时文件加 rename 原子发布整个批次的 `passed` 证明。捕获或缓存失败只失去优化。
3. 本地仅在所有身份精确相等时复用整个批次，不做部分复用；命中 transcript 和调用级摘要明确说明未启动测试进程。
4. `--cold` 和 CI 环境禁止读取证明，workflow 显式传入 `--cold`。证明不覆盖 Node、生成前置、原生扫描或 release 交付 DAG。

### Resulting Impacts

#### Base classification and resources

- 26 个产品 semantic Checks、version-control 与 skill-package-hash 映射到各自 owner impact tags；只有 snapshot/version/package 三项由 release tag 独占。完整 Definition 为 62 项，59 项进入 base impact contracts。
- Scheduler root 保持 4；base 使用 `external-process: 3`、`repository-scan: 2`。Release 增加 `cpu-work: 4`，批次 leader 占用全部四个 CPU units 和一个 external unit，其他实际工作各占一个，投影不占资源。

## Risks / Trade-offs

- Proof 表示“这些字节、工具链和环境下最近一次测试通过”，不是“本次重新执行”；命中状态必须保持可审计。
- 完整环境身份较严格，可能降低命中率，但避免遗漏行为相关环境变量。
- 一个分区进程崩溃会使批次基础设施 unavailable；普通断言失败仍按 suite 隔离。
- 四进程隔离比不稳定的单进程 worker 模式冷耗时更高；它换取 CI 可终止、可诊断和连续通过，缓存不会被用来掩盖该成本。

## Open Questions

- 无。原生扫描事实共享仍等待上游能力，不属于本 Change 的未决实现。
