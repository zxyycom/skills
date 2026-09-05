### Case INVESTIGATION-RELATION-SUMMARY-CLI-NEW-001: CLI new binds relation summaries after selector resolution and preserves equals

Entry:

- `tools/investigation-report/tests/cli-generated.test.ts > CLI new binds relation summaries after selector resolution and preserves equals`
- `bun test --test-name-pattern="^CLI new binds relation summaries after selector resolution and preserves equals$" ./tools/investigation-report/tests/run.ts`

Contract:

- `new` 的 relation 与 relation-summary target 分别按 ID-first/name selector 解析，再将 summary 绑定完整 relation set 中唯一 target；summary-only 无效，summary 只按首个 `=` 分隔。

Proves:

- relation 使用 name、summary 使用标准 ID 时仍绑定同一 target，并保留正文中的后续 `=`。
- 没有 `--relation` 的 summary-only 调用以 CLI 参数错误退出且不创建 candidate。
