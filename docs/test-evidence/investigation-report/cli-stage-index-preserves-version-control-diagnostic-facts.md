### Case INVESTIGATION-CLI-STAGE-DIAGNOSTIC-001: CLI stage-index preserves version-control diagnostic facts

Entry:
- `tools/investigation-report/tests/cli-generated.test.ts > CLI stage-index preserves version-control diagnostic facts`
- `bun test --test-name-pattern="^CLI stage-index preserves version-control diagnostic facts$" ./tools/investigation-report/tests/run.ts`

Contract:
- `stage-index` 的最终 CLI renderer 必须保留 index runtime 给出的版本控制诊断 code、target、cause 和 operation，而不能压缩为普通错误字符串。

Proves:
- 非 Git fixture 返回退出码 1、stdout 为空，stderr 显示 repository-unavailable code、configured-root target、not-repository cause 和 operation。
