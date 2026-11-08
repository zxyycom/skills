### Case DECISION-CLI-MISSING-COMMAND-001: 缺少命令与显式帮助的进程退出状态

Tests:
- `test:2dfd48c79c1d1110d13aa7a23dbfae990286309490720cb51802b13bd7fc659b`

Tags:
- `decision-records`

Contract:
- 缺少命令应以参数错误退出；显式帮助不要求有效工作区。

Proves:
- 真实两域程序的空 argv 以退出码 2 结束且输出非空帮助。
- `--help` 和 `help stage` 以退出码 0 输出非空帮助；指定不存在的工作区时顶层或 stage 帮助仍可运行。
