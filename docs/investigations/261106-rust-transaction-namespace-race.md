---
title: "Rust 候选事务恢复的父链与目录归属竞态"
id: "261106-rust-transaction-namespace-race"
formedAt: "2026-11-06T08:29:57Z"
question: "候选原生事务在删除恢复、删除后验收及 mkdir 后竞争中，是否会写入竞争者命名空间或误报完整恢复，如何保全旧资源？"
tags:
  - "concurrency"
  - "native-cli"
  - "recovery"
  - "rust"
relations: []
---

## 形成时背景

2026-11-06，调查对象是迁移中的 Rust 记录 CLI 候选事务实现，而非现行 TypeScript 生产 CLI 事故。事务需在删除正文或资源后失败时恢复旧数据，并在有非合作进程更换路径组成部分时避免修改竞争者对象、丢失唯一旧数据或错误声称完整恢复。模型不保证非合作编辑的跨文件原子隔离；这不豁免上述保护。该问题依赖并发时序，涉及恢复、验收及数据保全，需保留可独立复核的解释。

## 调查目的

判断删除恢复的父链检查、删除后的验收和恢复 mkdir 的目录归属是否足以抵抗命名空间替换；考察修正与针对性证据能支持的结论，而不把候选实现验收扩展为生产切换、完整平台或性能结论。

## 调查范围与依据

- 独立审查者首先静态检查未提交的 `tools/record-cli/src/transaction.rs`、`transaction/resources.rs` 与 `source.rs`，发现下述三个确定缺口。当次样本 SHA-256 依次为 `acec8f6b1534c37e2335d11031dee2cffeee3a9f45bec1555adc7fe87bc72886`、`9cc57ccb7dc9f228859087a7c284804a748c3f761330c93ac8fee58a9d0f23b2`、`3679ae396e1696761d15781856df3267e30a7a22ff5c0b99daba01ff43a09b93`。旧未提交源未归档，哈希只标识审查样本，不能据此完整重现。
- 首修设置四个时序屏障：`deleted_record_recovery_rejects_replaced_parent_before_creating`、`deleted_resource_file_recovery_does_not_write_into_replaced_parent`、`removed_resource_recovery_rejects_replaced_parent_before_creating`、`removed_resource_ancestor_replacement_fails_postverify_without_rollback`，位于 `tools/record-cli/src/transaction.rs` 的测试中。据实现者记录，后两个修前实际失败，修后事务测试 23 项通过。前两个没有在此声称修前实跑失败。
- 原审查者复核首修时发现 mkdir 后、按名 open 前替换为同 mode 空目录的变体。后续新增 `same_mode_rival_between_recovery_mkdir_and_open_keeps_bytes_in_durable_backup`、`pure_resource_deletion_keeps_durable_bytes_and_mode_when_directory_ownership_unknown`、`changed_backup_is_not_deleted_or_reported_as_verified_on_cleanup_failure`，以及 `tools/record-cli/src/cli.rs` 的 `transaction_failure_keeps_backups_unknown_paths_and_withholds_review`。可从现有测试及其断言核对条件；源码后续仍可能变化。
- 据实现者记录，最终修正后事务测试 26 项及 CLI 映射测试通过，Windows 全目标交叉检查和 clippy 通过，后者不是 Windows 原生运行。原审查者最后定向静态复核认为三个阻断均可关闭；当次 `transaction.rs` 和 `transaction/resources.rs` 的 SHA-256 分别为 `3c8a04e412cfe296e0b9ec40495b9d7326a671a968bbc6ee3a788ec7d62f8c2d`、`fa0bd7d93c840dc866f1bcfe8a289e3e8478e80583421b1615131605efc33229`，源码随后继续扩展，这些不是最终发布版标识。该审查者还独立运行已有 lib 测试 binary `record_cli-b41d3febd0469f20` 中上述同 mode、纯删除、备份变化及 CLI 映射四项，各 1 项通过；binary 修改时间晚于所读源码，但未重新编译，不能断言它由上述哈希重建。这些均为本轮参与者提供的历史证据，并非报告编写者重新执行。

## 调查结果与边界

初审识别了三个相关但不同的缺口：

1. 删除正文、资源文件或目录的恢复仅重新 `capture_missing` 并创建，没有在创建前与原父链对比。竞争者替换祖先后，恢复可能把旧数据写入竞争者目录；正文事后对比不能撤销已发生的写入。
2. 删除后验收以任意 `removedAncestor` 布尔例外或仅以 `Missing` 放行，可能掩盖更上层未删除祖先的漂移，错误报告成功。
3. `mkdir` 后按名称打开不能证明打开的是刚创建的目录；把它当作拥有的对象并按 Exact 模式修改权限或属性，可能修改竞争者对象。

首修将恢复写入前的父链与原证明比较，仅允许日志证明已删除的祖先；Exact mkdir 不再修改仅观察到的对象属性。原审查者确认第二、第三个初始阻断得到处理，但进一步发现：资源恢复仍把 mkdir 后 Observed 当作重建目录。原四项屏障在 mkdir 之前替换父目录，权限测试使用不同 mode；因此均不足以排除 mkdir 后、open 前出现同 mode 竞争者目录。此时仍可能将旧子文件写入该目录并误报 `RolledBack`。

最终修正不将任何恢复 mkdir 后的 Observed 升级为归属证明，也不向其中恢复子文件。资源 `RemoveFile` 前在可信事务根独占建立 `.record-cli-recovery-<pid>-<seq>.bak`，通过真实句柄写入原 bytes 和 mode、sync 并独立读回，删除前再次校验。恢复部分或未知时保留目录及副本；成功或完整恢复才条件清理，副本后来变化则保留且不假称有效。失败 CLI 输出恢复备份的 source、backup、mode，以及恢复目录和未知路径，不返回成功 review。同 mode 回归在纯删除时于 mkdir 与 open 间替换空目录，断言竞争目录保持为空且可从备份读回原 bytes 和 mode。该反例与最终复核支持本轮对已识别阻断的关闭判断，不证明任意并发情形都安全。

上述 sync 和读回不是断电持久性保证。领域资源的 prepare 到 shared 首次 capture 之间，仍需 `Operation.fresh` 对 prepare 时 tree、parents、members 的对比；形成时审查范围内已接入的实际 operation 使用 `resources=[]`；该历史观察不描述后续接线状态，也不是已证实的生产命令故障。Windows 原生运行、全 CLI、Case、完整 Gate、性能及生产切换均未由本轮证据证明；这些条件或恢复实现改变时应重新验证。
