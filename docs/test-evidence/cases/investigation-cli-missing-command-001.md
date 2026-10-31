### Case INVESTIGATION-CLI-MISSING-COMMAND-001: 缺少命令时渲染顶层帮助并按参数错误结束

Tests:
- `test:c46f1d65ec90a4ba8b99a4b32cdf5e9d91c2ad0bf042a0d37a4cb84fed6241c5`

Tags:
- `investigation-report`

Contract:
- 省略 command 时，CLI 渲染顶层 help 且不读取集合状态，以参数错误退出码结束；`help` 命令仍以成功退出码渲染顶层 help。

Proves:
- 空 argv 以退出码 `2` 结束，stdout 为空，stderr 呈现顶层命令说明与 `help [command]` 入口。
- `help` 以退出码 `0` 输出同一顶层说明，未执行任何领域命令。
