# Linux 原生候选与离线交付验收

本记录针对 Linux-only 候选提交 `8ba448ea45681525f1237d82846c08e3e8410215` 的 [Record CLI Candidate 运行 42230586968](https://github.com/zxyycom/skills/actions/runs/42230586968)；[Ubuntu job](https://github.com/zxyycom/skills/actions/runs/42230586968/job/127935143577) 的受测 revision 与该提交一致，最终结果 **success**。本次不验收 Windows 原生候选；此前 Windows 调查及本轮范围选择见 [Windows 原生兼容性调查](../../docs/investigations/261106-rust-windows-native-compatibility.md)。

## 环境与测试

同次 artifact 的环境记录显示 x86-64、Ubuntu 22.04 runner、Linux `6.8.0-1070-azure`、glibc 2.35、ext4、Git 2.56.0、rustc `1.98.1` 和 Cargo `1.98.1`（host `x86_64-unknown-linux-gnu`）。日志只记录 CPU 架构，未记录处理器型号或核心数，不能还原这些细节。

该 job 的格式、Clippy 和原生 Cargo 全目标步骤通过；日志显示 library **190/190**、integration **122/122**，合计 312 个原生节点通过，0 失败、0 ignored；两个 bin test target 各有 0 个测试。私有 fixture 的 Node 离线交付测试 **3/3** 通过。项目测试证据检查报告 **2,148 个实体**的引用与覆盖通过；快照覆盖和实际测试运行分别证明不同事实。

## 真实离线 A/B

同一 runner 执行 `verify-real.ts --build record-cli-ci`，结果日志报告 `passed`：从隔离源码分别构建 A `0.1.0` 与 B `0.1.1`，在私有 fixture 安装 A 并运行两个已安装二进制的版本和帮助；注入 B 第一次替换后的失败，回读确认 A 与无关哨兵保留，再成功更新并运行 B。该验证不涉及真实用户安装、生产 skill/updater 或正式发布。

[同次 Ubuntu artifact](https://github.com/zxyycom/skills/actions/runs/42230586968/artifacts/13507314359) 的 manifest 和 source-files 分别记录目标 `x86_64-unknown-linux-gnu`，两份 source-files 清单均有 346 个路径且列表一致；各 source-files 摘要与对应 manifest 一致。runner 报告的来源摘要如下；artifact 不包含完整源码树，因此本次下载复核不独立重算来源树摘要。

| 候选 | 版本 | 来源 SHA-256 | DR 资产 SHA-256 | IR 资产 SHA-256 |
| --- | --- | --- | --- | --- |
| A | 0.1.0 | `638ec2528e3d1e87c1156f8c3aa2bf43eb36300e403f16e140ad057c68e56f19` | `7b8646b050a6404eac6f70a246f463703dececaa6e9df114c7df17ec2d0f989b` | `ddc3ef70382a0ff1fced59884c70ff4d6944a5768acf0a208707a5f6ef6c5837` |
| B | 0.1.1 | `c1a22ebd898988b5811178798629a4ebddec8f372aa760f133d75f1d229b9695` | `dff3a8cf2be9ca1cb7cd4966c78a5cb323d2c96b2f0fd2fcd7497f6bf625b038` | `17c168a1b4aea0370ef51c27cbae134da6312fb95deaf0425d5051db5c1e650c` |

下载后独立回算四个二进制的长度和 SHA-256，均与对应 manifest 匹配：A 的 DR/IR 分别为 7,663,240 / 7,663,264 字节，B 为 7,663,728 / 7,663,752 字节。artifact 是短期 workflow 证据，不作为 Git 源文件或正式 release；此结果不证明其他 Linux ABI、文件系统、Windows、线上分发或真实用户环境。
