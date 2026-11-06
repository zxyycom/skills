---
title: "Rust 候选跨阶段验收读取错误的诊断丢失"
id: "261106-rust-verification-error-causes"
formedAt: "2026-11-06T14:57:42Z"
question: "暂存、提交后验收与恢复复核为何将采集失败误报为漂移，如何保留原因而不改变事务状态？"
tags:
  - "diagnostics"
  - "native-cli"
  - "recovery"
  - "rust"
relations: []
---

## 形成时背景

2026-11-06 审阅迁移中的 Rust 记录 CLI 候选，基线为 Git `380594f2`，并非现行 TypeScript 生产入口事故。共同操作模型要求读取、权限和安全失败保留真实语义，同时提交后不得自动回滚；本轮发现多处验收与恢复复核将无法采集事实统一解释为事实已漂移。问题跨暂存、事务提交后和恢复多个阶段，影响失败诊断及对账，故独立记录。先前 [命名空间竞态调查](./261106-rust-transaction-namespace-race.md) 关注恢复归属和数据保全，不是本问题的直接前序。

## 调查目的

区分采集失败与采集成功后的事实不符，定位错误被抹去的位置；判断最小修正是否保持原事务状态和提交边界。范围不包含生产切换、架构重写或新增安全保证。

## 调查范围与依据

- 对照基线 `380594f2` 与本轮工作树的 `tools/record-cli/src/stage/publication.rs`、`transaction/postverify.rs`、`transaction/recovery.rs`，并读取 `source.rs`、`source/missing.rs`、`stage/source_capture.rs`、`tools/record-operations/model.md` 的相关分支。基线静态对照证明旧分支如何归类，不能代替修前动态复现。
- 对照本轮新增 `stage/tests.rs` 与 `transaction/tests/capture_errors.rs` 的输入和断言。测试使用临时目录和私有阶段钩子：将受保护或已写文件替换成目录产生 `Unsafe`，将已删除路径的父目录替换成普通文件产生 `NotADirectory`；另一受保护文件实际改写提供漂移对照。暂存测试分别注入 `FreshnessError::Read` 和 `Drift`，并检查有写入时的已提交路径。此方法不依赖 root 用户下不可靠的 chmod 权限拒绝，也不证明 `EACCES` 已实测。
- 报告编写者在 Linux 工作树独立运行 `cargo test --manifest-path tools/record-cli/Cargo.toml capture_errors -- --nocapture`，lib 中 5 项通过；同命令过滤词换成 `publication_`，lib 5、authoring 5、git_stage 4 项通过，其中含本轮两个暂存测试。测试时 `stage/publication.rs`、`transaction/postverify.rs`、`transaction/recovery.rs`、`transaction/tests/capture_errors.rs`、`stage/tests.rs` 的 SHA-256 依次为 `0813355792d76542df50dd539c8d3655278b18a3e79c2e0fd6768c6da37209be`、`c1cee969e59accc5f8335913bb432bc90bc01dd1c78c3a958e657ff80052238b`、`e35ccf3ba28cb190bbeb6a0ab4179d1de5a4537958b40cdab9d194b34e222ef2`、`c2e17b6ac943dc9fd5a1158fdca9bf14460cf1a9d8fa5608ad44a8ac315a2dcb`、`b52ca6631fd82537e23af4fc36f41353ced810b2eacc776d45d80273e9922a62`；哈希只标识这几份输入，不证明完整构建输入。
- 独立恢复审阅认为原状态处理保守：提交后验收失败保留 `PartialOrUnknown`，不自动回滚；诊断丢失不等价于已证实数据破坏。下述测试和实现只覆盖所述输入，不是所有平台及故障的证明。

## 调查结果与边界

**机制。** 原暂存发布在 `changed_paths` 为空时，将 `verify()` 的任何错误都映射为 `Drift`，故读取失败被误说为变化。已有 `phase_freshness_error` 将 `Read` 映射为 selection 失败、`Drift` 仍映射为漂移；此阶段的 Read 类型本身不包含底层详细原因。已有变更路径时，保留 `CommittedUnverified` 和路径，不能为了改善诊断回滚已提交 pending。

事务写后验收原先将 `capture` 或 `capture_missing` 的错误归入 changed／不再安全缺失；恢复原范围核对同样用通配分支将错误归入 original scope changed。`capture` 的成功缺失与采集错误不同：仅成功采集后事实不符才能按不匹配解释。对于 `capture_missing`，`SourceError::Changed` 本身表示缺失证明不再成立，仍保留原不匹配诊断；其他错误带原阶段码、路径和底层错误信息。恢复继续遍历其余受保护路径并累积诊断，避免一个读取失败遮蔽其他真实漂移。

**修正边界。** 本轮改为上述分类和原因传播，不改变提交点、恢复策略或成功条件。测试断言提交后写入的 record 与 index 保留，状态为已提交、验收失败或未知、`PartialOrUnknown`；提交前注入恢复场景同时保留读取错误与另一条漂移诊断，并核对旧 record 和 index。测试还覆盖删除路径父链读取失败及无写入暂存的 Read／Drift 区别。代码和测试由当前事实 owner 承接，报告保存形成时认识，不构成现行 API 规范。

**边界。** 此为候选实现和受控输入下的诊断修复，非完整 CLI、所有系统错误、所有竞争或 Windows 原生行为证明；旧性能结果不能证明本轮性能。上述定向运行不等于完整门禁。
