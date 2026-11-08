### Case INVESTIGATION-STAGE-LITERAL-RESOURCE-MEMBER-001: 完整资源树保留普通未引用文件名

Tests:
- `test:ea0eabe85fd39b11c9b53b83ceec8027faf220675694bdaceee5ea66749e892d`

Tags:
- `investigation-report`

Contract:
- 所选 owner 树中未引用的安全普通文件名可包含空格，并可暂存新增与删除。

Proves:
- 真实 Git 在 all 和 domain scope 分别暂存 `new extra.txt` 的工作区字节；删除该文件并重选后，pending 不再包含该路径。
