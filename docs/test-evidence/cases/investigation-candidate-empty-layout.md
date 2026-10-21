### Case INVESTIGATION-CANDIDATE-EMPTY-LAYOUT-001: 无索引空正式集合支持首条候选

Tests:
- `test:59ee787fc00b9c7d3c8810c2b3776bd180e68602d24e18cdca8b06e8b5468420`

Tags:
- `investigation-report`

Contract:
- 尚无正式报告和索引时，合法首条候选仍可准备和读取。

Proves:
- formalSources 为空且索引缺失时，首条完整候选读取成功，无正文或资源错误。
