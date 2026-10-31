### Case GATE-INCREMENTAL-ACTIVATION-001: 项目增量 Gate 只省略输入闭合且精确命中成功证明的 Check

Tests:
- `test:0e6174025a63b00d62e9817747cf354e3e563f656eb00d11b517d025e329ff68`
- `test:2a6ed8ba3af59bde395e4e67b2ad20cd292185e2de8b76c9569b4b46fb85814d`
- `test:4576387f82bd117c6c48a19b7333fd21c998cd404b83041740624f24b0930aca`
- `test:497fab508cc1fb5f4dd8ef935d27dcdeb5612ca42be1c4d3964610e03e919539`
- `test:4cf1481a980a7c9e2b698a960216ccebdb521f7b6ab5bfcec15c04d491d7e914`
- `test:5575a04c41a77062d76c8f6e3e492f348f4415083565b970b33dc0d0f8cdf39e`
- `test:5b0ddc62633a4d952de6dc4fe902b64d3eea0ffe89220a3b7cf88286b944d1e4`
- `test:5d54646d5e0fb8e28461dd0f04f9c3dc45606d0604364af5a35abf99a0249ac0`
- `test:609ca3e91f4ca884938567a13296abcada4e1ebdaf40ad4aef69ca543252d097`
- `test:64fd4ca7bf8daaa4a5a1eb0b7817ab4e05ad4584b16c9d387d4e8261e97683af`
- `test:6ab9df7c2a90fd876d134cca161d161f555bc9ff40bb0ebff31dc8311f21d41e`
- `test:6f5d366897a26ff4053346848ac02d30cd303b4b26c1214abcd96261ec1880a2`
- `test:a4b80afe41bb6902149c7ec34eb6ea9367fb96d1bfa241aea12f75ae1921d641`
- `test:d825378f472ef53ac559c333ac43315d190105fe505b3cf2d065eb83b8566b11`
- `test:dd79f2cb4055b222db945a10f9b889fa1276ac8b859428482e5fbfb6a4134f58`
- `test:e9c31928ab6887c81bde7172119ea4ec63857a995d16df071fe1c20dff4ca57f`
- `test:f0f651c00091ab5166b7ab9ad7756d7bcea980ffbc33cc8a13c386c38548350d`
- `test:f3c7e9fa7c0844ac9424ae52276364b6b0232c8d7279000d68db7beaee7a2a70`
- `test:f6a6b1afb19b36c558e1976ae1955a6a1f536cce46d6cfae035317d70cb49133`
- `test:f9cc44d3d337d88c5ebe015b254d2bb54922d8075cd1dd3ef05812cf85df5b89`

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
