### Case DECISION-BATCH-NAMES-001: 暂存与选择性同步保留混合名字选择及错误

Tests:
- `test:4622f2a74d6d9869cb5110bab3fb7050ef38ebc61358a7ff72fe0326826d2ef2`

Tags:
- `selector`

Contract:
- stage 与 selected sync 仍按完整 ID 或唯一名字定位，并保留解析重复和缺失来源错误及 pending 保护。

Proves:
- 完整源稀疏圈混合 ID/name 同步预演与 index 暂存成功；两种入口的同 ID 双 selector 与日期 ID miss 返回各自错误/退出码，失败不改 pending。
