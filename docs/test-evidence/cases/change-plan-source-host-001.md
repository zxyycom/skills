### Case CHANGE-PLAN-SOURCE-HOST-001: 无本地安装目录时可复用不同兼容版本的宿主依赖

Tests:
- `test:a9bc50adfaec61f8f14c84d48ee88834c1044cdd33c33b5b7a79fc5909ae23f0`

Tags:
- `change-plan`
- `distribution`

Contract:
- 包内 TS 使用 Node 正常依赖解析，不要求依赖来自本地 node_modules 或锁文件精确版本。

Proves:
- 宿主使用 mdast-util-from-markdown 2.0.3 而随包锁为 2.1.0 时，skill 没有本地 node_modules 仍能通过真实 Node help 与 Draft JSON check。
