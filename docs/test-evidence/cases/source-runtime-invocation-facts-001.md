### Case SOURCE-RUNTIME-INVOCATION-FACTS-001: TS 分发闭包同次共享事实且跨调用重新捕获

Tests:
- `test:de8b536a202973544548d171652a33f0c6843a939ff46434291bdc863b90bbe0`

Tags:
- `runtime-source`
- `tooling`

Contract:
- TS 分发闭包生成可以向多个 skill 显式传递绑定同一 workspace root 的冻结事实；后续调用必须重新捕获当前依赖引用，未传入事实的独立生成保持相同结果。

Proves:
- 同一冻结 facts 及 dependencies 用于两个 skill 时得到相同来源闭包，闭包包含 first.ts 而不含 second.ts。
- 入口改为导出 second.ts 后，重新捕获产生不同 facts 与 references 对象，生成闭包包含 second.ts 且不再含 first.ts；未显式传 facts 的独立生成与刷新结果一致。
- 独立临时 workspace 捕获的 facts 记录该 root，AST 引用键与生成 artifact 路径均位于该 root；把同一 facts 用于另一个 root 被明确拒绝。
