### Case GATE-TOOL-PROOF-COMPONENTS-001: 工具证明分量与生成前置共同约束复用发布

Tests:
- `test:32e8a1d8c2f5eda83ac363f5b94dbbc07a586abdb312b4c2702032ff88edd390`
- `test:a35aa42febded3c86e91e274e0f5644c4e239ccf46e134f7bcec6deccd15c8fa`

Tags:
- `repository-tooling`

Contract:
- Check receipt 只有在工具分量完整且精确一致时可复用；工具触发所需的生成前置属于实际执行集合，发布前必须全部通过。

Proves:
- 即使 Check fingerprint 精确命中，工具分量缺失、为空、多余或值不一致仍使该 Check 执行并激活对应工具。
- Novel Cards receipt 缺失时，执行集合同时包含领域 consumer 与生成前置，前置标记 prerequisite-triggered；只报告 consumer 通过不能发布，全部通过后才可发布。
