### Case GATE-INCREMENTAL-ACTIVATION-001: 项目增量 Gate 只省略输入闭合且精确命中成功证明的 Check

Tests:
- `test:0b754daaf28974d25f9f2e41ded314d92db2bba419dd5a63c607ad9a2dee0b57`
- `test:0dc5715e14d02a6502fc5fcd433d828adc6f0dfd7900ce3b959ead71ebf462de`
- `test:1019378a5d56ee39d1cd64da683c5dd53d593f91e806a9735bb8baa55a4b5617`
- `test:1710ac45350cf86d65d77cc1c310857bfa7a9ee0e22bb62b89a71ff20f0c9f89`
- `test:1c454bb2ced1255b311713511b3775f93898227501aff4037bfe1cced303f45d`
- `test:1f701096c95efba45e566513e49ed3f5d182f8e446ee70f96d351c290e7e7844`
- `test:333dc7ba9b142f33d375f9a05c6372829b622830a8dd79109184bb996b3c3088`
- `test:36e717a21ce7c1c7c2e2f06d93f0b101293e09fe8c9ef4b4ce63e5ed7ab82c17`
- `test:4a4eb24eb3b07c00dc4da66ba95063770fca8cc4278604c9bc30b7c9cbf6a870`
- `test:505c051e4fdbce4e38393874a692c6d4954126790a362a4127bf9ef1f4c26947`
- `test:584de1049d81bf54164b0cd2e1408a380da467248dbcc5f144d52cfedc742e54`
- `test:65a9052f98f1620eb5fb8b05fb272441e90a1da3ebe17e30fceb9a01e3550064`
- `test:70a93ca1284d1289e17836b130a25f5f3fa0ce349e13f482993be605598ed19e`
- `test:9b5dd0725c798ef758b1e57a654b092cfbad664c980ca45df11b8a0c510af823`
- `test:c067f038382c3793fd65a6e57d05ffb200a59f4ecbe4e5a5de9b09f343d25709`
- `test:c20d3139a2625c46333d36010b64b438d37e6ac857bbb683eff13fa709be39c5`
- `test:d734f26be9f780c80e02df9dd15fd77ad3d37149d7df8d7af03553d8a05d7eff`
- `test:da5c325ff39accab38f2730d58c10cd28b7abe309c13622ff846b7cc99ecc358`
- `test:db7194efa67cbb9de2a9ea3ac74dc903817906ae1205424fbb21ba93731b001c`
- `test:f467b731f2ab5036f705659b870d95c7b3bd0759b30929ea0662075ff56a9551`

Tags:
- `repository-tooling`

Contract:
- changed 完整变更验收为 52 项项目命令与 markdown-lint 共 53 项 Check 维护输入成功 receipt；其余七项原生材料与环境 Check 每轮实际执行。只有声明输入闭合、工具与环境身份精确、所选命令通过、最终 Run 成功且起止快照一致时才发布证明；release 全量执行，原生 dependsOn 负责必要前置激活。

Proves:
- 首次运行选择全部有证明契约的 Check，成功后形成可复用 receipt；稳定输入可全部省略；缺少一个 Check receipt 会激活其工具及全部订阅者，生成前置显式进入执行集合，全部实际执行 Check 通过后才发布。
- 路径模式、Git 可见路径与声明磁盘域共同覆盖源码、fixtures、runtime、manifest、锁文件和配置；ignored fixture、fixture 内 node_modules 与 TS/MTS 变化仍使对应项目命令失效，dirty 内容提交为相同 clean 内容可复用，删除和重命名重新执行。
- 文档变化激活其工具订阅者而不激活无关领域；shared、skill-package 与 build-system 输入变化使相关项目证明失效，语义聚合入口变化使 Gate 自测失效，领域生成统一消费全部 skill/updater 输入。
- Novel Cards consumer 在 Index Runtime、shared、构建适配、公开入口、runtime、manifest、锁文件与 fixtures 变化时重新执行，统一生成 Check 同时按其真实输入失效。
- 未知 owner 与叶子 symlink 使输入不闭合且每次执行，不能发布；symlink ancestor、Git 越界或非 UTF-8 路径、超过 20000 文件或 512 MiB 输入预算、EACCES 读取失败均 fallback，不缓存 unavailable 身份。
- 环境或工具身份变化使全部项目命令失效，父 shell 的 _ 记账变化不影响身份；必要工具探测失败与非 Git 工作区执行全量 fallback，release 选择完整 64 项。
- 损坏 receipt、未通过命令、最终 Run 失败、不可写 cache、结束快照失败或起止漂移均不能发布成功证明；Run 失败时即使全部项目命令 passed，也不创建 receipt 目录。
- updater 测试的分发包输入限定为实际加载的 ai-ready-docs：无关 MCPShell 包变化只使统一生成 provider 重新执行，updater 仍复用；ai-ready-docs 包字节变化使 updater 重新执行。
- shared 的 file-text-search 与 graph 输入按真实 consumer 分别失效：record-search-output.ts 变化只使实际搜索/分发消费者重新执行，Decision Records 非搜索查询/生命周期、两领域维护 check、Test Evidence 五项与专用 file-text-search 测试保持复用；index.ts 变化仍激活全部真实 file-text-search consumer；无关领域与另一子域测试保持复用。
