---
title: 为 Release 版本管理测试建立独立资源边界
id: 260912-isolate-release-version-control-resource-boundary
status: active
alignment: aligned
createdAt: 2026-09-12T02:53:01Z
purpose: 在保留 Release 测试批次收益的同时隔离 Git 子进程密集测试，并保留直接失败诊断。
background: 版本管理测试在共享四路批次中跨提交间歇失败，现有远端摘要无法定位具体用例。
decision: Release 批次排除 test:version-control；其 Gate Check 独立执行并占用全部 cpu-work 容量。
tags:
  - project-tooling
relations:
  - type: 修订
    target: 260909-batch-release-test-execution
    summary: 为 Git 子进程密集测试增加独立调度例外
---

## 目的

- 保留 Release 测试批次对唯一测试文件去重、四路有界执行、JUnit 投影和本地成功证明的收益。
- 让会密集创建 Git 仓库并启动子进程的版本管理测试不与四路批次或其他 CPU 工作竞争；若它再次失败，终端和 Check transcript 必须直接定位到该维护命令。

## 背景

- 前序决策把没有生成前置的 Bun semantic Check 和显式登记的 Bun test package Check 纳入同一批次，并让批次占用全部四个 `cpu-work` unit、其他非投影 Check 各占一个 unit。
- [版本管理测试间歇失败调查](../investigations/isolate-ci-version-control-test-load.md)确认 `test:version-control` 跨提交重复失败；目标提交在匹配 CI 工具与环境的独立 clone、连续独立运行和并发压力对照中均未复现具体断言。压力对照同时表明该测试在竞争下显著变慢，且共享 batch transcript 无法提供直接失败用例。
- 现有证据不足以把资源竞争确定为唯一根因，但足以说明继续让这个 Git 子进程密集测试共享四路批次，会同时保留负载竞争和诊断遮蔽两项风险。修订应收窄执行边界，不改变测试内容或质量真值。

## 决策

- 采用: Release 继续把符合资格的 Bun semantic Check 和 Bun test package Check 按唯一文件并集分配给最多四个隔离 worker；JUnit 完整性、逐 Check 投影和成功证明契约保持不变。
- 采用: `test:version-control` 保持稳定 package script、base impact Check 和 release-required Check，Gate ID 继续为 `script:test:version-control`；它是当前唯一不进入 Release 测试批次的 Bun test package Check。
- 采用: `releaseBunTestPackageFiles` 只登记批次成员，不登记 `test:version-control`。Release 中的 `script:test:version-control` 继续通过原 package-script adapter 独立执行，并同时声明一个 `external-process` 与全部四个 `cpu-work` unit；named resource 由 Vibe 在 admission 到 settlement 期间原子持有，因此该测试不会与其他声明 CPU 工作的 Check 并发。
- 采用: 批次投影 Check 继续不声明资源，批次 leader 继续占用四个 `cpu-work` unit；其他实际 Release 工作继续占用一个 `cpu-work` unit 并保留各自原有 resource claims。独立版本管理测试不进入批次成功证明，证明命中也不得省略它。
- 采用: 资源策略变化同步升级 learned scheduler 的项目实现身份，旧策略下采集的时长 history 不用于新策略的任务比较；history 仍只影响选择偏好，不改变 Check membership、outcome 或 aggregate。
- 采用: 如果独立 transcript 后续稳定定位到产品断言缺陷，直接修复该缺陷并重新评估资源例外；只有可用 CPU、测试负载或同类测量发生实质变化时才调整 unit 数或批次资格，不能仅因一次通过取消隔离。
