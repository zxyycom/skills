### Case INVESTIGATION-GENERATED-METADATA-002: CLI set-relations rejects relations that do not follow a source

Tests:
- `test:04e0f7ce3749df06dd77c19fc8c546a790d25040c6cc33ca355ddbbc7d5a96d1`

Tags:
- `investigation-report`

Contract:
- `set-relations` 的每个 relation 参数必须属于一个已开始的 source 组。

Proves:
- relation 先于 source 时以用法错误退出，只向 stderr 输出可操作诊断。
