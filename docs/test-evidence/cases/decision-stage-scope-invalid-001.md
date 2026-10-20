### Case DECISION-STAGE-SCOPE-INVALID-001: stage rejects an invalid scope as a normal invalid argument

Tests:
- `test:ab79677789a3bb76d9f9611567f1b3f43c40f19edf6db8c1d42d2152e6fc841b`

Tags:
- `decision-records`

Contract:
- 非法 scope 值只走普通无效参数路径。

Proves:
- 同进程 CLI 对 `--scope everything` 返回退出码 2、空 stdout 与允许值诊断；真实 Commander parser 的 dispatch 次数为零，不声称直接观察 Git pending。
