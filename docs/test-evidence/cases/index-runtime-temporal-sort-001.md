### Case INDEX-RUNTIME-TEMPORAL-SORT-001: 跨时区偏移按时间点排序

Tests:
- `test:b5b63667339f373d63b5377e9294e1ffd6f8b6308c008306263bc73fd94d8e19`

Tags:
- `index-runtime`

Contract:
- 时间键排序必须比较规范时间点而非原始文本。

Proves:
- 带偏移时间与 UTC 时间按真实先后顺序返回。
