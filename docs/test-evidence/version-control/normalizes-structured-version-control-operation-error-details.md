### Case VERSION-CONTROL-ERROR-DETAIL-001: 规范化并净化结构化版本控制操作错误详情

Entry:
- `tools/shared/tests/version-control.test.ts > normalizes and redacts structured version-control operation error details`
- `bun test --test-name-pattern="^normalizes and redacts structured version-control operation error details$" ./tools/shared/tests/version-control.test.ts`

Contract:
- 版本控制边界必须把底层操作详情规范化为有界、单行、可行动且不泄露凭据或绝对路径的文本；结构化未知值不能退化为默认的 `[object Object]`。

Proves:
- 缺失详情返回空值，带多余空白的字符串被规范化，结构化对象保留字段和值的可读表示。
- token、带凭据 URL、`Authorization: Bearer/Basic` 形式的凭据，以及包含空格的绝对路径都被完整替换为受控占位符，且不保留换行。
- 超长详情在净化后仍受长度上限约束，输出中不包含原始凭据片段。
