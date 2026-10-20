### Case GATE-TOOL-PROOF-COMPONENTS-001: 工具证明分量与生成前置共同约束复用发布

Tests:
- `test:451166b8fdc7af3f26103c4d06d7db8cc4d841825b3720f8834bf76c2f0d6d92`
- `test:d5fc4f368eebc344916b27b8e613766caf11dc4f09baecaabe58a6a75f1edbb8`

Tags:
- `repository-tooling`

Contract:
- Check receipt 只有在工具分量完整且精确一致时可复用；工具触发所需的生成前置属于实际执行集合，发布前必须全部通过。

Proves:
- 即使 Check fingerprint 精确命中，工具分量缺失、为空、多余或值不一致仍使该 Check 执行并激活对应工具。
- Novel Cards receipt 缺失时，执行集合同时包含领域 consumer 与生成前置，前置标记 prerequisite-triggered；只报告 consumer 通过不能发布，全部通过后才可发布。
