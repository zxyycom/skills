### Case INVESTIGATION-CLI-MISSING-COMMAND-001: 缺少命令与显式帮助的退出状态

Tests:
- `test:2dfd48c79c1d1110d13aa7a23dbfae990286309490720cb51802b13bd7fc659b`

Tags:
- `investigation-report`

Contract:
- 省略 command 按参数错误结束；显式 help 不要求有效工作区。

Proves:
- 真实程序空 argv 退出 2 且产生 stdout；显式 help 和指定不存在 root 的 help 均成功。
