# 原生平台候选验收

本记录针对候选提交 `be1e9c4053e292a0ea3d0959f275e4cc1295f677` 的 [Record CLI Candidate 运行 42215386882](https://github.com/zxyycom/skills/actions/runs/42215386882)。它不证明其他提交、正式发布、生产 updater 或真实用户安装。下列结果取自同次 job 日志和 workflow artifact；不运行下载的二进制代替原生 runner 验收。

## Ubuntu 22.04 原生：通过

[Ubuntu job](https://github.com/zxyycom/skills/actions/runs/42215386882/job/127883976040) 成功；同次 artifact `record-cli-candidate-ubuntu-22.04`（ID `13500727529`，保留期以 Actions 为准）记录 revision 与目标一致。实际环境：x86_64 Linux 6.8.0-1070-azure、glibc 2.35、ext4、Git 2.56.0、Rust/Cargo 1.98.1。原生 Cargo 测试日志显示 189 个 library 与 122 个 integration 节点通过、无失败和忽略；两个无测试 bin target 各 0 项。Node 离线协议测试 3 项通过，项目 Case 引用与覆盖检查报告 2,147 个实体通过。来源 snapshot 验证不代表测试执行，二者是独立检查。

同次 runner 的 `verify-real.ts --build` 报告实际构建、私有安装 A、第一次替换后故障回退、成功更新 B 及已安装二进制的版本和帮助检查通过。A 为 `0.1.0`、B 为 `0.1.1`，target `x86_64-unknown-linux-gnu`。artifact 中的 manifest、source-files 和二进制来自该次运行；独立读取下载资产核对字节数与 SHA-256 均匹配 manifest：

| 候选 | 来源 SHA-256 | DR 二进制 SHA-256 | IR 二进制 SHA-256 |
| --- | --- | --- | --- |
| A | `74cd57dfc4e5e69d2abb413e21e621b674141da59d57812015c5d6fc65f0140b` | `181a0d44e953c5bb88b8eadf7a2e7a9dea70dfe4160a4cf301beb45d78bef59d` | `745af114396a2849871afaa4a5087c50d491a4a3460c6f39a5bc94890a3173ca` |
| B | `ec10c4fb41e653cd4bff75e2f7fb78e5d3962d253efeba00527f582efef5c6f4` | `d6c2f1ac70033a74175c45020276d32d53c2c63295e50799f8a24c1c176e2d07` | `b0fc5aa0ec7af7199400e32349893653e5022a8ad3bb9f0be985847320fc816b` |

## Windows 2022 原生：进行中

[Windows job](https://github.com/zxyycom/skills/actions/runs/42215386882/job/127883976325) 自 12:10:01 UTC 起停留在 Rust native tests，12:25 UTC 后仍在运行，尚无完成结论；只读运行中日志下载端点返回 404，无法判断具体测试状态。静态核对发现部分事务竞态测试使用无超时的双向 `Barrier::wait()`：worker 若在到达 hook 前退出，测试主线程会一直等待；这是可疑机制而非对当前执行节点的事实判断。不将 Linux 或 Windows 交叉编译作为原生通过证据；完成后再核对日志、Case 和同次 artifact。
