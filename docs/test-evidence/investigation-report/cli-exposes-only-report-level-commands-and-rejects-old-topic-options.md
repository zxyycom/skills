### Case INVESTIGATION-BUNDLED-PARITY-001: CLI exposes only report-level commands and rejects old topic options

Entry:

- `tools/investigation-report/tests/cli-generated.test.ts > CLI exposes only report-level commands and rejects old topic options`
- `bun test --test-name-pattern="^CLI exposes only report-level commands and rejects old topic options$" ./tools/investigation-report/tests/run.ts`

Contract:

- 直接调用的源码 CLI 入口的帮助仅公开报告级命令；旧主题筛选参数不属于当前接口。

Proves:

- `--help` 成功且只写 stdout，并列出 `set-relations` 而不列出 `--category`；旧 `--category` 以用法错误退出、stdout 为空并向 stderr 给出诊断。
