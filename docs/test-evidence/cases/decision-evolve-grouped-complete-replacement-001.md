### Case DECISION-EVOLVE-GROUPED-COMPLETE-REPLACEMENT-001: Evolve 拒绝不完整或不纯的分组 replacement

Tests:
- `test:ba277de217dbedc67c72cb336b66f8c3a2619b3af337123354fe567aad5a2a16`

Tags:
- `decision-records`

Contract:
- 同一 `evolve` 中，分组 replacement 仍须让全部 selected successor 共同形成有效的闭合策略；未分组 source 只能保留其自身完整关系，不能替代遗漏或错误的 replacement。

Proves:
- 纯生命周期准备对缺少分组、predecessor 不一致及单组混入非拆分关系分别返回明确领域错误，全部不含 changes。
