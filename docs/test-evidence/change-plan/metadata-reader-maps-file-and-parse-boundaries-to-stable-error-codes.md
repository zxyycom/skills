### Case CHANGE-PLAN-METADATA-ERRORS-001: Metadata reader 映射稳定边界错误码
Entry:
- `tools/change-plan/tests/metadata.test.ts > metadata reader maps file and parse boundaries to stable error codes`
- `bun test --test-name-pattern="^metadata reader maps file and parse boundaries to stable error codes$" ./tools/change-plan/tests/run.ts`
Contract:
- Metadata reader 在 lstat、读取、JSON 和 schema 边界产生稳定可区分的错误码，不向调用方泄漏偶然底层异常形状。
Proves:
- 缺失文件、目录占位、无效 JSON 和无效 stage 分别得到 `metadata-not-found`、`metadata-not-regular-file`、`metadata-invalid-json` 与 `metadata-invalid-schema`。
