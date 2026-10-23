### Case RECORD-SELECTED-BASELINE-PRIORITY-001: 严格 baseline 与 selector 的失败阶段保持

Tests:
- `test:702ce60a95f4e9051c1f4b54e044e1e2c628fa32df87a9d84d64b960a1e7ab11`
- `test:f75f0f77a67f63d7f0b267ec487e4ca600b2c1a2edb68b69fc76c214d1b08ad7`

Tags:
- `decision-records`
- `investigation-report`

Contract:
- selected sync 先验 baseline 结构/字段，selector 解析后由 native baseline 门槛验 canonical；首次读取失败不得重试后吞掉原错误。

Proves:
- 两域 API/CLI 对合法非 canonical JSON 与未知 selector 返回 selector-not-found；已知 selector 仍拒绝非 canonical。坏 JSON/字段优先 baseline 失败，不被 selector 盖过，持久字节不变。
- EACCES baseline 读取只尝试一次/入口，保留 access-denied，不降级或变为 selector 错误。
