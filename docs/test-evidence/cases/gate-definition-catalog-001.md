### Case GATE-DEFINITION-CATALOG-001: Gate 完整 Definition 声明项目选择、前置和资源配置

Tests:
- `test:7808f7b7f8d641d1dfd8209916b748fc2f00bd2f03da42a136d2a7b992eb251d`
- `test:8e920fe8f88eb19722fc115d8a63991e4ec60085181bc6e2ddefe6f91c953385`
- `test:ac78e6545b501f8c286147702d2a23ffe0c03ca1015e15f3e0db2d36bece3526`
- `test:b1ce2eeed949bfa203c61ded0ed50b96792ed7e1b95766e003841a1d4d62b93f`
- `test:c5a44c669639a6f2b7c665b191f1559d2bad8b529dbc3906c607183ed70c4eb8`
- `test:c8ae74a0d55cbd30418647a7e3f56bb6bd8b3094665ab73c0e833d3f812f837e`

Tags:
- `repository-tooling`

Contract:
- quick、changed、full 与 release 使用同一完整 67 项 Definition；quick 以原生条件把批准的必要集与精确激活条件相交，不裁剪 catalog、依赖或资源。完整范围的环境与七项原生材料 Check 不由 receipt 省略，markdown-lint 与项目命令 Check 订阅工具变化 flag 并声明原生 dependsOn，三个交付 Check 仅在 release 激活。各命令独立执行，不以测试批次重分配结果。

Proves:
- 完整 Check ID 与独立期望一致；完整范围中 markdown-lint 以 markdown-content 条件启用，其余七项原生材料无 activation flag，八项均依赖环境，项目 Check 的工具 flags 与 projectToolIds 一致且不使用逐 Check flag，非 base 项不能进入增量选择；语义 Check 的 ID、runner 和入口逐项匹配独立 catalog。
- quick 必要集与独立列出的环境、秘密检测、JSON、JSON schema、Markdown 链接、Markdown lint、typecheck、lint、format:check 与 validate 十项一致；保留成员沿用完整条件，范围外成员与禁用 flag 做原生 all 相交，所有成员的 dependsOn 与 resourceClaims 不变。
- 语义 wrapper 仅导入自身叶子测试、叶子不重复且存在，工具聚合入口覆盖全部 Bun 语义叶子；MCPShell 显式 integration 与 Task Graph Node native-store 保持独立边界，performance 不进入 release-required，version-control 仍进入。
- scheduler 保持 learned custom admission 与 maxParallel 4；base 使用三个 external-process 和两个 repository-scan 容量，release 增加四个 cpu-work unit；每项 release Check 声明一个 cpu-work，version-control 声明四个，package 与 semantic 命令各声明一个 external-process。
- prepare 依赖环境，version 依赖全部 64 项 release-required 与 prepare，pack 依赖环境与 version；release 三项带传播前置的 release flag；machine publication 启用且 diagnostic logging 默认关闭。
