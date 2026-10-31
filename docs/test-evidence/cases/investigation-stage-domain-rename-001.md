### Case INVESTIGATION-STAGE-DOMAIN-RENAME-001: 领域选择把显式重命名组成删除与新增

Tests:
- `test:b2a434347dfec5d1cb9f43cf156540c229860a52783bc21d5eb46491b427722a`

Tags:
- `investigation-report`

Contract:
- 显式重命名以旧 ID 删除加新 ID 新增表达，不从名称相似度推断。

Proves:
- 同选旧新 ID 时，领域 resolver 返回排序后的完整选择、旧 ID 删除及新 ID 正文来源，并保持各自 sourcePath。
- 生产索引定义对所选快照构建的投影移除旧 ID，保留新 ID 的完整当前 entry。
