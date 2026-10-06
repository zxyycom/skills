### Case NOVEL-CARDS-DUPLICATE-ID-002: 重复身份保护索引

Tests:
- `test:455e18d1cdfe76a0efe0d51e6ddc97ea57b0053d13316433dee6e63f58f70283`

Tags:
- `novel-cards`

Contract:
- ID由卡片frontmatter定义且全项目唯一；无效集合不能替换派生索引。

Proves:
- 重复ID被定位拒绝，CLI退出1且旧索引字节保持不变。
