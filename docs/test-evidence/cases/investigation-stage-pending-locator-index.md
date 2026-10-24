### Case INVESTIGATION-STAGE-PENDING-LOCATOR-INDEX-001: domain 按必要性消费 pending 定位索引

Tests:
- `test:4e63ee8ab6ffa8535a46888575959632869789d037bee8be3be5b5204791d081`
- `test:63c60bab4e6c14f79baddc96a71503d9e18c6a07bc1ff257b2f25e3e4ffdef04`
- `test:739ae8924e2d785b8ab469bffe252972f2c50705bdcdf1ed8879bb72d16b1a7d`
- `test:88f85ae336ba5876117f6e8797fe568759b0d97baf9613dac76e43201d8e80be`
- `test:89092e7140e83821b2b14d3c20db2d7ac9da783a8492b8ff4bbf9760c6b363e9`
- `test:ec23314c361d99bbf2d104cc6770d9f0789cde6c304a022a1c1cf41ce97ccbcc`
- `test:ff16ae946fb96e7a51003449434fd1d985136840990ab18928bc3326cbb94f98`

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
