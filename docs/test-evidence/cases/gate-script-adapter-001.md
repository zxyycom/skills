### Case GATE-SCRIPT-ADAPTER-001: 项目命令配置与直接重跑 argv 保持明确边界

Tests:
- `test:9529e14512893972e4458d422aec6da67916f618df53ac97969587dafa6c247e`
- `test:f0695c8222a376aa1edd36578404ad42cabc1c0cea2fe1bbb64f8f5383490824`

Tags:
- `repository-tooling`

Contract:
- package 与 semantic Check 仅声明原生命令的 executable、参数数组、继承环境和 transcript 策略；直接重跑提示必须保留含空格或单引号的 argv 边界。

Proves:
- 全部 release-required package 命令精确使用 bun 与 run/script 参数，inherit、transcript、120 秒 timeout 和 16 MiB output byte limit；全部语义命令与其 catalog executable/argv 一致且使用 inherit 与 transcript。
- 含空格和单引号的文件参数被格式化为保持单一参数的 shell 引用。
