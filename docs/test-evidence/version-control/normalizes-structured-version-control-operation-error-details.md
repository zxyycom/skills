### Case VERSION-CONTROL-ERROR-DETAIL-001: 规范化结构化版本控制操作错误详情

Entry:
- `tools/shared/tests/version-control.test.ts > normalizes structured version-control operation error details`
- `bun test --test-name-pattern="^normalizes structured version-control operation error details$" ./tools/shared/tests/version-control.test.ts`

Contract:
- 版本控制边界必须把底层操作详情规范化为有界、单行且可行动的文本；结构化未知值不能退化为默认的 `[object Object]`。

Proves:
- 缺失详情返回空值，带多余空白的字符串被规范化，结构化对象保留字段和值的可读表示。
