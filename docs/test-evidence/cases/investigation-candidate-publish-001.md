### Case INVESTIGATION-CANDIDATE-PUBLISH-001: publish preflight establishes only explicit candidates

Tests:
- `test:ed90870348a1fe15bc8a21487c43d0b388f0cc8391f46ad3b38ca60474073e92`

Tags:
- `investigation-report`

Contract:
- `publish --preflight` 只读预演显式 candidate 批次；普通 publish 只建立所选 candidate 并写入完整正式索引。

Proves:
- 预检不改 candidate、正式报告或索引。
- 正常 publish 将所选 candidate 的原字节建立为正式报告，未选择 candidate 保持不变，默认全量检查仍通过。
