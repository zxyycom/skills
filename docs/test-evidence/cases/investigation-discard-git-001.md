### Case INVESTIGATION-DISCARD-GIT-001: 已记录报告的删除计划要求确认

Tests:
- `test:8a884f3dd1b301d3859f85fb1080bd595a8f8476648854f1111291159ab846eb`
- `test:a3aa7a386c422674fea73eae9c5da2e54dc24e0d53d77d795d109ca099e88d2e`

Tags:
- `investigation-report`

Contract:
- 已记录调查报告或候选的删除须获得明确确认。

Proves:
- 纯计划对 Recorded 且未确认的目标返回 RecordedDeletionNotConfirmed；确认后可生成计划。
- 真实 Git 记录的候选经 CLI 请求删除但未确认时失败，结果要求 recorded 确认且候选仍存在。
