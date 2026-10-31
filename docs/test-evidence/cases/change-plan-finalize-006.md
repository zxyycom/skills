### Case CHANGE-PLAN-FINALIZE-006: Finalize 预演在删除前重验 target、成员与 HEAD

Tests:
- `test:4e10ef76f06a71f42ac282b8627ecf6234a69cb75525f5977396b1427f089132`

Tags:
- `change-plan`

Contract:
- 预演不建立删除提交点；实际删除前必须重新确认 tombstone child 不存在、每个 member 未漂移且 HEAD 保持一致。

Proves:
- 后出现的 tombstone target、已读取文件内容变化、及 HEAD 前进各自返回 `no-change`。
- 每种重验失败都保留 source Change。
