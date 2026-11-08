# C 阶段正式交付与验收

## 固定身份与发布

- 正式 runtime 为 `0.2.0`，两域 skill 版本分别为 decision-records `111`、investigation-report `100`。用户授权更新 `skills-latest`，安装验收限定隔离目录，不修改现有用户 skill。
- [GitHub Release](https://github.com/zxyycom/skills/releases/tag/skills-latest) ID `346715779`，正式 rolling tag 在验收时指向 `352fdd58770cda35308e84c25260e47e42bd6249`。实际构建原生资产的 revision 为 `7189963497e768b7a0d46475a52031eaf0c2b1a6`；两者不同，不能把验收程序或 tag revision 冒充资产构建来源。
- Package Skills run `42513636128` 的 Linux、Windows 构建、package、video-windows 与 publish 全部成功；日志记录从 Release `346715779` 读取并校验 recovery asset `724869444`，复用原构建资产，后将 rolling tag 从 `71899634` 更新到 `352fdd58`。与首次正式发布后相比，31 个资产的 ID、大小和 digest 未变；两个旧名 `decision-records.zip`、`investigation-report.zip` 不存在。
- 首次正式发布为 revision `71899634` 的 Package Skills run `42511433868`。发布前旧 tag 指向 `a5fb1f34ae1a8830ae5ce07126253889c8daa85e`；旧资产和 release 元数据由执行方在发布前记录。后续恢复应先核对当前远端状态与并发变化，遵循 [交付契约](delivery-contract.md)，不盲目覆盖 tag 或猜删文件。

| 资产 | GitHub asset ID | SHA-256 |
| --- | --- | --- |
| `skill-release-manifest.json` | 724869818 | `93aaef839aa6628676a8ffb5e6eaef1b0c455ebe9768445d0c1a9601e0e294b2` |
| `record-native-installer.zip` | 724869461 | `0639deb143a1a951a9e9d6862797f3fd321070ed3e15ace5ca51d567ec4f1163` |
| `decision-records-native.zip` | 724869484 | `802bc3901086c7c6d34fcef00eca88f3928c67e38aaccddfc85df4f0bfc72de3` |
| `investigation-report-native.zip` | 724869498 | `b7dcda8397b51fc418fbfea5403fad3fd4c7227ecf5f3b0c9d23c570fb3960f5` |
| `decision-records-0.2.0-x86_64-unknown-linux-gnu.zip` | 724869543 | `1fd25d8febf45206b91953f0c70ea06f737b7b55ebb09c150385ac46ef74bd3c` |
| `decision-records-0.2.0-x86_64-pc-windows-msvc.zip` | 724869568 | `e0e0f2a5d585558e641b9a2c176ddeab012f7d686acd0dca3ac01b9a535e1279` |
| `investigation-report-0.2.0-x86_64-unknown-linux-gnu.zip` | 724869595 | `1ac9aa4a62e4bd577c41cdf175539aa559c0414089531319160e567adc8f2265` |
| `investigation-report-0.2.0-x86_64-pc-windows-msvc.zip` | 724869643 | `a24177109e9b0499eb9c181d23dd81d0b6997c1ab4c4ad10c226e7b48641d224` |
| `record-native-build-0.2.0.json` | 724869675 | `dabdb8b72c52307fb9ae171fd2872980282f381b7e216c0808f42edad9e48643` |
| `record-native-recovery-0.2.0.zip` | 724869444 | `a8cc30d06faa1c8b7c80b55b4ab65b43485ca6b6134854d125caaf6b53d46f24` |

## 实际平台与安装验证

手动验收 run `42514310360` 固定 Release ID `346715779` 和 tag revision `352fdd58`；package、两平台构建和 video-windows 前置通过，publish 在验收模式跳过。Ubuntu 22.04 和 Windows 2022 的 `accept-online` 均成功。两平台分别从 GitHub 按资产 ID 下载 manifest、installer、两个源包及对应两份原生 ZIP，核对返回长度与 digest。

每个平台、每个角色均在仓库外隔离目录实际执行新装和支持的旧版首升；旧版输入从固定历史 revision `dc874213f494ba5411330afe135c0542df5184a8` 生成并逐文件核对可信旧清单。成功后运行对应程序 `--version`，显式安装目标 updater 依赖并运行 `--check`；删除受管二进制后检查缺失、确认补缺并再次运行版本，确认 sentinel 保持。两平台日志均有四条 `PASS`（两角色 × fresh/legacy）。这不表示改动了真实用户目录，也不将版本检查单独扩称全部业务行为；业务、Git 与恢复覆盖见 [B 阶段对照](b-acceptance.md) 和公开测试。

线上首次验收 run `42512032696` 的 Linux 成功、Windows 在准备历史 fixture 时因 tar 目标绝对路径解析失败而未进入安装；随后修正验收脚本并独立复验，以上新 run 才是双平台成功证据。

## 最终对账与门禁

旧领域 TS SDK、CLI、声明和专属生成已退出；shared、index-runtime 与通用 updater 的其他消费者保留。受影响 Case 与实体快照经重新对账，真实平台还运行原生和 updater 测试。正式发布前固定 pending 的本机完整 release Gate 为 63/63，invocation `.log/vibe-check/invocations/20261108T184148253Z-af1c8fcd-15d4-43b3-830b-26f3700137fe`；后续仅验收编排与复用输出修复分别执行受影响 scope 21/21，并由上述新 revision 的完整 CI 验证。恢复资产仅保存已发布运行时和其构建证明，不是旧领域 SDK，也不替代安装事务的受管文件与恢复证据。
