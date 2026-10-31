### Case INVESTIGATION-CANDIDATE-PUBLISH-001: publish preflight establishes only explicit candidates

Tests:
- `test:09395035ed972524e20ae15e827cfef99c285ca026a2bba466dddab1b3a1616f`

Tags:
- `investigation-report`

Contract:
- `publish --preflight` 只读预演显式 candidate 批次；普通 publish 只建立所选 candidate 并写入完整正式索引，两阶段都为显式来源返回 relationReview。

Proves:
- 预检不改 candidate、正式报告或索引，并输出 `preflight` establish review。
- 正常 publish 将所选 candidate 的原字节建立为正式报告，未选择 candidate 保持不变，输出 `committed` establish review，默认全量检查仍通过。
