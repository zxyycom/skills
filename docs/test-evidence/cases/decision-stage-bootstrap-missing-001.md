### Case DECISION-STAGE-BOOTSTRAP-MISSING-001: 无 revision 的 Stage 拒绝不存在 ID

Tests:
- `test:52be62c17ca77ede97918809893f1176cc31176bdc9f14706fd6a88ba9366eb6`

Tags:
- `decision-records`

Contract:
- 没有 HEAD 的 stage 仍必须在工作区发布身份集合内解析选择，缺失 ID 不得写入 pending。

Proves:
- 真实 unborn Git stage 对缺失 name 返回选择失败，pending tree identity 保持不变。
