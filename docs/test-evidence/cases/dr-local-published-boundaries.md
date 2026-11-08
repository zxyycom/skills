### Case DR-LOCAL-PUBLISHED-BOUNDARIES-001: 正式改名改写者需要来源当前性

Tests:
- `test:ace078cbf203c835d7f02c733fb568d9c7c20c08e23edfc125fcbdd8e2b575fc`

Tags:
- `decision-records`

Contract:
- 普通 rename 使用发布索引发现实际改写的正式引用者，改写前须核对所选来源当前性。

Proves:
- 正式引用者在工作区未同步编辑时 rename 预检拒绝；恢复后改名成功并改写引用者。
