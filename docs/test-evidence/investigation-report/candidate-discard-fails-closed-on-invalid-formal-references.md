### Case INVESTIGATION-CANDIDATE-DISCARD-005: candidate discard fails closed on invalid formal references

Entry:

- `tools/investigation-report/tests/publish.test.ts > candidate discard fails closed when formal resource references are invalid`
- `bun test --test-name-pattern="^candidate discard fails closed when formal resource references are invalid$" ./tools/investigation-report/tests/run.ts`

Contract:

- candidate owner resource 的删除必须可靠排除正式报告引用；正式报告的资源引用无法验证时，`discard-candidate` 必须 fail closed。

Proves:

- 具有 candidate owner resource 链接但正文无效的正式 Markdown 会阻断候选删除。
- candidate 与其 owner resource 保持原样。
