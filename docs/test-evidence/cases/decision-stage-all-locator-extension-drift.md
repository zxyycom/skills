### Case DECISION-STAGE-ALL-LOCATOR-EXTENSION-DRIFT-001: all 暂存拒绝 locator 到扩展捕获之间的 pending 漂移

Tests:
- `test:eb71b1906bfd499b13f6e78d1b7f452f3c19408b88eee08b1f3a65dce60dfac8`

Tags:
- `decision-records`
- `index-runtime`

Contract:
- all 暂存复用定位用索引（locator）的解析前，须以最终暂存区快照证明完整路径、mode、OID 及已读内容未变；并发替换不得被本次暂存覆盖。

Proves:
- 在准备阶段 locator 完成解析后替换暂存区索引 OID，即使新旧索引仅尾部空白不同，all 暂存仍返回 pending-conflict。
- 完整暂存区条目及索引字节保留并发写入的版本；工作区索引和所选正文均保持调用前字节。
