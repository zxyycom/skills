### Case DECISION-STAGE-SCOPE-INVALID-001: stage rejects an invalid scope as a normal invalid argument

Tests:
- `test:ab79677789a3bb76d9f9611567f1b3f43c40f19edf6db8c1d42d2152e6fc841b`

Tags:
- `decision-records`

Contract:
- 非法 scope 值只走普通无效参数路径。

Proves:
- `--scope everything` 返回退出码 2 与允许值诊断，pending 保持零写入。
