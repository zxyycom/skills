# 共同记录操作维护

Decision Records 与 Investigation Report 的共同业务实现位于 [Record CLI](../record-cli/README.md)，不再分发领域 TypeScript SDK 或本目录的业务运行时。普通维护从各自 skill 进入；跨域的责任、顺序运行与失败边界见[共同操作模型](model.md)，精确机器结果和事务事实见[原生协议](../record-cli/protocol.md)。

两域格式源在 `tools/record-contracts/schemas/`；领域解析、身份、关系、生命周期和资源规则分别归各域。共享能力仅在仍有实际消费者时保留，不因两域业务迁移而扩大或改变其他工具契约。

## 同阶段证据与后续复核

记录工具的正式模型不承诺跨阶段 fresh 或独立写后验收；完整读取和检查的范围见各域 skill 与[原生协议](../record-cli/protocol.md)。其他工具的 Index Runtime 契约不由此改变。
