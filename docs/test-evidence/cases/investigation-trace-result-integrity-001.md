### Case INVESTIGATION-TRACE-RESULT-INTEGRITY-001: 拆分预算结果的成员一致性

Tests:
- `test:8ad09f135902ceb10e7afd2f94bbfbd10c422906f74101b2e94a7e79c44bd1b0`

Tags:
- `investigation-report`

Contract:
- 追溯预算拒绝完整拆分时，已接纳成员与 entries 保持一致。

Proves:
- 调查拆分预算不足的结果仅含 anchor traceId、空 contextIds，entries 恰含该 anchor，并返回完整 blockedEvent。
