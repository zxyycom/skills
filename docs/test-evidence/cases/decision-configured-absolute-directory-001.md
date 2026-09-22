### Case DECISION-CONFIGURED-ABSOLUTE-DIRECTORY-001: 绝对决策目录按普通定位错误失败

Tests:
- `test:bc03c608e275550398e2ddaa578dd49376547e6b8b8c94146e095f7cc2058d21`

Tags:
- `decision-records`

Contract:
- 绝对 `decisionsDir` 与越出工作区根的相对路径在 location API 与 CLI 中都是普通错误；API 扫描以错误报告且不定位集合，CLI 以参数错误退出。

Proves:
- API 扫描对绝对目录返回 `--decisions-dir must be relative to --root`，对越界相对路径返回 `--decisions-dir must remain within --root`，均不产生可用集合。
- CLI `check` 对绝对目录以退出码 `2` 结束并报告同一约束。
