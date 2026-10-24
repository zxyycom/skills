### Case GATE-INCREMENTAL-ACTIVATION-001: 项目增量 Gate 只省略输入闭合且精确命中成功证明的 Check

Tests:
- `test:0dc5715e14d02a6502fc5fcd433d828adc6f0dfd7900ce3b959ead71ebf462de`
- `test:1019378a5d56ee39d1cd64da683c5dd53d593f91e806a9735bb8baa55a4b5617`
- `test:1710ac45350cf86d65d77cc1c310857bfa7a9ee0e22bb62b89a71ff20f0c9f89`
- `test:1c454bb2ced1255b311713511b3775f93898227501aff4037bfe1cced303f45d`
- `test:1f701096c95efba45e566513e49ed3f5d182f8e446ee70f96d351c290e7e7844`
- `test:36e717a21ce7c1c7c2e2f06d93f0b101293e09fe8c9ef4b4ce63e5ed7ab82c17`
- `test:39d654dfba713296770c677d99d38cfce53b5e55b603e55b7ab5864abbb65cb9`
- `test:4a4eb24eb3b07c00dc4da66ba95063770fca8cc4278604c9bc30b7c9cbf6a870`
- `test:4baf60e1df517a692b35242615b8fe3c59344add460af5a3a04e6cb6985a510a`
- `test:505c051e4fdbce4e38393874a692c6d4954126790a362a4127bf9ef1f4c26947`
- `test:584de1049d81bf54164b0cd2e1408a380da467248dbcc5f144d52cfedc742e54`
- `test:65a9052f98f1620eb5fb8b05fb272441e90a1da3ebe17e30fceb9a01e3550064`
- `test:70a93ca1284d1289e17836b130a25f5f3fa0ce349e13f482993be605598ed19e`
- `test:9b5dd0725c798ef758b1e57a654b092cfbad664c980ca45df11b8a0c510af823`
- `test:ba590fa71bcb7a885cffe7a8c35159ee392617871edc260dc11b6c9ed93c9722`
- `test:c067f038382c3793fd65a6e57d05ffb200a59f4ecbe4e5a5de9b09f343d25709`
- `test:d734f26be9f780c80e02df9dd15fd77ad3d37149d7df8d7af03553d8a05d7eff`
- `test:da5c325ff39accab38f2730d58c10cd28b7abe309c13622ff846b7cc99ecc358`
- `test:db7194efa67cbb9de2a9ea3ac74dc903817906ae1205424fbb21ba93731b001c`
- `test:dda784ac123b3e715dd0ab9dbb760b9980b78cb941ddadf6d539cb910b3fcb1d`

Tags:
- `repository-tooling`

Contract:
- changed 完整变更验收为 57 项项目命令与 markdown-lint 共 58 项 Check 维护输入成功 receipt；其余七项原生材料与环境 Check 每轮实际执行。只有声明输入闭合、工具与环境身份精确、所选命令通过、最终 Run 成功且起止快照一致时才发布证明；release 全量执行，原生 dependsOn 负责必要前置激活。

Proves:
- 首次完整输入执行全部 receipt-managed Check；稳定输入复用，单项 receipt 缺失激活其工具订阅者与必要生成前置，实际 Check 全部通过且最终 Run 成功才发布。
- Git 与磁盘事实覆盖源码、测试/fixtures、runtime、manifest/lock/config，ignored TS/MTS 与 fixture node_modules 不漏；dirty→相同 clean 可复用，删除与另路径重建重新执行。
- 领域 runtime 与测试能力分别归真实 consumer；共享/skill-package/build 输入保留实际生成与加载闭包，不因无关 scripts 内容给所有领域加宽订阅。
- Novel Cards 对代表性 runtime/分发/manifest/lock/fixture 输入失效；构建适配只使统一生成 provider 执行而 source card/query consumer 可复用。
- 未知 owner、symlink/越界/非 UTF-8 路径、预算超限与读取失败保守 fallback；不缓存部分或 unavailable 身份。
- 工具/环境身份改变使相关证明失效，shell 记账变量排除仍准确；非仓库 fallback 选择全部 receipt-managed base 项，release 选择完整 69 项。
- 损坏 receipt manifest、未成功 Run、命令失败、不可写 cache、结束采集失败或起止漂移均不得发布成功证明。
- updater 的分发输入限实际 ai-ready-docs；shared search/graph 与公共 runtime 测试按实际消费者失效，source-only 测试不冒充公开分发证明。
