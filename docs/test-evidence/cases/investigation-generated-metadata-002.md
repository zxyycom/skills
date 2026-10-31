### Case INVESTIGATION-GENERATED-METADATA-002: CLI set-relations rejects relations that do not follow a source

Tests:
- `test:20bf26bd92c838824a17132e7f47733a76f0122a22a9f949461736e726dad556`

Tags:
- `investigation-report`

Contract:
- `set-relations` 的每个 relation 参数必须属于一个已开始的 source 组。

Proves:
- relation 先于 source 时以用法错误退出，只向 stderr 输出可操作诊断。
