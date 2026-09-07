### Case INVESTIGATION-CANDIDATE-DISCARD-005: candidate discard fails closed on invalid formal references

Tests:
- `test:a9daaa758352d30fe11b861a4547865802a6a25a26798567cbf2c99d2e0dc5d1`

Tags:
- `investigation-report`

Contract:
- candidate owner resource 的删除必须可靠排除正式报告引用；正式报告的资源引用无法验证时，`discard-candidate` 必须 fail closed。

Proves:
- 具有 candidate owner resource 链接但正文无效的正式 Markdown 会阻断候选删除。
- candidate 与其 owner resource 保持原样。
