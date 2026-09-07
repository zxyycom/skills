### Case INDEX-RUNTIME-TEMPORAL-SORT-001: 跨时区偏移按时间点排序

Tests:
- `test:09754a498668d5217a9553af886536139b3e488c44eeea6f96c51ec2b7f8b008`

Tags:
- `index-runtime`

Contract:
- 时间键排序必须比较规范时间点而非原始文本。

Proves:
- 带偏移时间与 UTC 时间按真实先后顺序返回。
