### Case RELATION-GRAPH-DEEP-DFS-001: 深链结构验证与确定性DFS输出

Tests:
- `test:0624f989b507228941bb397addef32333d31d51792bf8ebe35e67ec108c5c0da`
- `test:e77546d756ee13fee29ad9a2d3fe152613333858a045f565fdee00659b525793`
- `test:ef4707dd6c73170b11410758650e784e695e729825123ddca8a3d87f8e3351af`

Tags:
- `graph`

Contract:
- 结构验证不以运行时递归深度限制合法图，保持节点/target顺序、循环路径及缺陷分类。

Proves:
- 实际Node进程接受12000节点合法链；相同规模晚期环报告完整闭合路径。
- 分支、菱形、断开子图及孤立节点保留DFS循环顺序，重复边不重复产出循环，自边与缺失target保持独立问题顺序。
