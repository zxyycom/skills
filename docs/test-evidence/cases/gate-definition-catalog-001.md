### Case GATE-DEFINITION-CATALOG-001: Gate 完整 Definition 声明项目选择、前置和资源配置

Tests:
- `test:02055d79f6bcee7539c24ff4eff2d086a6112798761ed071aa0cf03286513dba`
- `test:060af526a158a85d169eba0c1db9e0ad4bf5ee549ad485bf05f0f90eb251a04a`
- `test:57315b9b4af6b3cec87ec031776e0abc5d6edc76e54da057735ed2060732a76e`
- `test:6a5a8860e0536c2188f4e99be258ee528f00d09f16dbb204e285ee03b15e4324`
- `test:920b23dd5536416e9499cd599fbab2aed384d7de3ec2e7cc7adfcd8e04cbcc65`
- `test:b5bd42bbb59b56de218a9ac674b85871d21d973339df64a210d401cb3101d8bc`
- `test:f69ced8ca79877d97b0a92de39974fe9cff643c8e544fa904fe22f8538db14e7`

Tags:
- `repository-tooling`

Contract:
- quick、selected、changed、full 与 release 使用同一完整 Definition；quick 执行批准的六项必要集，保留完整 catalog、依赖与资源。
- 完整范围的环境与七项原生材料 Check 每轮执行；markdown-lint 与项目命令 Check 订阅工具变化 flag 并声明原生 dependsOn，三个交付 Check 仅在 release 激活。
- 各命令独立执行并拥有自己的结果。

Proves:
- 完整 Check ID 与独立期望一致；完整范围中 markdown-lint 以 markdown-content 条件启用，其余七项原生材料无 activation flag，八项均依赖环境，项目 Check 的工具 flags 与 projectToolIds 一致且不使用逐 Check flag，非 base 项不能进入增量选择；语义 Check 的 ID、runner 和入口逐项匹配独立 catalog。
- quick 必要集与独立列出的环境、秘密检测、JSON、JSON schema、Markdown 链接、Markdown lint 六项一致；必要集成员不带工具激活条件，typecheck、lint、format:check、validate 等范围外成员与禁用 flag 做原生 all 相交，所有成员的 dependsOn 与 resourceClaims 不变。
- 语义 wrapper 只导入自身叶子测试，叶子不重复且存在；工具聚合入口覆盖对应 Bun 语义叶子。Agent Memory 的三个 Node 命令共同覆盖领域 package 测试入口；分发项声明生成一致性前置。Task Graph native-store 使用独立 Node 测试入口，version-control 有自己的 Gate 命令。
- scheduler 保持 learned custom admission 与 maxParallel 4；base 使用三个 external-process 和两个 repository-scan 容量，release 增加四个 cpu-work unit；每项 release Check 声明一个 cpu-work，version-control 声明四个，package 与 semantic 命令各声明一个 external-process。
- prepare 依赖环境，version 依赖完整 base 与 prepare，pack 依赖环境与 version；交付项带传播前置的 release flag；machine publication 启用且 diagnostic logging 默认关闭。
