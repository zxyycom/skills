### Case VERSION-CONTROL-WORKSPACE-BATCH-001: 批量工作区读取共享一次新鲜表示依据

Tests:
- `test:2fcefd70b1f2cb6c7ae517a1e8108da8b9f644937eb69b10045e7c57fe8db449`

Tags:
- `version-control`

Contract:
- 显式路径批量读取去重且只取得一次 core.fileMode；false 时共享一次 pending 表示依据，空或缺失路径不变为全仓库读取。

Proves:
- true/false 均保持普通与可执行表示及字节，缺失路径省略；Git trace 表明配置一次、false 的 ls-files 一次，空与全缺失零 Git。
