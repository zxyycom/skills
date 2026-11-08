### Case INVESTIGATION-DISCARD-FINAL-001: 删除 owner 资源须显式确认

Tests:
- `test:8a884f3dd1b301d3859f85fb1080bd595a8f8476648854f1111291159ab846eb`

Tags:
- `investigation-report`

Contract:
- 调查报告删除计划必须显式确认所拥有资源的删除。

Proves:
- 纯计划对未确认资源删除返回 ResourceDeletionNotConfirmed；两种确认均提供后计划包含 owned_resources。
