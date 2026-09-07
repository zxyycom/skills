### Case DECISION-TAG-SOURCE-DRIFT-001: Check 检测标签来源漂移并由同步接受

Tests:
- `test:93673e9b065aee8550613ab636cdf942c7bdf87724536b9a657996d05070932e`

Tags:
- `decision-records`

Contract:
- 标签来源漂移使 strict check 失败；sync-index 重建后接受当前来源。

Proves:
- 添加 tag 后 check 非零，随后同步索引成功。
