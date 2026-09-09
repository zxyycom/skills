---
title: 采用 Vibe 原生门禁选择、调度与调用产物
id: 260909-use-native-vibe-gate-controls
status: archived
alignment: aligned
createdAt: 2026-09-09T07:14:44Z
purpose: 让项目门禁直接使用 Vibe 的选择、调度、资源与调用级产物边界。
background: Vibe 0.0.2 已提供原生 flags、学习调度、named resources 与调用级输出控制，项目仍重复 Check 选择和调度责任。
decision: 由 Vibe 原生能力承接有效 Check 选择、依赖传播和学习调度，项目只声明领域条件、资源与调用级输出位置。
tags:
  - project-tooling
relations:
  - type: 归并
    target: 260909-adopt-vibe-check-0-0-2-gate-runtime
    summary: 落实并扩展 0.0.2 原生能力边界
  - type: 归并
    target: activate-release-gate-checks-by-tag
    summary: 以原生 flag 条件取代项目自定义 activation preflight
---

## 目的

- 让唯一项目 Gate 直接采用 Vibe 0.0.2 已有的 Check 选择、依赖传播、学习调度、资源容量和 invocation 路径能力。
- 让项目层只维护仓库特有的 tag、任务性质、质量阈值和本地输出位置，不再复制框架状态机或历史存储。

## 背景

- 项目升级 0.0.2 后仍用自定义 activation preflight 产生 tag unavailable、在 CLI 手工选择 aggregate Check ID，并自行保存单样本耗时和重排根 Check。
- Vibe 已用 `enabledByFlags`、effective aggregation 和 `dependsOn` 拥有这些语义，也提供 learned critical-path prepared strategy 与 fail-soft 多样本 history。
- 多项命令和全仓库扫描共享四个 root slots；其任务性质足以形成第一版静态资源容量，不需要先用反复耗时拟合猜测限制。
- 固定 publication 目录会让并发 invocation 覆盖机器结果，命令输出仅保留终端尾部也不足以承担完整排障证据。
- 单一 `vibe-gate.ts` 同时承载原生 Check 配置、两类命令 Check catalog、release DAG、进程执行、诊断投影和最终 Definition 组装，虽然没有复制 Vibe runtime，仍增加了定位项目责任的阅读成本。

## 决策

- 采用: release-only executable Check 声明 `enabledByFlags`，需要传递前置时声明 `propagateDependsOn: true`；每次 Run 以 `checks: "effective"` 聚合 Vibe 的原生 flag-and-dependency selection。未命中 release flag 的 Check 保留为 `not-applicable / flag-condition-not-matched`，项目不再翻译成自定义 unavailable。
- 采用: `dependsOn` 独占直接 provider 未通过时的 callback 阻断和 `dependency-not-passed` 结算；项目 callback 只在确实消费 provider data 时防御性读取，不重复翻译 provider status。
- 采用: `createLearnedCriticalPathStrategy` 保存可丢弃的本地多样本 history；identity 包含 Task ID、base/release profile 和项目策略版本，history 不可用只退化选择偏好而不改变 Gate 真值。
- 采用: root `maxParallel` 保持 4，并声明外部进程与仓库扫描容量各为 2；命令 Check、原生扫描、SCC 和 release snapshot 按任务性质取得对应 units，后续只在任务性质或维护反馈变化时调整。
- 采用: 每次 CLI invocation 使用唯一目录分别保存 machine publication、progress、可选 core/scheduler diagnostics 和 Check-owned 完整进程 transcript；终端以单行 messages 展示有界摘要和 transcript 引用，不在一个 message 中嵌入由 renderer 转义的换行，本地目录不自动清理且可由使用者删除。
- 采用: Markdown link validation 启用原生 parse-facts cache；函数指标显式划分严格产品源码、中等自动化脚本和宽松测试区，当前继续作为 non-blocking advisory。Secret detection 保持已选的高置信私钥边界，不因项目没有预期 secret 而扩张扫描种类。
- 采用: `scripts/lib/vibe-gate.ts` 只组装 Definition 并保留稳定项目入口；原生、package-script、semantic 与 release Check 分别进入 `scripts/lib/vibe-gate/checks/`，命令执行、诊断投影和共享契约留在相邻 `vibe-gate/` owner。该拆分只按责任定位必要的项目声明，不在 Vibe 外增加第二套 run、selection、scheduler、lifecycle 或 aggregate 实现。
- 不采用: 继续维护自定义 tag preflight、active Check ID 选择、单样本 scheduling-hints 文件、根 Check 重排或依赖失败翻译层；也不为原生 helper 已拥有的 JSON 存储另建 package-script 缓存计划。
