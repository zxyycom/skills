### Case INVESTIGATION-SOURCE-REVISION-001: source revisions fingerprint report Markdown

Tests:
- `test:587ee52fdef52546aa190814c662fc9adc401dbdca1a44778cf53e5a2ea674ae`

Tags:
- `investigation-report`

Contract:
- source revision 指纹化报告 ID、sourcePath 与 Markdown；任一来源变化后重新同步产生新 revision。

Proves:
- 改写报告 Markdown 后当前 index 变为过期；公共 synchronize 成功重建并更新 revision。
