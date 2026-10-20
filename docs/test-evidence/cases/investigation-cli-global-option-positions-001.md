### Case INVESTIGATION-CLI-GLOBAL-OPTION-POSITIONS-001: 全局定位选项位置与当前目录默认值

Tests:
- `test:31760eff3e8c3c2a451b43449db4babe81a982fe07d78f2c127c1071481abeee`
- `test:905f1aadb053ca056a55786072223339d34ea4c75700c2d7d1bb79f39a122e17`

Tags:
- `investigation-report`

Contract:
- CLI 使用 `[global-options] <command> [command-options]` 语法；`--root` 与 `--investigations-dir` 可位于 command 之前或 command options 之后，省略 `--root` 时以进程当前目录为工作区根。

Proves:
- 纯 CLI parser 对全局 root 前置、后置及两侧混合形式，向处理函数传入相同 root，不调用集合检查。
- 同进程 CLI 在真实目标集合中省略 --root 时，check 成功读取当前目录下的一份报告。
