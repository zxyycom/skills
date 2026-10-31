### Case LIGHTWEIGHT-JUDGMENT-ADAPTER-003: 原生结果与统一结果分离

Tests:
- `test:4f892cd495831124e330ec850feca25560397918aad309499535b084ebcf3a13`

Tags:
- `lightweight-judgment`

Contract:
- 直接 `openai-decisions` 的原生数组结果完整保留；normalized 按原题 ID 和候选身份映射，不重算概率、score 或选择，合法拒答独立表达；OR 的 answers map 不继承其 partial／refused 合同。

Proves:
- 重排概率数组仍正确关联原字符串键；非最大 choice、未归一化概率和独立 score 保留，Score 分列 providerLabels 与原 requestRubric；混合／全 refusal 显式 partial／refused，Noul 不新增 confidence。
