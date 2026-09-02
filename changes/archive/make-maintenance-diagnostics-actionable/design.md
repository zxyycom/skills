# Design

本 design 为共享版本控制、领域事务和两套 CLI 定义最小、分层的即时诊断契约：共享层陈述可证明的失败事实，事务只在 mutation 时声明结果，CLI 恢复为用户可读的下一步。

## Context

- `VersionControlError` 当前以少量 code 和 message 为主；多个捕获点在构造前丢失 Node cause 或 Git stderr。pending replacement 对锁冲突之外的错误和恢复过程缺少可行动区分。
- index-runtime 已有稳定 diagnostic code/state，但会把多种 pending 失败压成相同 repository-access 建议。
- Decision Records 的结果和 CLI 大量传递字符串 errors/warnings；Investigation Report 虽有部分结构化 `changed`，但参数、来源、索引、关系、历史、资源和 discard 等路径仍直接拼接异常文本。两套 mutation lock 均把任何取锁失败提示为当前事务。
- Investigation 的 unrecorded predecessor 是非阻断 warning，当前 Git 异常可能被吞掉；Decision 历史、lifecycle 与两套 destructive discard 的 Git 判断则是安全门禁。
- [`diagnostics-matrix.md`](diagnostics-matrix.md) 记录本 Plan 已知用户可见类别、其 owner、最低字段、输出和测试策略。它用于完成审计与验收，不取代源码、skill 契约或测试证据 owner。
- `prepare-record-candidates-before-establishment` 依赖本 Change 的共享分类与 CLI renderer；它不得建立临时的平行错误协议。

## Goals / Non-Goals

目标：

- 用可靠系统证据和清楚的事务阶段，让用户从一次 CLI 输出得知对象、原因和安全下一步。
- 让普通错误与 mutation-capable 失败采用不同的字段要求，不再把“所有失败”表述为写入结果。
- 让 shared、index-runtime、领域事务与 CLI 各增加一次自己拥有的事实，保留可测试的稳定字段。
- 让未知、检查未完成与恢复不完整保持诚实，并保持既有 stdout/stderr 与退出码语义。

非目标：

- 不建立通用日志平台、结构化持久日志、遥测、远程上报、receipt、国际化框架或异常堆栈 UI。
- 不自动申请权限、调用 `sudo`、删除 `.git/index.lock`、修复仓库或自动重试写入。
- 不承诺从任意 Git stderr 识别平台策略；无强信号时保留 `command-failed` 或 `unknown`。
- 不以诊断改造改变领域授权、确认门禁、成功语义、退出码，或重写目标边界外工具的文案。
- 不把抽象的公共诊断类、存储或 renderer API 预设为长期 SDK；仅要求实现能兑现本设计的字段和输出边界。

## Decisions

### Intended Change

#### 分层事实与输出

信息单向增加，任何层都不得替代它无权证明的层：

```text
系统/Git cause
  -> shared：operation event、cause category、target、受控 detail
  -> mutation transaction owner：scope、outcome（仅 mutation-capable 失败）
  -> domain：Decision/Investigation 对象、严重性与领域下一步
  -> CLI renderer：即时、按序的恢复文本
```

普通最终诊断的最低字段是：稳定 `code`、失败对象、原因和下一步。系统错误仅在可靠时添加 `causeCategory`，可安全展示时添加净化 `detail`。每个诊断只在当前命令输出期间存在；成功仍写 stdout，失败/attention/warning 仍写 stderr，现有退出码语义不变。

共享版本控制错误以实现可替换的稳定事实表达，而非仅一段 message：`code` 表示 operation event，`causeCategory` 表示可靠原因，`operation` 是受控动词短语，`target` 是安全路径/范围/逻辑目标，`detail` 是经过 trim、单行、限长和敏感模式处理的系统/Git 信息。原始 `cause` 只保留进程内归因或测试，绝不递归显示。共享层不输出整个命令的 `scope/outcome`。

领域事务在它拥有提交点与恢复证据时，才以明确 scope 搭配 `no-change`、`rolled-back`、`partial-or-unknown` 或 `committed-cleanup-pending`。读取、查询、参数、内容和纯语义失败即使发生在最终命令中，也不得为了统一格式虚构 mutation 字段。领域输出可补充 Decision ID、Investigation ID、关系或参数位置，但不再嵌套共享 message 形成重复失败前缀。

#### 分类与恢复边界

分类仅基于可靠证据：Node `EACCES/EPERM` 为 `access-denied`；锁文件 exclusive create 的 `EEXIST` 为 `busy`；Git executable 启动 `ENOENT` 为 `tool-unavailable`；明确 worktree discovery 为 `not-repository`。仓库策略没有稳定机器信号，不单列 `repository-policy`；相应 Git stderr 与其他非零结果保留为 `command-failed` 和净化 detail，无法证明时为 `unknown`。

`EEXIST` 只证明目标冲突，不能断言活动事务仍在运行。busy 的下一步是先等待或确认已知并发 Git/领域进程；没有活动进程才检查遗留锁。工具绝不自动删锁。access denied 的下一步是使当前进程获得该对象的必要读/写权限，或在已授权环境重试原命令，不指定宿主授权机制。

必要的 Decision 历史/lifecycle 与 destructive discard Git 检查继续 fail closed；在检查失败时输出其对象、原因、下一步及明确 mutation scope 与 `outcome: no-change`（若该命令是 mutation-capable）。Investigation 的非阻断前序历史检查产生独立的 `history-check-unavailable` warning，明确“检查未完成”，不把 unknown 转成无前序或无 warning。参数、内容和关系闭包等领域错误使用领域 code，不伪装成系统异常或附加权限建议。

#### 审计、兼容与验证

矩阵以类别而非实现文件作为完成边界。实施先为每个矩阵行定位实际 producer、最终 renderer、对象来源、是否 mutation-capable、退出码和现有测试；发现的同类用户可见失败必须并入对应行或新增最小行，并回写 proposal/design/tasks。矩阵不保存逐调用点清单、测试证据副本或持久运行日志。

共享类型变更先盘点直接消费者。对既有稳定 code 采用显式映射或兼容迁移；公共边界只保持字段语义与可观察 CLI 行为，具体 class、helper 或 renderer 组织由实现选择。定向测试主要断言稳定字段和 mutation 事实；少量 CLI 集成只断言必要段落，不锁定完整语句或原始 strerror。

### Resulting Impacts

#### 领域事务与消费者

所有直接 `VersionControlError` 消费者、index-runtime 映射与两套 CLI renderer 必须迁移到分层字段。只为继续兼容共享类型而受影响的其他消费者保持现有行为；它们不自动进入本 Change 的文案审计。每个 mutation-capable 事务要在写入前、可恢复阶段、恢复失败和提交后清理点产出自己能证明的 scope/outcome；相邻 transaction 或 CLI 不得扩大结论。

#### 契约、分发与证据

Decision Records 和 Investigation Report 的固定契约、恢复指南与人类说明要说明阻断/warning、恢复边界及四种 outcome。若实现验证后形成稳定跨工具判断，再创建 Decision Record；本 Plan 不替其预设或创建。公开类型、声明源、生成 CLI/source map、skill 版本和 Test Evidence 按各自 owner 同步，不能手改生成产物。

## Risks / Trade-offs

| 风险或取舍 | 控制 |
| --- | --- |
| taxonomy 膨胀为平台或日志系统 | 类别只保留会改变下一步或 mutation 判断的事实；矩阵按用户可见类别收敛 |
| 任意 Git stderr 的分类不稳定 | 优先系统 error code/明确状态；其余保留受控 detail、`command-failed` 或 `unknown` |
| detail 泄露 token、远端 URL 或本机敏感路径 | 单行、限长、敏感模式处理；优先仓库相对 target，不输出 command/env/stack |
| 全部错误都出现 outcome，掩盖事实 | 只由 mutation transaction owner 填充；普通错误明确无 mutation 字段 |
| 共享类型改动波及其他工具 | 在变更前盘点直接消费者，显式兼容映射并用 typecheck/定向测试门禁 |
| 审计扩大为全仓文案重写 | 矩阵限定为两套目标 CLI 及共享调用链的已知用户可见失败；按信息缺口而非措辞统一实施 |

## Open Questions

无。Readiness 中尚未完成的逐事务提交点盘点、直接消费者盘点和诊断生产者核对，是实施前必须取得的证据，不是范围或方案的不确定性。

## Plan Use Contract

- 实施者先按矩阵完成每行 producer/renderer/mutation 判断，再修改共享类型；不可用一条共享 message 覆盖不同领域结果。
- `code`、`causeCategory` 与 `scope/outcome` 是不同轴；将它们重新压成单一字符串或由共享层推断事务结果，均不满足本 Plan。
- 本 Plan 的“已知用户可见失败”限于 Decision Records、Investigation Report 及共享调用链；发现同类遗漏时更新矩阵，范围外工具只作必要兼容。
- checkbox 仅记录证据。除已完成的文档与依赖审阅外，未完成的源码调查、实现和验证不得勾选。
