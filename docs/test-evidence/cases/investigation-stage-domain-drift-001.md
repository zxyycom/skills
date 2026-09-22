### Case INVESTIGATION-STAGE-DOMAIN-DRIFT-001: stage rejects owner source drift before the pending write stays atomic

Tests:
- `test:c00fcf40229db1edbeaf16b228f360460bc49045b225dbd281c6a261c0aba47c`

Tags:
- `investigation-report`

Contract:
- 写前重读所选来源字节，漂移使事务零写入停止。

Proves:
- 注入资源读取间漂移后返回 source-drift；暂存区保持空，工作区漂移内容不被改写。
