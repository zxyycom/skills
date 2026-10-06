### Case NOVEL-CARDS-BATCH-ROLLBACK-025: 批量失败恢复

Tests:
- `test:20329274331f618d98b10afd63e117ed2acd46d52d4d98b8f1e0d18d32a448dc`

Tags:
- `novel-cards`

Contract:
- 跨文件发布失败必须恢复旧卡和旧索引，不遗留部分成功记录或快照。

Proves:
- 真实前两次原子文件发布后第三次注入文件系统失败；旧索引字节、三个原记录和人物v1恢复，journal清理。
