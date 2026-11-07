---
title: "Rust 记录事务改造前后 I/O 对照"
id: "261107-rust-record-transaction-io"
formedAt: "2026-11-07T03:14:25Z"
question: "相同私有记录与操作下，事务改造前后的普通更新和资源迁移产生怎样的进程 I/O 代价与实际结果？"
tags:
  - "benchmarking"
  - "io"
  - "record-cli"
  - "rust"
relations: []
---

## 形成时背景

Rust 记录 CLI 候选简化文件与事务层：普通更新改为临时文件和替换，资源 owner 迁移改为逐文件复制、验证后退出旧源。该候选不是生产 TypeScript 入口。设计需要明确新旧成本，但旧实现也在删除资源前建立并验证文件级备份，不能把目录 rename 的理论常数成本直接当作旧 CLI 整体成本。本报告是独立的写操作调查，不替代早先查询性能报告或故障矩阵。

## 调查目的

在同一私有 fixture、相同公开 CLI 命令和领域语义下，分别测量一个普通正文更新和一个 IR 资源 owner 更名，核验实际结果，记录可见 I/O 与退化；不设性能门槛，不推断加速分布或其他平台表现。

## 调查范围与依据

**版本与构建。** 基线从 Git commit `7a9800f010395f0fc5947502b14c015fc25e9bbc` 用 `git archive` 隔离还原，执行 `cargo +1.98.1 build --offline --locked --release --bins`。最终源码含尚未提交的冻结改动，以公开 delivery 构建的完整隔离源码树摘要标识，构建后独立重算 treeDigest 一致，不能用 HEAD 冒充。Rust 和 Cargo 均为 1.98.1；锁文件不证明全部外部工具链与依赖字节相同。

以下摘要用于区分本次输入与构建，不表示跨环境可复现。Git tree 和源码树 digest 使用各自的算法；其余文件摘要为 SHA-256。

| 对象 | 基线 | 最终 |
| --- | --- | --- |
| `tools/record-cli` Git tree / 隔离源码树 digest | `839f46fe92ea1d331e87a0c4b8405549be18195e` | `56e23a56e8c550b98fd426e620e62bf6019369730012cfad041182f3b79ad070` |
| DR 二进制 | `ca70d05928fa1e7207757d48cdda3db6d0f09d9190b4fec5e0888d296bfef1e0` | `439648aa31a8ffd5a09ebf4f642dab6c876ee178937a273add5e688c2d986793` |
| IR 二进制 | `21eec1c9d18c7ad38db72997faaf4bff3d1bc8357ea4072bec41a676431e789f` | `e070c7f450e6e47fc478f29d0b99c6143478f5672e0709e58438d1bc29d68fff` |
| Cargo.lock | `f940642b7f731b864d09ea8af554edac5b27ccb65b37cec17357aeff8b83caa7` | 同基线 |
| 工具链文件 | `c910997cb152c6dc8ed13b1fdf9fa28a4ed30d6776123e27dd6170e5c66067a0` | 同基线 |

最终资产及 manifest 在当时私有目录 `dist/simplified-record-accepted-20261107-a/assets/`，隔离源码位于其构建目录；这些产物不作为报告资源提交。最终列及资源来自同轮调查中 03:35 冻结源码后的实测，时间晚于报告形成时点。

**测量环境。**
执行于 2026-11-07 UTC，Linux 6.18.33.2 WSL2 x86-64、ext4、6 个可见 CPU、AMD Ryzen AI 7 H 450；Node 26.8.2。最终两样本发生在 03:35:33–03:35:34 UTC，基线此前同机测量；未隔离所有机器负载，也未清理系统缓存。每臂每场景一个独立新进程，非交错；不计算中位数、P95 或速度结论。

**输入与操作。** 使用 `tools/record-cli/benchmarks/fixtures.ts` 生成两域各 20 条、宽 3 深 2 的合法私有记录，移动至独立目录后初始化私有空 Git 仓库；将 DR `260101-record-00019` 设为 unaligned 并用生产 TS 同步索引。给无关系的 IR `260101-record-00019` 添加两份自有资源并同步索引：`payload.txt` 为 1,048,576 字节（`0123456789abcdef` 重复 65,536 次），`small.txt` 为 15 字节（`small resource` 加换行）。四次执行从同一 fixture 复制得到独立副本，副本准备和检查不计入进程数据。输入 `docs/` 所有文件按路径排序执行 `sha256sum` 再对清单求 SHA-256 为 `ed5c1d90bbfde5d1a1c7805515402c76033fe6c618e69693bb7317ebf17b10ce`。DR 正文/索引为 404 / 12,655 字节，IR 正文/索引为 499 / 10,552 字节。Git 为 unborn HEAD，资源可见，非真实记录。

调用 `decision-records mark-aligned 260101-record-00019 --root <副本> --json` 和 `investigation-report rename 260101-record-00019 renamed --root <副本> --json`；完整实参和输出见 JSONL。后者将身份变为 `260101-renamed`，并迁移两个资源。每次独立对比操作前后所有 `docs/` 普通文件的路径及 SHA-256：仅允许所选正文、相关索引和迁移资源变化；核对资源哈希、引用及实际身份，并在计量之外调用生产 TS 对相应全集 `check`。另在两个版本各自新副本预建目标 owner 的同名资源，正式调用均非零、返回 `resource-owner` 且全部 docs 文件哈希与路径不变，证明该具体目标冲突未覆盖；不是对所有并发冲突的证明。

**计量。** 小型父进程只对自己创建的 CLI 进程启用 `ptrace` 的退出事件，在退出前暂停一次读取 `/proc/PID/io`，再继续回收；不逐 syscall 跟踪。已尝试 `waitid(WEXITED|WNOWAIT)` 后读取，但本环境对僵尸进程返回 PermissionError，故未使用。1 MiB `dd` 校准复制字节一致，观测 `rchar=1,074,138`、`wchar=1,048,576`、`syscr=45`、`syscw=16`。依据 [Linux proc 手册](https://www.kernel.org/pub/linux/docs/man-pages/book/man-pages-6.13.pdf) 和 [内核 proc 文档](https://docs.kernel.org/7.2/filesystems/proc.html)，计数包括进程及其已等待子进程：`rchar/wchar` 是读写类调用返回字节，包含缓存命中、启动、标准输出和已等待的 Git 子进程；`syscr/syscw` 是读写相关调用计数，**不包括全部 open/stat/getdents 等元数据调用**。`read_bytes/write_bytes` 是存储层读取和脏页记账，并非持久化或实际设备完成写入量；`cancelled_write_bytes` 是后来取消的写回记账，不可简单当作本次持久字节。退出暂停和父进程调度会扰动时间，取数并非各阶段成本拆分。

## 调查结果与边界

| 场景 / 版本 | rchar | wchar | syscr | syscw | read_bytes | write_bytes | cancelled_write_bytes |
| --- | ---: | ---: | ---: | ---: | ---: | ---: | ---: |
| 普通更新 / 基线 | 279,858 | 13,661 | 336 | 3 | 0 | 4,096 | 0 |
| 普通更新 / 最终 | 189,526 | 26,720 | 233 | 5 | 0 | 45,056 | 20,480 |
| 资源迁移 / 基线 | 40,226,722 | 1,062,073 | 1,723 | 28 | 0 | 1,060,864 | 4,096 |
| 资源迁移 / 最终 | 21,297,391 | 1,073,370 | 1,300 | 30 | 0 | 1,089,536 | 1,069,056 |

在这两个具体样本中，最终版本读类字节及调用计数较低，但普通更新写类字节从 13,661 增至 26,720，资源迁移从 1,062,073 增至 1,073,370；两者写调用均多 2 次。这是完整进程观察，不能把差额全部归因于某一步骤。资源迁移逻辑上最终须复制至少两文件共 1,048,591 字节；旧版虽然以目录移动退出源，仍有单独验证的资源备份，所以其整体也产生约 1 MiB 写类字节。`read_bytes` 受缓存及进程启动影响，表中零值不代表没有逻辑读取；不能由一次样本外推性能分布。

四次正常调用均退出 0、JSON `ok=true`、`changed=true`、`committed=true`、`verification=passed`，两臂最终正文与索引哈希逐项一致，所有未选文件保持原样；附件前后哈希一致（大文件 `aca1cd027e979588d14b877b7b0cb8585ad9fec599eb45801992ee5382b3760f`，小文件 `4872befdae9f2149dbfb8cf9cfa5ff3e0e8ae0aec0d93cd28518408bce61a9bf`），相应生产 TS 全集检查均通过。资源迁移的 JSON 字段总体保留，但 `writtenPaths` 实际列表不同：旧版列出资源源和目标目录，新版还列出具体复制与退出的文件；消费者不应假设路径列表逐字相同。

结果只证明此环境、规模和两个正常操作以及一个静态冲突；不证明非合作进程竞争下的跨文件隔离、故障恢复、所有路径或 Windows 行为，也不证明实际发布或生产切换。记录的是离线候选和私有数据，不是基准 SLA。若需性能分布，应在稳定版本按独立新进程、至少每臂每场景 20 次、随机交错和每次重置 fixture 另做实验。

归档的测量脚本后续仅作等义可读性整理；历史结果绑定形成时版本，不表示当前文件字节曾用于采样。

## 随附资源

- [基线原始数据](./_resources/261107-rust-record-transaction-io/baseline.jsonl)
- [校准原始数据](./_resources/261107-rust-record-transaction-io/calibration.json)
- [最终原始数据](./_resources/261107-rust-record-transaction-io/final.jsonl)
- [测量脚本](./_resources/261107-rust-record-transaction-io/measure.py)
