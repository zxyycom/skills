### Case AGENT-MEMORY-INTENT-001: 取消待复核意图并保留原证据

Tests:
- `test:239cb4556dd838ab70ebe323c26b05ba70070e7a6bcb80acb4c19553af088de1`

Tags:
- `agent-memory`

Contract:
- 待复核的意图仍可取消；结项只结束意图和保存理由，不改写正文或证据引用。

Proves:
- 夹带正文改写的取消请求失败；合法取消不再召回意图，显式历史保留原正文、证据引用与结项理由，原证据单元仍可独立读取。
