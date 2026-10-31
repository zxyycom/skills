### Case DECISION-SELECTED-RAW-BASELINE-PRIORITY-001: Selected sync 对已采集坏基线保留原始selector优先级

Tests:
- `test:7cb18a2d5d19e4fdaada20ac2a3c36ffcca6ef3ece94a9dd082624a8247d7714`

Tags:
- `decision-records`

Contract:
- 已采集的失败 baseline 只避免同阶段重读，不得跨过共同 owner 的原始 selector 形态与重复验收。

Proves:
- 已有坏JSON基线时，空selector和原始重复selector仍分别返回selector-invalid/selector-duplicate，不被baseline-invalid取代且索引字节保持。
