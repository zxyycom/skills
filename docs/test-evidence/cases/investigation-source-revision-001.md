### Case INVESTIGATION-SOURCE-REVISION-001: source revisions fingerprint report Markdown

Tests:
- `test:587ee52fdef52546aa190814c662fc9adc401dbdca1a44778cf53e5a2ea674ae`

Tags:
- `investigation-report`

Contract:
- source revision 指纹化报告来源身份、sourcePath 与规范化 Markdown。

Proves:
- 纯 revision 函数对 Markdown 字节内容或 sourcePath 变化产生不同值，对 LF 与 CRLF 等价文本产生相同值。
