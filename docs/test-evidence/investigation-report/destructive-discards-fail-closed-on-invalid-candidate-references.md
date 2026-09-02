### Case INVESTIGATION-CANDIDATE-DISCARD-004: destructive discards fail closed on invalid candidate references

Entry:

- `tools/investigation-report/tests/publish.test.ts > destructive discards fail closed when candidate resource references cannot be read`
- `bun test --test-name-pattern="^destructive discards fail closed when candidate resource references cannot be read$" ./tools/investigation-report/tests/run.ts`

Contract:

- 删除正式 owner 资源前，正式 `discard` 必须能安全读取全部 candidate 的资源引用；合法 basename 但无效的 candidate 不能被当作无引用而绕过保护。

Proves:

- candidate 资源引用无法解析时，正式 `discard --delete-owned-resources` 以零写入失败。
- 正式报告和 owner resource 字节保持不变。
