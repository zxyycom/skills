### Case NOVEL-CARDS-REFERENCE-BOUNDARY-005: 参考区选择与当前边界

Tests:
- `test:a6c58ad4290e18f68e12568bf55c929ecd0b7dce53568a10a8ea9e0319cdd90d`

Tags:
- `novel-cards`

Contract:
- 参考卡内容须显式读取；sources可跨区，但current children不能纳入reference。

Proves:
- 读取当前卡不输出参考正文；参考读取缺标志失败，有标志成功；当前包含参考失败。
