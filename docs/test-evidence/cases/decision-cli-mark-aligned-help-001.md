### Case DECISION-CLI-MARK-ALIGNED-HELP-001: Mark-aligned 帮助要求核验当前事实

Tests:
- `test:eda6a31f4ddb72a4058f32a5fb1698b9283ae086a846e76bef69d688a05fe778`

Tags:
- `decision-records`

Contract:
- Mark-aligned 的公开帮助必须把对齐建立在完整方向已成为当前事实并完成相关事实源核验之后。

Proves:
- `mark-aligned --help` 成功并完整包含当前事实与事实源核验前提。
