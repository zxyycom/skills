# Tasks

任务先固定 cold 成本与测试证据价值，再修改执行和证明边界，最后分别验证 fresh、cached 与 cold。

## Readiness

- [x] 0.1 核对原始三次 full invocation、63 项结果与单项耗时。
- [x] 0.2 比较 scheduler 容量、热点 fixture、wrapper/native 文件粒度与批次执行。
- [x] 0.3 审查高成本测试的 Contract、Proves、边界值和重复聚合入口。
- [x] 0.4 取得本地精确成功证明复用授权，并确认 CI/显式 cold 强制重跑。

## Implementation

- [x] 1.1 以文件并集批量执行无生成前置的 Bun 测试，并从严格 JUnit 投影原 Check outcome。
- [x] 1.2 为 package test 建立显式文件映射，并校验映射、semantic catalog 与 package manifest。
- [x] 1.3 以 `cpu-work` resource 约束批次 worker 和其他 release 工作。
- [x] 1.4 删除无独立边界的规模用例、收敛组合查询与 facet fixtures、把 Index Runtime 性能基准移出 Gate，并把 Decision stage fixture 缩到 64 项。
- [x] 1.5 把产品语义测试及两个普通工具测试纳入 base impact contract，移除重复 Test Evidence package Gate leaf。
- [x] 1.6 实现完整工作区/工具链/环境/catalog 身份的批次成功证明，增加命中可观测性和 `--cold`，CI 显式 cold。
- [x] 1.7 同步工具链说明、长期决策、Gate Definition 与测试证据。

## Verification

- [x] 2.1 运行批次投影、精确证明命中、catalog miss 与 cold rerun 的目标测试。
- [x] 2.2 运行 format、typecheck、lint、Decision/Test Evidence catalog 与完整项目 Gate。
- [x] 2.3 从干净证明状态运行 fresh release，核对 62 项结果、共享 transcript 和证明发布。
- [x] 2.4 对完全相同输入运行 cached release，核对无批次进程、机器摘要和约 20 秒目标。
- [x] 2.5 运行 `--cold` release，核对强制重跑并报告真实冷成本。
