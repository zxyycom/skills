### Case NATIVE-RECORD-SOURCE-DEEP-CHAIN-001: 深引用链不导致进程栈溢出

Tests:
- `test:4bf09886bc70d870512d6b6d98cd0de003df07ecec207956273783c472f8c21e`

Tags:
- `investigation-report`
- `record-rust`

Contract:
- 合法、大小限制内的深来源引用链可以加载和选源，不因调用栈深度导致进程崩溃。

Proves:
- 曾触发递归栈溢出的 20,000 个 key 单链通过真实 help 子进程成功加载，显示 k19999 且仅列一个来源。
- 无报告或索引准备；私有临时文件承接大量帮助输出，30 秒截止确保直接 cargo 调用也可终止。
