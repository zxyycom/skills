# 独立正确性审查

## 当前结论

**Pass：已审切面未见剩余实质阻断。** selected 与 reader 责任重组静稳后，已重读协调器、来源生命周期、worker 生命周期、协议与 guard 调度差异；独立 4 项 selected probe、2000 次权限拒绝 / 0 worker probe、7 个 reader 原生入口和 4 个 selected fresh 原生入口均重跑通过。没有运行完整 Gate、聚合回归或性能测量，不以这些局部结果替代根验收。

审查只读正式产品、测试、Case 与生成文件；本文件是审查代理唯一仓库写入。Node 为本环境 v26.8.2，未外推其他平台或 Node 最低版本。

## 已闭合安全问题

根审查提出、reader 实现者实证的 `execArgv: []` 权限放宽已修复：不再清空父 flags；Node permission 或 `--input-type` 调用预先选择原进程 async，不启动 worker，不在 worker 失败后重试。

独立命令：

```text
node --permission --allow-fs-read=/workspace/skills --allow-fs-read=/tmp/record-perf-correctness-review/permission-probe.mjs --allow-worker /tmp/record-perf-correctness-review/permission-probe.mjs
```

结果：text 与 file-snapshot 各 1000 次真实拒绝，2000 次均为 `ERR_ACCESS_DENIED`，保留原 `permission: FileSystemRead`，0 worker。目标目录 `/tmp/record-perf-correctness-review/denied/` 未被授权；命令授权的精确 probe 文件不是该目录。

## 独立 fixture

执行 `node /tmp/record-perf-correctness-review/probes.mjs`，4 项通过：

- 非 canonical 但可解析的 DR baseline 被拒绝，索引字节未改写。
- 所选 DR 新增 after 关系后，必要未选依赖当前正文有未发布变化时拒绝，索引字节不变。
- 现存 DR 归档来源的父目录被替换时拒绝，即使来源字节相同；索引不变。
- IR 所选报告跨 owner 引用资源，未选 owner 当前正文 dirty 时拒绝，索引不变。

额外边界实证：缺失 DR archive 来源在两次采集之间换成另一个安全空 archive，selected 删除仍可成功；缺失的 `null` 不承载跨阶段父链身份。根已确认采用“两次独立安全缺失”契约，不新增不存在实体的 inode/mode 或缺失父链等价要求；现存来源仍比较 bytes/identity/mode/parents。此项不是阻断，也不是未知位置发现能力。

第一次私有 fixture 运行因我使用了 IR 的关系类型构造 DR 输入、并遗漏 IR formedAt 日期而失败；修正自有 fixture 后上述 4 项通过。该失败不归因产品。

## 原生入口独立执行

```text
node --test --test-name-pattern='permission-constrained|input-type consumers' tools/record-operations/tests/reader-batch.test.ts
```

2/2 通过：真实 Node permission 拒绝且 0 worker；input-type 消费者维持原进程 async。

```text
node --test --test-name-pattern='consumer failure|actual observations|malformed replies|shutdown closes|unified candidate discard retains' tools/record-operations/tests/reader-batch.test.ts tools/investigation-report/tests/execution-entry-contract.test.ts
```

5/5 通过：consumer/abort 收束且无晚到回调、verifyMany 保留 actual 而非 expected 引用并在新 phase 重读、Node 启动/协议/提前退出失败、worker 真实 FD 关闭、候选删除解锁失败保留真实 mutation/scope 且无伪 indexPath。

```text
node --test tools/decision-records/tests/selected-local-contract.test.ts tools/investigation-report/tests/selected-local-contract.test.ts tools/investigation-report/tests/execution-entry-contract.test.ts
```

18/18 通过，涵盖基线局部性、old/new 同选、缺失删除与未知身份、必要依赖与删除闭合、source/index later winner、UTF8/link/mode、旧 owner 残留/后来创建/无关 owner、rename busy/preflight 与单锁 discard。

## 静态审查边界

已读 selected coordinator、两域适配、前后关系和资源 owner 依赖、原生 prepared/selected fresh/发布接点；未修改通用 Index Runtime。已读 worker 队列/同步读取/协议/错误恢复、两域批量采集、strict proof、transaction verifyMany 与 IR rename/discard 入口。

worker 在正常协议下有序回传，64 路径 / 约 8 MiB 为软背压，不截断单文件；consumer 结束后关闭并等待 exit，sync reader finally 关闭 handle。错误类型与可用系统 code 保持，基础线程故障不变成空结果。verifyMany 仅在同阶段对完整等价预期复用 actual，新 phase 不复用事实。

公开 coverage/CLI/声明与已读 owner 当前一致：checkedIds 是所选身份标签（含删除/更正旧新身份）及必要依赖，不意味着所有标签都仍存在或未知位置发现完整。Case/索引生成仍由实现者与根最后统一确认；本审查不声明生成安装、完整账本或完整 Gate 已通过。

私有 probe 与自有 denied fixture 暂保留在 `/tmp/record-perf-correctness-review/` 供本次复核，独立运行自动创建的临时领域集合均在 finally 精确清理；本轮结束后可删除该自有目录。

## 最终重组快照复核

重组后重新完整读取 `SelectedSynchronization` / `SelectedRecordSources` 与 `RecordReadWorker`、同步 worker chunk、协议 error 投影和 `scheduleGuards`；来源安全算法仅有 guard brace 表达变化。selected fresh 时序仍为真实来源重读 → baseline snapshot 比较 → 资源/旧 owner 重新验收；不是跨阶段借用旧领域验收。

再运行 `node /tmp/record-perf-correctness-review/probes.mjs`，4/4 通过；额外缺失路径观察符合根已明确的安全缺失边界。独立权限命令重跑，2000 拒绝 / 0 worker 通过。

```text
node --test --test-name-pattern='consumer failure|actual observations|malformed replies|shutdown closes|permission-constrained|input-type consumers|backpressure' tools/record-operations/tests/reader-batch.test.ts
```

7/7 通过，包含软背压大单文件与下一 chunk 真实采集。

```text
node --test --test-name-pattern='later old owner|later source bytes|mode drift' tools/decision-records/tests/selected-local-contract.test.ts tools/investigation-report/tests/selected-local-contract.test.ts
```

4/4 通过，重新覆盖 source/index later winner、unsafe/UTF8/mode 和后来创建旧 owner。

审查覆盖的核心源码 SHA-256：

```text
674df21bde357060a4344a16ba4acb898048cf391bfaa04ebcb7264f38dd3bff  selected-synchronize.ts
d063c556e1dc90e9aeb1fcffa0cbbbc149696c312a6932fcbf17dfd62e9cc6e8  selected-sync-sources.ts
9baae4e3ca6d0a60744265343e93aa684166106a64439dcca3b00aa4a74b1df0  reader-batch.ts
3f1a40b32e36c793949df317d5153139235feef6ce9c1ceb10415935765a49b0  reader-worker.ts
c898d6842e9cd1e936d33f3dfbac1d4eaae9c5a0fc0bac5812cfea63b2af0c26  reader-protocol.ts
9d8ec07ebf99b50c9f0bf596ed55040ec478d5a162e614d727a774ee7f9e6a63  reader-sync.ts
376ec1e5497360468eda989dfaee83b3ca2bbb826b4c268ece11c62f22b30807  transaction-verification.ts
```

上述文件归属 `tools/record-operations/src/`；统一 discard 的 `tools/investigation-report/src/discard-entry.ts` 为 `5b8da48c3b5cbbe0a887e99fbb6cf469ed6ea62dc3e224d751456d9356939c33`。最终生成闭包、完整测试证据索引、跨平台/最低 Node 与完整 Gate 仍由根/实现者单独验收，不从本审查的源码 Node 证据推导。
