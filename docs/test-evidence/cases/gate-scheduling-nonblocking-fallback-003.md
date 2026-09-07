### Case GATE-SCHEDULING-NONBLOCKING-FALLBACK-003: scheduling-hint I/O 与未完成 Run 不改变门禁真值

Tests:
- `test:672e6bed80282e01fecfdf8e619f26dd3784dc094c5fb07712e036208826e687`

Tags:
- `repository-tooling`

Contract:
- scheduling hints 只是性能建议；读取或写入失败不能改变 Vibe aggregate、CLI 退出码或诊断边界，aggregate failed 或非 completed Run 不写入提示。

Proves:
- 注入读写失败时 Gate 仍保留原有成功或失败结果。
