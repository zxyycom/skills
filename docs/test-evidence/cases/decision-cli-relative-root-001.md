### Case DECISION-CLI-RELATIVE-ROOT-001: Decision CLI 从注入 cwd 解析相对 root

Tests:
- `test:0835192306ca6c934028ca2094750b2b9f18848c15e8bd4eed4416ab64b22d0d`

Tags:
- `decision-records`

Contract:
- 可直接调用的 Decision Records CLI 在接受注入当前目录时，必须相对该目录解析 `--root`，不能隐式读取进程全局 cwd。

Proves:
- 使用注入 cwd 与 `--root .` 解析命令时，领域处理器收到的 `workspaceRoot` 恰好等于注入 cwd。
