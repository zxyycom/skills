### Case DECISION-UNRECORDED-EVOLUTION-001: 尚未进入 Git HEAD 的决策演进等待显式确认

Tests:
- `test:7a677936f17f01e603c6e8ef7d48f462e99d83af9790396349ab47d0999a9606`

Tags:
- `decision-records`

Contract:
- `activate` 以关系连接候选与尚未进入 Git HEAD 的已建立直接前序时，首次调用必须暂停且不写入；提示标明前序和关系类型，显式确认保留独立决策演进后才能继续。

Proves:
- 首次带 `修订` 关系的 `activate` 返回包含前序与关系类型的确认提示，并逐字节保留候选、前序和索引。
- 带 `--keep-unrecorded-history` 的重试归档中间决策，并建立后继到该决策的直接关系。
