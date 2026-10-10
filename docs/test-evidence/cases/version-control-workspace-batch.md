### Case VERSION-CONTROL-WORKSPACE-BATCH-001: 批量工作区读取共享一次新鲜表示依据

Tests:
- `test:4fc62965353a5f2eeb8a312f2cca36ef283505248d9813cad79a428cab83589f`

Tags:
- `version-control`

Contract:
- 显式路径批量读取去重且只取得一次 core.fileMode；false 时共享一次 pending 表示依据，空或缺失路径不变为全仓库读取。

Proves:
- true/false 均保持普通与可执行表示及字节，缺失路径省略；Git trace 表明配置一次、false 的 ls-files 一次，空与全缺失零 Git。
