### Case DECISION-LAZY-GRAPH-PUBLISHED-001: 发布快照查询保留校验结果且不暴露图访问器

Tests:
- `test:7688fa25da8c5fe2c96ba22e7a4f4296d73f1b585bd171aa1dc1a472f7ae04f5`

Tags:
- `decision-records`

Contract:
- 发布快照查询必须保留严格完整关系校验的结果；图访问器属于内部上下文，不进入公开结果。

Proves:
- 普通 list、show、trace、metadata search 与带关系条件的 list、metadata search 返回请求对应的命令；按各命令核对成员、边证据、coverage、正文与来源，结果顶层不含图访问器。
