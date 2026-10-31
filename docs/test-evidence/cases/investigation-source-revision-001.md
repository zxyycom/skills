### Case INVESTIGATION-SOURCE-REVISION-001: source revisions fingerprint report Markdown

Tests:
- `test:7f70d3c93e758d2f9f04276344a4ac829e23c8b7ef3a3c088ac05f9ff4dce2d8`

Tags:
- `investigation-report`

Contract:
- source revision 指纹化报告来源身份、sourcePath 与规范化 Markdown。

Proves:
- 纯 revision 函数对 Markdown 字节内容或 sourcePath 变化产生不同值，对 LF 与 CRLF 等价文本产生相同值。
