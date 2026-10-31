### Case DECISION-STAGE-SCOPE-INVALID-001: stage rejects an invalid scope as a normal invalid argument

Tests:
- `test:521e1e7baeb7c4863fe611db93d77d8a7b57251fff25c858e1a2a7080b21ed61`

Tags:
- `decision-records`

Contract:
- 非法 scope 值只走普通无效参数路径。

Proves:
- 同进程 CLI 对 `--scope everything` 返回退出码 2、空 stdout 与允许值诊断；真实 Commander parser 的 dispatch 次数为零，不声称直接观察 Git pending。
