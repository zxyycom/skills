### Case GATE-COMMAND-TRANSCRIPT-001: 项目命令使用项目根和继承环境并保留私有 transcript

Tests:
- `test:e0f7e526543ffc3a1be448071a3e0bbeff7e9fd6b4936cb16bd5e2d0868b2f29`

Tags:
- `repository-tooling`

Contract:
- 项目 package 命令交给原生 command Check 执行，cwd 使用调用项目根并继承环境；子命令文本留在完整 transcript，不进入公开 outcome data 或 snapshot。

Proves:
- 真实临时项目命令从项目根执行并读到继承的 PATH，退出 7 被报告为 failed；process.log 包含项目根和 stderr marker，公开 data 仅含 exitCode 且 snapshot 不含 marker。
