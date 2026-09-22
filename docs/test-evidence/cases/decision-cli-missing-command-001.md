### Case DECISION-CLI-MISSING-COMMAND-001: 缺少命令时渲染顶层帮助并按参数错误结束

Tests:
- `test:792f73cfca5ff75f5281707bae9e6be88d5391578c5b6550dd6c61f07adb463c`

Tags:
- `decision-records`

Contract:
- 省略 command 时，CLI 渲染顶层 help 且不读取集合状态，以参数错误退出码结束；`help` 命令仍以成功退出码渲染顶层 help。

Proves:
- 空 argv 以退出码 `2` 结束，stdout 为空，stderr 呈现顶层命令说明与 `help [command]` 入口。
- `help` 以退出码 `0` 输出同一顶层说明，未执行任何领域命令。
