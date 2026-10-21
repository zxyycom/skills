### Case INVESTIGATION-STAGE-DOMAIN-RENAME-001: 领域选择把显式重命名组成删除与新增

Tests:
- `test:44db96829247e0f20450515b512d2fc5cfec00b99c34558b5d83cba8230db90c`

Tags:
- `investigation-report`

Contract:
- 显式重命名以旧 ID 删除加新 ID 新增表达，不从名称相似度推断。

Proves:
- 同选旧新 ID 时，领域 resolver 返回排序后的完整选择、旧 ID 删除及新 ID 正文来源，并保持各自 sourcePath。
- 生产索引定义对所选快照构建的投影移除旧 ID，保留新 ID 的完整当前 entry。
