# 原生平台候选验收

本记录针对候选提交 `be1e9c4053e292a0ea3d0959f275e4cc1295f677` 的 [Record CLI Candidate 运行 42215386882](https://github.com/zxyycom/skills/actions/runs/42215386882)。它不证明其他提交、正式发布、生产 updater 或真实用户安装。下列结果取自同次 job 日志和 workflow artifact；不运行下载的二进制代替原生 runner 验收。

## Ubuntu 22.04 原生：通过

[Ubuntu job](https://github.com/zxyycom/skills/actions/runs/42215386882/job/127883976040) 成功；同次 artifact `record-cli-candidate-ubuntu-22.04`（ID `13500727529`，保留期以 Actions 为准）记录 revision 与目标一致。实际环境：x86_64 Linux 6.8.0-1070-azure、glibc 2.35、ext4、Git 2.56.0、Rust/Cargo 1.98.1。原生 Cargo 测试日志显示 189 个 library 与 122 个 integration 节点通过、无失败和忽略；两个无测试 bin target 各 0 项。Node 离线协议测试 3 项通过，项目 Case 引用与覆盖检查报告 2,147 个实体通过。来源 snapshot 验证不代表测试执行，二者是独立检查。

同次 runner 的 `verify-real.ts --build` 报告实际构建、私有安装 A、第一次替换后故障回退、成功更新 B 及已安装二进制的版本和帮助检查通过。A 为 `0.1.0`、B 为 `0.1.1`，target `x86_64-unknown-linux-gnu`。artifact 中的 manifest、source-files 和二进制来自该次运行；独立读取下载资产核对字节数与 SHA-256 均匹配 manifest：

| 候选 | 来源 SHA-256 | DR 二进制 SHA-256 | IR 二进制 SHA-256 |
| --- | --- | --- | --- |
| A | `74cd57dfc4e5e69d2abb413e21e621b674141da59d57812015c5d6fc65f0140b` | `181a0d44e953c5bb88b8eadf7a2e7a9dea70dfe4160a4cf301beb45d78bef59d` | `745af114396a2849871afaa4a5087c50d491a4a3460c6f39a5bc94890a3173ca` |
| B | `ec10c4fb41e653cd4bff75e2f7fb78e5d3962d253efeba00527f582efef5c6f4` | `d6c2f1ac70033a74175c45020276d32d53c2c63295e50799f8a24c1c176e2d07` | `b0fc5aa0ec7af7199400e32349893653e5022a8ad3bb9f0be985847320fc816b` |

## Windows 2022 原生：未通过，运行经授权取消

[Windows job](https://github.com/zxyycom/skills/actions/runs/42215386882/job/127883976325) 使用 Windows Server 2022 Datacenter build 20348、64 位、NTFS、Git 2.56.0.windows.4 和 Rust/Cargo 1.98.1。格式与 Clippy 步骤通过；原生 Cargo tests 日志在 12:10:54–12:10:56 UTC 报告 **41 个测试节点 FAILED**，涉及 CLI、领域 mutation、资源、目录迁移和事务，不能把它们合并归因为同一缺陷。另有以下四个节点在 12:11:56 UTC 被 runner 标为运行超过 60 秒，直到用户授权取消运行前未见完成结果：

- `transaction::tests::backups_namespace::newly_created_namespace_rejects_concurrent_unjournaled_member_after_commit`
- `transaction::tests::parent_guards::removed_resource_ancestor_replacement_fails_postverify_without_rollback`
- `transaction::tests::resource_recovery::deleted_resource_file_recovery_does_not_write_into_replaced_parent`
- `transaction::tests::resource_recovery::removed_resource_recovery_rejects_replaced_parent_before_creating`

运行于 12:38 UTC 经用户明确授权取消，job 和整体 run 的最终结论为 `cancelled`，并非完成的测试结论；因测试 harness 未结算，日志没有失败节点的 panic 明细。完整节点名单见 job 日志；[Windows artifact](https://github.com/zxyycom/skills/actions/runs/42215386882/artifacts/13501718949) 仅含环境记录，没有 A/B 资产或交付验证结果。Windows Case 覆盖、真实离线安装与更新回退均未运行，不能声称平台验收通过。

静态检查发现部分上述竞态测试原先使用无超时的双向 barrier，若 worker 提前退出，主线程可能持续等待；这是有依据的测试可靠性风险，不足以确定这四个节点的具体根因。后续测试同步已另行修改，但尚未在 Windows 原生运行；需在受测新 revision 的原生 job 获取失败详情、修复实际产品或测试原因，再重新验收。
