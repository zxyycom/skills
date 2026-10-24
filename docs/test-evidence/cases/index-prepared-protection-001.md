### Case INDEX-PREPARED-PROTECTION-001: 选择同步保留全集与 fresh 门槛

Tests:
- `test:9dc0d92b0411368fdf9f74ded222f8fde2546a77a69e46fe15958f6377d60c01`

Tags:
- `index-runtime`

Contract:
- 同阶段复用不能减少 selected 的完整来源、metadata/revision、未选变化及最终 fresh 义务。

Proves:
- metadata/revision、未选来源与最终 revision 漂移仍零写入失败；仅选一条不缩小来源验收。
