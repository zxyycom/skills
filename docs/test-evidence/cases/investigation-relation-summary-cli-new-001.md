### Case INVESTIGATION-RELATION-SUMMARY-CLI-NEW-001: CLI new 为目标绑定 Unicode 摘要

Tests:
- `test:0bddbe9c9fcbb28ded7d96dadd1281e9b002e535f616d35c0a19bacafe726b9f`
- `test:8ae4b9c86c67ca0b3bab4514adf8401d805dd6354173b9df723ef946b87861b0`
- `test:9d2f1b4a01893e829832bf167dcc05efe07e0d68e9ef08fbcae09e3e758b48c7`
- `test:f754be834cb65b05e14d5fe9f01e5dc01c2258895b6d098d0d7d0cec7642c443`

Tags:
- `investigation-report`

Contract:
- new 可为关系目标绑定合法摘要，并以 Unicode 码点计算摘要长度；不能仅提供无关系的摘要，且 relation 与 summary 的目标须各自解析后绑定。

Proves:
- 真实 CLI 将以目标名称传入的 40 个非 BMP 码点摘要写入候选；41 个码点时失败且未创建候选。
- relation 使用名称、summary 使用完整 ID 时正确绑定并保留值中的 =；反向使用完整 ID 与名称时，空白值省略、边缘换行 trim、内部换行和不存在日期 ID 拒绝。
- 只传 relation-summary 不传 relation 时真实 CLI 失败，新候选不存在，已有候选字节与目录项保持。
