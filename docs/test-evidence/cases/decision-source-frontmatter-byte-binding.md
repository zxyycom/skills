### Case DECISION-SOURCE-BYTE-BINDING-001: 同阶段扫描绑定原始字节与身份正文

Tests:
- `test:620b212d14f99325db40c77cc7203b2db4354e54a257d7fb3fceab10b0803c62`

Tags:
- `decision-records`

Contract:
- 成员发现与后续正式扫描使用同一次取得的 Markdown；BOM 与 CRLF 不改变领域身份和正文语义，来源文本仍保留原字节表述。

Proves:
- basename 与声明 ID 不同时以声明身份进入集合；带 BOM/CRLF 的合法候选保留精确来源字符串、规范化正文及 scaffold/body-ready 状态，来源对象的文本不能在解析后被赋值替换。
