### Case INVESTIGATION-CLI-GLOBAL-OPTION-POSITIONS-001: 全局定位选项位置与当前目录默认值

Tests:
- `test:0bee667be061d16bbfc613f0980416bc03865e71ace65cf5475b9c1bd040dc25`
- `test:4f252bb9c7ebe5be44173baa9453b4b2c0b3bfde7544afa6589ee13d2f5e1871`

Tags:
- `investigation-report`

Contract:
- CLI 使用 `[global-options] <command> [command-options]` 语法；`--root` 与 `--investigations-dir` 可位于 command 之前或 command options 之后，省略 `--root` 时以进程当前目录为工作区根。

Proves:
- 纯 CLI parser 对全局 root 前置、后置及两侧混合形式，向处理函数传入相同 root，不调用集合检查。
- 同进程 CLI 在真实目标集合中省略 --root 时，check 成功读取当前目录下的一份报告。
