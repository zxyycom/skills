### Case CHANGE-PLAN-QUERY-BASELINE-ISOLATION-001: 同一项目仓库内不同基线不混用距离

Tests:
- `test:8f268216e23b47ee72a991e4a9474b0b86f730db9f19ae67a24faf2edcb96d50`

Tags:
- `change-plan`

Contract:
- 集合查询共享同一项目仓库与 HEAD，但分别解析不同 Plan 基线并读取各自的 first-parent 历史。

Proves:
- 两个不同基线的 Plan 返回与独立 checker 相同的结果，提交距离分别为一和二；真实 Git trace 共六次调用，只有一次 HEAD 查询，但有两次历史扫描。
