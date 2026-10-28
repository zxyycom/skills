### Case FILE-TEXT-SEARCH-LIMITED-ERRORS-001: 有界命中范围保留取消和异常

Tests:
- `test:a491c2a762a70b6de407a902dd2bde02c6fe038c4659f039e22bb0954c38fe30`

Tags:
- `file-text-search`

Contract:
- 有界范围生成期间取消映射为文件搜索取消错误，其他异常不被伪装成无命中。

Proves:
- 字素映射时触发取消会返回 aborted 错误；映射抛出的其他异常按原异常传播。
