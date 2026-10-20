### Case TEST-EVIDENCE-PROJECT-INVOCATION-FACTS-001: 项目快照每次调用重新捕获共享导入事实

Tests:
- `test:28b73863befa754133e2be17b3c415ef200a954a166e7da2a9167c34fb6f1083`

Tags:
- `repository-tooling`

Contract:
- 共享导入事实只能在同次快照调用中复用；新的快照调用必须读取当前导入图，不能沿用上次调用的闭包。

Proves:
- 两个命令共享的模块由 initial.ts 改为无扩展名导入 added 后，第二次快照只包含 added registration 及其真实来源 locator，不保留第一次的 fixture registration，且 source revision 改变。
