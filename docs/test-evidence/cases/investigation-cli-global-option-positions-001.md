### Case INVESTIGATION-CLI-GLOBAL-OPTION-POSITIONS-001: 全局定位选项位置与当前目录默认值

Tests:
- `test:29c9421476d843dbaa5e52a3d0444ac15692ed0bb16dd9b46adb8416a345a7b2`

Tags:
- `investigation-report`

Contract:
- CLI 的 `--root` 与 `--investigations-dir` 可位于命令前或命令选项中；省略 `--root` 时以进程当前目录为工作区根。
- 普通成功命令默认输出格式化结果，`--json` 输出 version 2 envelope；成功 trace 保留自身形状。

Proves:
- 真实 CLI 对定位选项前置、后置及默认 cwd 的 list 返回相同结果；验证 version、ok、result 和默认格式化结果，以及 JSON trace 无通用 result 包装。
- 不声称覆盖全部选项排列或旧终端渲染、空 stdout 排版。
