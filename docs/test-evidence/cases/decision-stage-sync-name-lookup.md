### Case DECISION-BATCH-NAMES-001: 暂存与选择性同步保留混合名字选择及错误

Tests:
- `test:83c440ac88106249ef3e36a24e4422971478b5db842d6e2122fbcddbc17533f4`

Tags:
- `selector`

Contract:
- stage 与 selected sync 按完整 ID 或唯一名字定位，并保留重复选择与缺失来源的错误分类；stage 的参数解析、选择与投影可独立验证。

Proves:
- 非 Git FS fixture 中，混合 ID/name 的实际 selected sync 预演成功；真实 argv 解析回调的 stage index 选择得到完整目标集合，生产索引投影包含全部后继 entry。
- 同一 ID 的双 selector 与日期 ID miss 在 stage 领域失败映射中退出码为 2，实际 sync-index CLI 对应失败退出码为 1；正式索引完整字节保持不变。
