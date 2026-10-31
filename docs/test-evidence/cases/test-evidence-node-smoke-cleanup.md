### Case TEST-EVIDENCE-NODE-SMOKE-CLEANUP-001: Node smoke 的私有进程作用域关闭后不遗留或重启子进程

Tests:
- `test:38e7ca49d6cb836b68391c447ef4765ec4831708d223c2faa266752eb1a2a058`

Tags:
- `test-evidence`

Contract:
- Node smoke fixture 的清理必须等待所属活子进程关闭，再清理工作目录；关闭的作用域不能继续启动进程，取消不能冒充 CLI 退出结果。

Proves:
- 真实 Node 发出 PID 就绪信号后仍保持运行；关闭作用域返回时该 PID 已不存在，原调用以独立取消值结算。
- 关闭后的新调用返回取消值，且其写入 marker 的程序未执行；不声明第三方进程树清理或所有 runner 的超时语义。
