### Case FILE-TEXT-SEARCH-LIMITED-ERRORS-001: 有界命中范围保留取消和异常

Tests:
- `test:83952eb7769df4acf466553c59a2baf905c58a684c5d742cce6d5d43e5ce6847`

Tags:
- `file-text-search`

Contract:
- 有界范围生成期间取消映射为文件搜索取消错误，其他异常不被伪装成无命中。

Proves:
- 字素映射时触发取消会返回 aborted 错误；映射抛出的其他异常按原异常传播。
