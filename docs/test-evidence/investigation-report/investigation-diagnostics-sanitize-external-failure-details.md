### Case INVESTIGATION-DIAGNOSTIC-SANITIZATION-001: investigation diagnostics sanitize external failure details

Entry:
- `tools/investigation-report/tests/transaction.test.ts > investigation diagnostics sanitize external failure details`
- `bun test --test-name-pattern="^investigation diagnostics sanitize external failure details$" ./tools/investigation-report/tests/run.ts`

Contract:
- Investigation Report 的系统错误 detail 只输出经净化的受控信息，不泄露 token 或绝对路径，也不传播换行或无限长度文本。

Proves:
- 含 Git token、绝对路径、换行和超长内容的外部 Error 经诊断和 renderer 后均不泄露 token，detail 无换行且最多 500 字符；generic reason 也会经同一净化边界。
