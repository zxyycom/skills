### Case RELATION-GRAPH-DEEP-DFS-001: 深链结构验证与确定性DFS输出

Tests:
- `test:238c4b7ddde57133f7c3133e550957feeb27fe70cf93ce4e4774155a8c537297`
- `test:3dae8ba9c73b2ebbd37fee3e314aa0616fa6431f4f1453a7f270abfe506cdbde`
- `test:9c85e3f2e006f5eed44aea6723c0ff4dbd74cb760d8703c362d967454e926b2d`

Tags:
- `graph`

Contract:
- 结构验证不以运行时递归深度限制合法图，保持节点/target顺序、循环路径及缺陷分类。

Proves:
- 实际Node进程接受12000节点合法链；相同规模晚期环报告完整闭合路径。
- 分支、菱形、断开子图及孤立节点保留DFS循环顺序，重复边不重复产出循环，自边与缺失target保持独立问题顺序。
