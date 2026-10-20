# Vibe Check API 适配清单

本表用于实施 0.0.2 → 0.0.4 的实际调用方适配；设计由 [design.md](design.md)承接，
精确签名以[固定发布包](upgrade-evidence.md#来源与身份)的 docs/types 为准。

## 项目调用入口

| 项目位置 | 核对范围 |
| --- | --- |
| `scripts/vibe-check.ts`、`scripts/vibe-check-invocation.ts` | controls、flags、aggregation、RunResult、输出状态及退出码。 |
| `scripts/lib/vibe-gate/definition.ts`、`checks/` | Check 构造、callback/context、原生 options、资源、命令、typed handoff 及 learned helper。 |
| `scripts/lib/vibe-gate/impact-*.ts` | 文件选择、完整输入、activation 和成功证明发布。 |
| `scripts/vibe-check*.test.ts`、`scripts/lib/vibe-gate/*.test.ts` 及 catalog fixture | 上述项目接线的直接调用、类型替身、输入和结果消费。 |

## 必须适配的契约

### Callback 与 Check 类型

- `preflight/execution` → `prepare/execute(options, context)`，options 从第一参数取得；
  CheckExecutionContext 的 options 泛型和字段退出，原因码同步适配。
- context 需求分七阶段：check.prepare/execute、scheduler.prepare/decide/terminal、
  command.environment/complete。普通函数得到冻结空 context；需字段时使用 defineContextCallback
  和精确 literal needs。具体 descriptor 的直接调用使用 `.callback`，自行提供所需 context。
- authored/prepared shape 不同时提供 prepare，typed parser/handoff 保持类型推导。
  泛化 Check 集合会擦除 options；在原生构造器声明项目字段，替代破坏具体类型的 spread wrapper。

项目验证覆盖 environment/package/semantic/release 调用方、closure/JS 调用和相应测试替身。

### Flags 与聚合

- `enabledByFlags: { flags, mode }` → `{ when, propagateDependsOn? }`。
  表达式采用 all/any/none/notAll/exactlyOne/not，保留 AST 顺序与重复；依赖传播限于 dependsOn。
- ProjectDefinition.changes / changeFlag 是 compareWith + regions 的 revision 路径证据。
  caller 注入 flags 与原生保留 token 分开，可信空 evidence 与 unavailable 分别消费。
- CheckAggregation 从策略对象改为同步函数；严格默认要求有效集合非空且全部 passed。
  completed/output 分支的 aggregate 有值；自定义聚合抛错、返回 thenable 或非法结果可拒绝 Run Promise。

项目验证覆盖 activation、CLI 聚合及异常结果处理：环境每次执行，成功复用保持真实未激活状态，
成功证明等待最终 Run 成功。

### 文件选择与原生 Checks

- ProjectFileSelection 的 `{ source, include, exclude }` → `{ patterns, useDefaultExcludes? }`。
  完整正负列表按顺序解释；默认排除独立于业务规则。新版扫描磁盘、不读 Git ignore、排除 symlink。
- 原生构造器接受项目声明，ID inference 随 overload 不同；项目字段与领域 options 分开。
  保持 provider 原对象身份，按对应能力使用 prepare/execute/parseData。
- Markdown link budgets 增加 false 分支，warnAboveBytes 为 warning；保持项目有界配置，
  链接目标和锚点由本次原生验证承担。
- 指标按实际项目 Records 归因；parseFileMetricsData/parseFunctionMetricsData 的消费随之复核。
  machine schema v4 保持不代表测量值不变。
- 使用 omitQuietPassedRow 时，只省略无 Records/messages 的安静 passed 人读行，机器事实保留。

项目验证覆盖实际 patterns、规则、预算与结果呈现；Windows 等运行平台按实际可用环境报告。

### 命令与私有交接

- commandCheck 默认 exact-empty environment 和 discard output；项目显式配置环境继承、transcript、
  限额及 artifact capability。afterCommand 只处理完整稳定协议。
- CheckResult<Data, Handoff> 的 handoff 为 passed-only 非空对象引用。
  dependencies.get(provider) 仅授权本 Run 的 direct dependsOn；字符串读取仍观察 canonical outcome/data。
- 发布 provider → authorization → pack 消费同一引用；parser 继续只处理公开 data，machine 输出保持摘要。

项目验证覆盖实际 argv/cwd、环境和诊断，以及同快照、直接 provider 身份和跨 Run 隔离。

### Scheduler 与 Run 输出

- `complete` → `terminalEffect`，Definition/outputs 的 measurementHooks → terminalEffects；
  callback 按 phase 声明所需 context。
- decision 的 measurement.cumulative → cumulative，measurementCount/measurementAt → actionHistory；
  terminal 的 rawMeasurement → runMeasurement + taskTimings。逐 Task timing 先收窄 availability。
- 原生 learned helper 已提供所需 descriptor：prepare 请求 graph，decide 请求
  activeScopeIds/candidates/capacity，terminalEffect 请求 execution/taskTimings。
  项目只迁移实际直接 consumer，identityForTask/observe 保持其业务签名。
- history 不可用时按 helper 契约退化；非法 factory 配置属于项目配置错误。
  observe Promise 不被 await，需要持久化观察事件时由实际 sink 负责 flush。
- RunOutputStatuses/diagnostic 使用 terminalEffects / scheduler-terminal-effects-failed。
  effect 失败可同时出现 Run kind=output 与 aggregate=passed；CLI 必须区分最终 Run 及聚合结论。

项目验证覆盖 helper 配置、任务可比身份、history 归属及实际回调调用，保留资源约束和最终结果消费。

## 项目采用的路径能力

`impact-snapshot.ts` 使用 `createProjectFileRegionIndex`，为已声明的 patterns 计算路径成员关系，
再由项目对选中内容形成输入身份。输入读取、工具链探测、保守执行与最终成功发布仍归项目；
该 region 关系不代替成功 receipt，也不自动推导跨 owner 的实际消费依赖。

## 包根变化核对

Readiness 的静态具名 import 审计涉及 18 个脚本文件、19 个符号；两版包根类型声明与 ESM 导出比较如下：

| 导出 | 0.0.2 | 0.0.4 | 变化 |
| --- | --- | --- | --- |
| Runtime values | 28 | 49 | +21 |
| Types | 127 | 178 | +57 / -6 |
| 合计 | 155 | 227 | 149 个名称保留 |

新增 runtime 按责任归入：数据 6、context 1、flags 7、文件 4、Check 3，已在上文覆盖。
移除 type 的后继如下；当前无直接导入移除项，但同名 Check/context、Scheduler 和 RunResult 存在兼容影响。

| 移除 type | 后继 |
| --- | --- |
| ProjectFileSource | 磁盘 patterns |
| CheckPreflight | CheckPreparation |
| CheckPreflightResult | CheckPreparationResult |
| AdmissionPolicyMeasurement | SchedulerActionHistory + cumulative |
| SchedulerMeasurementHook | SchedulerTerminalEffect |
| SchedulerRawMeasurement | SchedulerRunMeasurement + SchedulerTaskTimings |

本表是兼容工作清单；验证对象按 design 限定为项目调用方，而非逐 API 重建上游机制测试。
