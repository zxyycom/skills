### Case CHANGE-PLAN-METADATA-ERRORS-001: Metadata reader 映射稳定边界错误码
Entry:
- `tools/change-plan/tests/metadata.test.ts > metadata reader maps file and parse boundaries to stable error codes`
- `bun test --test-name-pattern="^metadata reader maps file and parse boundaries to stable error codes$" ./tools/change-plan/tests/run.ts`
Contract:
- Metadata reader 把文件存在性、路径类型和内容解析失败收口为稳定领域错误码，不向调用方泄漏偶然底层异常形状。
Proves:
- 缺失文件得到 `missing`，目录占位得到 `invalid-path`，无效 JSON 与无效 stage 都得到 `invalid`。
