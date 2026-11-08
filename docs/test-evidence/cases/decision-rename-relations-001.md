### Case DECISION-RENAME-RELATIONS-001: Rename 改写正式引用并拒绝来源漂移

Tests:
- `test:ace078cbf203c835d7f02c733fb568d9c7c20c08e23edfc125fcbdd8e2b575fc`

Tags:
- `decision-records`

Contract:
- 正式改名应改写发布索引可见的正式引用来源。

Proves:
- 引用来源已漂移时预检拒绝；恢复后预检报告一个正式引用，提交后引用正文含新 ID、不再含旧 ID，归档新路径存在。
