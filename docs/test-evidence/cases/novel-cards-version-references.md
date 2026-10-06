### Case NOVEL-CARDS-VERSION-REFERENCES-027: 版本身份与端点校验

Tests:
- `test:337a54f41c5c132692194e2a1684ed9fe61e476b4080c862f91d7813a47a2551`

Tags:
- `novel-cards`

Contract:
- 版本身份全项目唯一；历史端点锁版本、同对象且严格递增，正文card引用支持锁版本。

Proves:
- 重复快照、未锁版本、跨对象端点与逆序版本分别失败；card:hero@1被机械提取并可精确读取旧卡。
