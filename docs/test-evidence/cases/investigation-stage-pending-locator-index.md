### Case INVESTIGATION-STAGE-PENDING-LOCATOR-INDEX-001: domain 按必要性消费 pending 定位索引

Tests:
- `test:37683bc6ce4321713f4ca3278c14a8671042622bd001c926ae1e2c28f24c79b9`
- `test:39593ae9986e15d38f6187af26396a98479a4f577a06ab54f3367a2c47bf8c68`
- `test:5206298f77a7ea0c281a5b7c7fe5a421a892df97fb73efef8ef36674628c035f`
- `test:a736635920a88263c738b447a93d19464727e0559f77395743edbb69617ee776`
- `test:a7460913bae33760dd4cc074a184d6d10c6db20b0ae8425447787b8a5a4b5b11`
- `test:b2223051744ff3b519aaddf2287616f6e1aebba137b3449abc863c0c1420b324`
- `test:cb8eff08dac6ce827354544b1acdff5f7a7039407fae8eef7251e1c1f47fc277`

Tags:
- `investigation-report`

Contract:
- domain scope 使用可用合法 P 索引为全部所选 ID 补充旧 sourcePath，并始终核对可直接定位的所选 canonical pending 成员；身份已由 H/W 解析不省略旧位置收集。成功消费的索引字节与所选路径进入 payload、fresh 和 opaque 保护，索引与未选 pending 不改写。
- P 索引读取或解析不可用时，只要 H/W 或经核对的 canonical 成员仍足够定位所选，可保留原索引身份或已读字节继续；否则明确失败。该容错不覆盖已确定所选正文的读取、身份或路径失败。

Proves:
- HEAD 仅有 first、P 索引记录 second 的 legacy-locator.md、W 已删除 second 时，以 name 选择 domain 成功删除该 pending 正文，P 索引字节和 first 完整 Git 条目保持。
- 独立 P 索引 blob 缺失但 H/W 可定位 first 时，domain 仍成功刷新 first，缺失 blob 的索引 Git 条目保持。
- P 索引已 staged 删除时，canonical pending-only second 可被取消，索引删除状态不被恢复。
- H/W 不含 second、其 canonical pending 正文可直接定位且 P 索引为非法 JSON 时，name 与完整 ID 均成功取消该正文，P 索引原字节、mode、OID 及 first 完整条目保持。
- canonical basename 与所选完整 ID 相同但 header 声明另一 ID 时，domain 零改写拒绝，不因 P 索引不可解析而掩盖所选身份失败。
- H、P、W 为同 ID 分别声明 head-old.md、staged-old.md、current.md 时，domain 清理合法 P 索引指向的 staged-old.md；P 索引 bytes、mode、OID 与未选完整 Git 条目保持。
- H 已知同 ID、P 旧正文位于 canonical ID basename 且 P 索引为坏 JSON 时，domain 仍核对并删除该旧正文，只保留 current.md，P 索引和未选对象不变。
