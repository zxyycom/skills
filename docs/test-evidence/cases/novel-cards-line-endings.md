### Case NOVEL-CARDS-LINE-ENDINGS-015: 换行规范化与返回正文

Tests:
- `test:bc61a0f9d7f9e843683f07521cf23034d83a13e590b2ebc477c712f055594ddf`

Tags:
- `novel-cards`

Contract:
- 来源指纹规范化CRLF为LF；读取结果仍保留实际Markdown全文。

Proves:
- 仅把卡片改成CRLF不会令索引陈旧；查询返回实际CRLF正文。
