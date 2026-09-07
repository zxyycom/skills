### Case CHANGE-PLAN-COMPLETE-006: 预演在删除前重验 target、成员与 HEAD

Tests:
- `test:34426025da997169a7278fec3dcde564992bb9c3843b7eea3d7e2a9ee2a8a57f`

Tags:
- `change-plan`

Contract:
- 预演不建立删除提交点；实际删除前必须重新确认 tombstone child 不存在、每个 member 未漂移且 HEAD 相同。

Proves:
- 后出现的 tombstone target、已读取文件内容变化、及 HEAD 前进各自返回 `no-change`。
- 每种重验失败都保留 source Change。
