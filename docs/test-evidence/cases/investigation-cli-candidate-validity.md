### Case INVESTIGATION-CLI-CANDIDATE-VALIDITY-001: 候选查询区分结构无效和机械未就绪

Tests:
- `test:145f7606271ac8c0ccc346eb6846380934b458664a9a05c77e51fc42fb002c42`

Tags:
- `investigation-report`

Contract:
- 显式候选查询区分结构非法与合法 scaffold 的正文或资源未就绪。

Proves:
- 真实 CLI 对 scaffold 合法、正文未就绪返回成功及相应 readiness；添加缺失资源引用后仍成功并报告 resourceReady=false；tags 非法时显式查询失败且 JSON ok=false。节点不证明列表 warning、publish preflight 或旧文本排版。
