### Case INVESTIGATION-GENERATED-METADATA-002: CLI set-relations rejects relations that do not follow a source

Entry:

- `tools/investigation-report/tests/cli-generated.test.ts > CLI set-relations rejects relations that do not follow a source`
- `bun test --test-name-pattern="^CLI set-relations rejects relations that do not follow a source$" ./tools/investigation-report/tests/run.ts`

Contract:

- `set-relations` 的每个 relation 参数必须属于一个已开始的 source 组。

Proves:

- relation 先于 source 时以用法错误退出，只向 stderr 输出可操作诊断。
