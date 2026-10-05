### Case INVESTIGATION-STAGE-SYMLINK-SOURCE-001: 选中 owner 的符号链接来源阻断暂存

Tests:
- `test:1bc50cab82b69fb68c0873272774ead841ac35b37089d89a46de9ba7ce3cc615`

Tags:
- `investigation-report`
- `version-control`

Contract:
- 选中报告及 owner 资源的工作区来源须为常规非符号链接文件，不满足时 pending 保持不变。

Proves:
- 选中 owner 的新符号链接返回 `investigation-report.stage-source-read-failed` 诊断与 `domain-stage-failed`，完整 pending index 与原脚本内容保持不变。
