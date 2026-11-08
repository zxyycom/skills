### Case INVESTIGATION-RENAME-HISTORY-001: 已记录候选 rename 须确认

Tests:
- `test:a3aa7a386c422674fea73eae9c5da2e54dc24e0d53d77d795d109ca099e88d2e`

Tags:
- `investigation-report`

Contract:
- 已进入 Git HEAD 的候选 rename 必须使用候选专属确认。

Proves:
- 真实 Git 中无确认和仅正式报告确认均拒绝；提供 rename-recorded-candidate 后提交。
