### Case INVESTIGATION-HISTORY-PATH-QUERY-BATCHING-001: 前序历史核对支持大批 HEAD 来源

Tests:
- `test:94198fc118df8a82954bbbc2a636aff9e950a340aedc1737ec5449a2d5ce2046`

Tags:
- `investigation-report`
- `version-control`

Contract:
- 前序报告的 Git HEAD 来源核对支持超过单批保守传输预算的直属正式来源路径列表。

Proves:
- 隔离 Git tree 中 201 个合法来源使路径请求进入多批；源码与实际分发副本均正确确认已记录的前序，不产生不可用或未提交警告。
- 真实 Node 分发 CLI 的全量 check 退出 0、确认当前索引，stderr 不包含历史检查不可用或参数超长警告。
- 真实 CLI 的 Git Trace2 显示多个有界 ls-tree 调用，可识别宽松宿主上的未拆批回归。
