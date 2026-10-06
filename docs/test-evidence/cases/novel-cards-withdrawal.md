### Case NOVEL-CARDS-WITHDRAWAL-023: 变迁撤回

Tests:
- `test:99eb0fb3f940f4cf668692ea935977c99a454aa1a359bf5de930f4e08016a224`

Tags:
- `novel-cards`

Contract:
- withdrawn当前记录不产生默认历史关系；撤回记录不自动回滚对象内容。

Proves:
- 撤回到同IDv2后history关联为空，v1active记录可回溯，当前对象仍保持已应用版本。
