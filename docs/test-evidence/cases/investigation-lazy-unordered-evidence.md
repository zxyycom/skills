### Case INVESTIGATION-LAZY-EVIDENCE-001: 乱序构图保持关系证据顺序

Tests:
- `test:afbdda94ef2785cb1fa769979ad107c5b9ae44439ac84a9a566e82ddf0d7fe51`

Tags:
- `investigation-report`

Contract:
- 不同输入边序不改变关系证据的稳定目标顺序、tuple 归并与摘要。

Proves:
- 正序与逆序条目/关系投影均返回按 target 排序的两条归并证据和原摘要。
