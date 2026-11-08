### Case DR-LOCAL-HISTORY-BASELINE-001: 历史门禁区分仓库、unborn 与缺失索引

Tests:
- `test:cb4a17035d1603e843cbb04854b86b91cee58e70f1b4816a343a2db5ad778388`

Tags:
- `decision-records`

Contract:
- 历史门禁依据 Git HEAD 的合法索引定位必要已记录身份；已有来源缺少历史索引不可当空。

Proves:
- 真实 Git 中非仓库、unborn HEAD 与已提交来源但缺索引分别得到不适用、未记录和明确缺索引错误；提交索引后已记录身份可定位。
