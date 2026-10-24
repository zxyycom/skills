### Case INVESTIGATION-LAZY-EVIDENCE-001: 乱序构图保持关系证据顺序

Tests:
- `test:028439ff5b1cae6b3b7d0c2eeec9849d724e83026cec4b03f3ce50c0516a66ee`

Tags:
- `investigation-report`

Contract:
- 不同输入边序不改变关系证据的稳定目标顺序、tuple 归并与摘要。

Proves:
- 正序与逆序条目/关系投影均返回按 target 排序的两条归并证据和原摘要。
