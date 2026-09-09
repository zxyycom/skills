---
title: 以输入证明增量激活日常 Vibe Gate
id: 260909-incremental-vibe-gate
status: active
alignment: aligned
createdAt: 2026-09-09T10:08:24Z
purpose: 让日常门禁只执行缺少当前输入成功证明的 Check。
background: 固定执行全部 base Check 重复扫描和运行无关测试，无法满足日常反馈时延。
decision: 项目形成内容快照、影响契约和成功 receipt，再以内部 flags 让 Vibe 执行所需 Check；release 激活完整 DAG，测试批次另用精确证明。
tags:
  - project-tooling
relations:
  - type: 修订
    target: 260909-use-native-vibe-gate-controls
    summary: 保留 Vibe 生命周期并修订固定 base 选择
---

## 目的

- 在不削弱门禁真值和失败闭合的前提下，让日常反馈成本随受影响 owner 收敛，而不是固定执行全部 base Check。
- 保留 Vibe 对 Check selection、依赖、调度、settlement、aggregate 和调用产物的唯一运行时责任，项目只准备仓库领域特有的输入证明与 activation flags。

## 背景

- 原生 release flag 已避免日常运行交付终结 Check，但可按 owner 影响判断的 base Check 仍在每次调用中固定执行；七项原生 Check 分别枚举工作区，多个领域集成测试即使 owner 未变化也会创建临时 Git 仓库并完整运行。
- 路径或标签相邻本身不能证明 Check 无关：共享实现、生成器、配置、工具链、Markdown 目标和未知新路径都可能形成间接影响。
- Vibe 的 flags、effective aggregate、依赖传播、学习调度和调用产物仍适合承接运行生命周期；仓库 owner、跨 owner 依赖和本地成功证明属于项目 Definition/CLI 的领域输入，不能由通用 scheduler 猜测。

## 决策

- 采用: 日常 Gate 在进入 Vibe 前一次枚举 Git 版本控制可见文件，读取普通文件内容身份，并从稳定路径规则派生可重叠的 owner、内容类型和路径清单标签。无法分类的路径进入 `global`；固定配置和 Gate 实现也进入 `global`，使缺少依赖声明时优先扩大执行范围。
- 采用: 项目显式维护标签依赖图和逐 Check impact contract。“无关”只在当前完整有效输入指纹命中本地最近通过 receipt 时成立；指纹包含 Check ID、impact contract/version、直接及传递标签摘要、路径清单和声明工具链身份。工具链身份覆盖 Git 版本与配置、当前进程环境、Node/Bun、已安装依赖图及 Gate 实际使用的工具版本，排除仓库实现不读取的父 shell 记账变量 `_`、`OLDPWD`、`SHLVL`。目录未变化、只命中路径标签或存在较旧成功记录都不能单独复用。
- 采用: 首次运行、receipt 缺失或损坏、输入变化、未知路径变化、必要工具探测失败和快照不可用均执行相应 Check；不能把固定的 unavailable 值当成成功身份。依赖 consumer 激活时，Vibe 需要的 provider 即使已有 receipt 也重新执行，不能把跨 invocation 证明伪装成同一 invocation 的 dependency outcome。依赖字节仍服从 pnpm frozen-lock 的受信安装前提，receipt 不承担 `node_modules` 防篡改责任。
- 采用: 项目把需执行的稳定 Check ID 映射为内部 activation flags；Vibe 仍用完整 Definition、`enabledByFlags`、`propagateDependsOn` 和 `checks: "effective"` 完成实际选择与聚合。复用项在 Vibe snapshot 中保持未激活，不冒充本次 passed；全部 59 项精确复用时，CLI 在已验证完整 catalog 的 activation plan 上把空 effective aggregate 明确结算为 passed，其他空选择继续失败。调用级 `gate-incremental.json` 和终端计划摘要列出 execute、reuse、fallback、first-run，机器结果另保留逐项 reason 与 receipt 发布结果。
- 采用: 只有 completed 且 aggregate passed 的日常 invocation 才考虑发布证明；再次取得同一完整工作区与工具链指纹后，把全部当前可复用 Check 的 passed receipt 原子替换到 Git 忽略的本地 cache。失败、取消、output failure、快照不可用、运行中漂移或 cache 写入失败均不发布；cache 失败只降低性能，不把质量失败改成成功。
- 采用: 产品语义测试以及 version-control、skill-package-hash 测试属于各自 owner 的 base impact contract，不因执行成本较高而留作 release-only；只有 snapshot、version authorization 和 packaging 三项交付行为由 release tag 独占。面向维护者的 `test:test-evidence-project` 聚合脚本继续保留，但其三个文件已有各自语义 Check，因此不再作为 Gate 的重复 leaf。
- 采用: release tag 始终激活完整 62-Check DAG，不以日常逐 Check receipt 跳过 Check；相同文件被多个 Check 引用时按 [Release 测试批次决策](batch-release-test-execution.md)一次执行并分别投影 outcome。该批次可在完整内容、工具链、环境和 catalog 身份精确一致时复用最近成功证明；CI 与显式 cold 模式仍强制真实重跑。release prepare、version authorization 与 packaging 继续消费同一 pending snapshot。
- 采用: Base 继续使用 Vibe 原生 learned strategy、`maxParallel: 4`、外部进程三个 units、仓库扫描两个 units、Check-owned transcript 和唯一 invocation 目录；容量 3 以 shared-tools 增量关键路径测量取代固定容量 2。Release 的额外批次资源由专属决策承接。`scripts/lib/vibe-gate/impact.ts` 承接项目快照、标签、impact contract 和 receipt；`scripts/vibe-check.ts` 只组合 activation、Vibe Run 与调用级输出，不建立第二套 scheduler、settlement 或 aggregate。
