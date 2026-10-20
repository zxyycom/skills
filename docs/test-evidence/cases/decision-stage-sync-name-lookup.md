### Case DECISION-BATCH-NAMES-001: 暂存与选择性同步保留混合名字选择及错误

Tests:
- `test:83c440ac88106249ef3e36a24e4422971478b5db842d6e2122fbcddbc17533f4`

Tags:
- `selector`

Contract:
- stage 与 selected sync 仍按完整 ID 或唯一名字定位，并保留解析重复和缺失来源错误及 pending 保护。

Proves:
- 完整源稀疏圈混合 ID/name 同步预演与 index 暂存成功；两种入口的同 ID 双 selector 与日期 ID miss 返回各自错误/退出码，失败不改 pending。
