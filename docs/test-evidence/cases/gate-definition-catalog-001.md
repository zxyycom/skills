### Case GATE-DEFINITION-CATALOG-001: Gate 完整 Definition 声明项目选择、前置和资源配置

Tests:
- `test:02055d79f6bcee7539c24ff4eff2d086a6112798761ed071aa0cf03286513dba`
- `test:57315b9b4af6b3cec87ec031776e0abc5d6edc76e54da057735ed2060732a76e`
- `test:920b23dd5536416e9499cd599fbab2aed384d7de3ec2e7cc7adfcd8e04cbcc65`
- `test:b5bd42bbb59b56de218a9ac674b85871d21d973339df64a210d401cb3101d8bc`
- `test:f69ced8ca79877d97b0a92de39974fe9cff643c8e544fa904fe22f8538db14e7`
- `test:f960770d47b0d76196402b399f3f7b7713283ac5ed15f829d22323fa0645944a`

Tags:
- `repository-tooling`

Contract:
- quick、selected、changed、full 与 release 使用同一完整 69 项 Definition；quick 固定执行批准的六项必要集，保留完整 catalog、依赖与资源。
- 完整范围的环境与七项原生材料 Check 每轮执行；markdown-lint 与项目命令 Check 订阅工具变化 flag 并声明原生 dependsOn，三个交付 Check 仅在 release 激活。
- 各命令独立执行并拥有自己的结果。

Proves:
- 完整 Check ID 与独立期望一致；完整范围中 markdown-lint 以 markdown-content 条件启用，其余七项原生材料无 activation flag，八项均依赖环境，项目 Check 的工具 flags 与 projectToolIds 一致且不使用逐 Check flag，非 base 项不能进入增量选择；语义 Check 的 ID、runner 和入口逐项匹配独立 catalog。
- quick 必要集与独立列出的环境、秘密检测、JSON、JSON schema、Markdown 链接、Markdown lint 六项一致；必要集成员不带工具激活条件，typecheck、lint、format:check、validate 等范围外成员与禁用 flag 做原生 all 相交，所有成员的 dependsOn 与 resourceClaims 不变。
- 语义 wrapper 仅导入自身叶子测试、叶子不重复且存在，工具聚合入口覆盖全部 Bun 语义叶子，包含两域 selected sync 局部契约、IR 单锁执行入口与共同读取原生测试；MCPShell 显式 integration 与 Task Graph Node native-store 保持独立边界，performance 不进入 release-required，version-control 仍进入。
- scheduler 保持 learned custom admission 与 maxParallel 4；base 使用三个 external-process 和两个 repository-scan 容量，release 增加四个 cpu-work unit；每项 release Check 声明一个 cpu-work，version-control 声明四个，package 与 semantic 命令各声明一个 external-process。
- prepare 依赖环境，version 依赖全部 66 项 release-required 与 prepare，pack 依赖环境与 version；release 三项带传播前置的 release flag；machine publication 启用且 diagnostic logging 默认关闭。
