### Case INVESTIGATION-STAGE-DOMAIN-RENAME-001: stage --scope domain stages an explicit rename as deletion plus addition

Tests:
- `test:7778ed4253aa7fe256fbdcb25d03d0dc7929327f1ff1b5ba09e0ec4e50482781`

Tags:
- `investigation-report`

Contract:
- 显式重命名以旧 ID 删除加新 ID 新增表达，不从名称相似度推断。

Proves:
- 同选新旧 ID 后 pending 含旧报告删除与新报告新增；索引保持零变化。
