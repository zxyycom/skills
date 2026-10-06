### Case NOVEL-CARDS-UNICODE-BATCH-035: 批量Unicode字节边界

Tests:
- `test:b37e7ffd9b864b16d443b99d0c020ca0fa9373bebd44a8012d831bbce60d27a8`

Tags:
- `novel-cards`

Contract:
- 批量Markdown不能包含孤立Unicode surrogate，否则UTF-8编码会改变journal记录的事务后字节并破坏恢复比较。

Proves:
- 新对象Markdown包含孤立surrogate时在发布前失败；旧索引字节与三张原卡保持不变，history和journal目录均未创建。
