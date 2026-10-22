### Case INVESTIGATION-CANDIDATE-DISCARD-005: candidate discard fails closed on invalid formal references

Tests:
- `test:f0cebcec54ed3d44e701067d53b847d6caac14507583f0c9c19aa80b0ca11440`

Tags:
- `investigation-report`

Contract:
- candidate owner resource 的删除必须可靠排除正式报告引用；正式报告的资源引用无法验证时，`discard` 必须 fail closed。

Proves:
- 具有 candidate owner resource 链接但正文无效的正式 Markdown 会阻断候选删除。
- candidate 与其 owner resource 保持原样。
