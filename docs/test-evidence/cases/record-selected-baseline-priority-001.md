### Case RECORD-SELECTED-BASELINE-PRIORITY-001: 严格 baseline 与 selector 的失败阶段保持

Tests:
- `test:e2f537955f5a4c7ed72b32ccda11ab5b547f4071992fea2887dcb3a39191d344`
- `test:fe8b3d3fe922b8f0a48047fa82011594f5692091140286ded314ede04bf57d88`

Tags:
- `decision-records`
- `investigation-report`

Contract:
- selected sync 先验 baseline 结构/字段，selector 解析后由 native baseline 门槛验 canonical；首次读取失败不得重试后吞掉原错误。

Proves:
- 两域 API/CLI 对合法非 canonical JSON 与未知 selector 返回 selector-not-found；已知 selector 仍拒绝非 canonical。坏 JSON/字段优先 baseline 失败，不被 selector 盖过，持久字节不变。
- EACCES baseline 读取只尝试一次/入口，保留 access-denied，不降级或变为 selector 错误。
