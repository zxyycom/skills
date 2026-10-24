### Case RECORD-SEARCH-DISPLAY-CANCELLATION-001: 耗尽显示后仍响应后续文件取消

Tests:
- `test:19549d9deed5849136ef988cf941db72160b626eb4f1de1299fb9d82f0c2107d`

Tags:
- `record-search`

Contract:
- 显示预算耗尽不能使后续已发生的取消被忽略。

Proves:
- 外层确认 a.md/b.md 按序被 validator 观察，a 的命中已耗尽一个字符预算；b 的 validator 触发 abort 后返回精确 aborted。
