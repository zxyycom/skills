### Case GATE-SCRIPT-ADAPTER-001: package-script adapter 映射终态且继续结算独立 Check

Tests:
- `test:395a2412f8e2e5c7ba222452167703393d8be37575f189531ca8abd276c1b60e`

Tags:
- `repository-tooling`

Contract:
- 项目脚本必须以参数数组运行 `bun run <script>`；非零退出为 failed，无法启动等不可信终态为 unavailable，且一个脚本失败不能阻止无依赖的其他 Check 结算。命令诊断以一条主消息和至多四条单行尾部消息表示，不把换行嵌入单个 Vibe message。

Proves:
- 注入的非零退出使 aggregate failed，同时独立脚本仍 passed。
- 注入的 unavailable 保留稳定 reason code 并使 aggregate failed；每次调用都使用 `bun` 和 `['run', script]` 参数数组。
- 六行失败输出只保留末四行，首条以省略号标记；所有 Check message 都不含 CR、LF 或 Unicode 行分隔符，progress renderer 不会再把嵌入换行显示成字面 `\n`。
