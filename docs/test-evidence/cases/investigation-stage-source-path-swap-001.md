### Case INVESTIGATION-STAGE-SOURCE-PATH-SWAP-001: 同选报告交换位置时保留两个当前版本

Tests:
- `test:0ee43c0ee3e890776f5f55471b613645e3aa671d74406da3342f7f81bcf915ba`

Tags:
- `investigation-report`

Contract:
- 同选报告交换 sourcePath 时，domain scope 保留两份当前报告而不误删除路径。

Proves:
- 真实 Git 中两个路径的 pending 内容分别为交换后的两个 ID 正文；HEAD、pending 索引和工作区索引各保持既有内容。
