### Case GATE-SCRIPT-ADAPTER-001: 项目命令配置与直接重跑 argv 保持明确边界

Tests:
- `test:4650cb30529e64c99c1d7b59b265057fd337ce7569c9b743fc71bed3b80a83cc`
- `test:c4c1c485929e0bfb0946f8a1ba1fc9749417ae77cd4c5ebe1f462a37e94e8d1e`

Tags:
- `repository-tooling`

Contract:
- package 与 semantic Check 仅声明原生命令的 executable、参数数组、继承环境和 transcript 策略；直接重跑提示必须保留含空格或单引号的 argv 边界。

Proves:
- 全部 release-required package 命令精确使用 bun 与 run/script 参数，inherit、transcript、120 秒 timeout 和 16 MiB output byte limit；全部语义命令与其 catalog executable/argv 一致且使用 inherit 与 transcript。
- 含空格和单引号的文件参数被格式化为保持单一参数的 shell 引用。
