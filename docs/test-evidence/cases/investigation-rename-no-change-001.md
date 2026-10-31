### Case INVESTIGATION-RENAME-NO-CHANGE-001: 已规范 identity 的 rename 零写入

Tests:
- `test:6120c7ad81f12d9260d3abd6b4dfa41926ddb03ccf0c920afffb950cbb6e4b4e`

Tags:
- `investigation-report`

Contract:
- source 与 target 解析到同一 ID、name、sourcePath 和 resource owner 时，Investigation rename 是零写入 no-op，不需要 recorded-history 确认，也不移动 owner。

Proves:
- 结果 `changed: false`，计划中的关系、资源引用和 owner 移动计数均为零。
- report、index 和 owner 文件字节保持不变，发布、资源移动和写入 hook 均未执行。
