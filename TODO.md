# WEPsCodingCLI TODO

## 当前目标

在 `D:\WEPsCodingCLI\agents-core\packages\wepscli` 上，继续把已经稳定的 TUI 外壳，逐步对接到真实 agent/runtime，并补齐 coding agent 必需能力。

当前阶段不再重复折腾壳层基础布局，重点转到：

- agent 事件流接入
- tool 执行呈现
- 审批与权限交互
- 会话持久化
- slash commands 实功能化
- 右侧状态与上下文信息
- diff / 文件改动呈现

## 绝对路径提示

- 主 TUI 包:
  `D:\WEPsCodingCLI\agents-core\packages\wepscli`
- 当前 TUI 主界面:
  `D:\WEPsCodingCLI\agents-core\packages\wepscli\src\WEPSCLI-shell`
- 共享 coding agent runtime:
  `D:\WEPsCodingCLI\agents-core\packages\coding-agent`
- 共享 agent core:
  `D:\WEPsCodingCLI\agents-core\packages\agent`
- 共享 AI provider / model 层:
  `D:\WEPsCodingCLI\agents-core\packages\ai`
- TUI 重点参考项目:
  `D:\WEPsCodingCLI\CLI\tui-learning\opencode`

## 开发约束

- 单个源码文件不得超过 800 行。
- 如果某个文件接近 800 行，必须先拆分，再继续堆功能。
- 优先复用 `agents-core` 现有 runtime、session、tool、provider 能力，不重新造轮子。
- 优先参考 `opencode` 的 OpenTUI/Solid 设计和交互方式，而不是重新发明一套自己的模式。
- 新增交互前，先看参考实现，再决定最小改法。
- 用户可见路径、状态、上下文，尽量使用明确的绝对路径或清晰来源说明，避免模糊。
- 新能力优先做“能真实工作”的最小闭环，不先做大而空的 UI。
- 真正接入 runtime 后，任何会产生副作用的能力，都要优先考虑中断、错误恢复、权限确认。
- 先保证稳定，再做高级功能。
- 每做完一个阶段，都要能通过:
  - `node ./scripts/build.mjs`
  - `npx tsc -p tsconfig.build.json --noEmit`

## 实现原则

- 主对话优先，工具输出和 thinking 输出降级呈现。
- 鼠标和键盘路径都要可用，不能只做其中一条。
- 优先做能支持日常使用的闭环，不先追求“全功能”。
- 不为了“看起来高级”引入额外复杂状态。
- 如果一个功能已经在共享层存在，TUI 负责呈现和编排，不复制业务逻辑。

## 已完成

### 基础壳层

- [x] OpenTUI / Solid 主 shell 基础布局
- [x] conversation 区、composer、overlay、approval overlay 基础交互
- [x] slash command 基础交互
- [x] conversation 自动滚动到底部

### Runtime 接入

- [x] 真实 `AgentSession.prompt()` 接入
- [x] assistant 流式文本接入 transcript
- [x] thinking / tool 输出接入 transcript
- [x] tool approval 基础链路接入
- [x] runtime 状态回传到 TUI

### Provider / Model 配置交互

- [x] provider picker
- [x] `/provider add` 引导式创建流程
- [x] 多 provider 下两层 model picker
- [x] provider/model 切换同步到当前 runtime session

### 会话持久化

- [x] shell session 与真实 runtime session file 绑定
- [x] 重启后恢复真实会话
- [x] 切换 session 时恢复对应 transcript
- [x] `P4` 会话持久化完成并实测通过

### 质量与结构

- [x] `TODO.md` 规范化
- [ ] `shell-app.tsx` 压回 800 行以内（暂缓：本轮不继续在其上加料）
- [ ] `agent-runtime.ts` 压回 800 行以内（暂缓：本轮不继续在其上加料）
- [x] `node ./scripts/build.mjs` 可通过
- [x] `npx tsc -p tsconfig.build.json --noEmit` 可通过

## 后续优先级与状态

### P1 工具执行主链路

状态: 当前阶段已完成

- [x] 完整接入 `tool_execution_start / update / end`
- [x] 工具卡片基础呈现
- [x] tool / thought 降级呈现，避免淹没主对话
- [x] 文件改动摘要更清楚
- [x] diff 呈现
- [x] tool 详情层继续打磨
- [x] tool 完成后的结果归纳

验收标准:

- 用户发一个会触发真实工具调用的请求
- TUI 能稳定显示工具开始、进行中、结束
- 成功和失败状态都清晰
- 详情可查看
- 文件改动可读

### P2 审批 / 权限交互

状态: 当前阶段已完成

- [x] 高风险工具的 approval 主链路
- [x] 基础批准 / 拒绝 / 取消交互
- [x] 不同工具类型的更细粒度提示
- [x] approval 详情文案优化
- [x] 与 diff / 文件改动联动

### P3 中断 / 重试 / 错误恢复

状态: 当前阶段已完成

- [x] 当前请求中断
- [x] retry / overflow / compaction / provider error 基础状态提示
- [x] 中断后的更多 UI 收尾
- [x] 错误后的下一步操作提示
- [x] provider 故障恢复路径优化

### P4 会话持久化

状态: 已完成

- [x] 真实 `AgentSession` 与 shell session 绑定
- [x] 重启恢复
- [x] transcript 回灌
- [x] 多 session 切换恢复

### P5 Slash Commands 实功能化

状态: 部分完成

- [x] `/provider add`
- [x] `/models` 打开两层 picker
- [x] `/review`
- [x] `/debug`
- [x] `/sessions`
- [x] `/compact`
- [x] `/help` `/status` `/clear` `/resume`
- [x] 其他高频命令（已补 `/retry`、`/provider`、`/model`、`/session`）


### P6 右侧状态 / 上下文面板（不做或最低优先级）

状态: 待做

- [ ] 展示当前模型、provider、token/context 使用
- [ ] 展示 pending tools、最近错误、当前运行状态
- [ ] 与主对话保持层级分明

### P7 diff / 文件改动呈现

状态: 已完成当前最小闭环

- [x] 展示文件改动摘要
- [x] 查看 diff
- [x] 与 tool 结果形成闭环

### P8 多会话一致性

状态: 部分完成

- [x] session 切换时恢复 runtime 会话
- [x] provider / model 随 session 对齐
- [ ] detail / overlay / scroll 临时状态继续清理
- [ ] 避免 session 之间串 runtime 瞬时状态

### P9 模式层

状态: 已完成当前最小闭环

- [x] 计划模式
- [x] 只读模式
- [x] 自动批准模式的用户可见包装
- [x] composer 右侧模式可视化
- [x] slash commands 与快捷键切换

### P10 高级扩展

状态: 待做

- [x] skills
  - [x] P10.1 skill 安装与存储
  - [x] 在 `wepscli` 的 agent dir 下建立并使用 `skills/` 目录（即 `~/.wepscli/agent/skills`）
  - [x] 支持从用户输入路径导入 skill（skill 根目录或 `SKILL.md` 所在目录）
  - [x] 复制整个 skill 目录到 `wepscli` skills 目录，保留脚本与资源文件
  - [x] 导入前复用 `coding-agent` 的 skill 校验/加载规则做校验
  - [x] skill 名称冲突时先拒绝覆盖并给出明确提示
  - [x] P10.2 skill 调用与 reload
  - [x] `wepscli` 本地 slash command 不再拦截 `/skill:name`，改为透传给 runtime session
  - [x] skill 导入后支持对当前 session 执行 reload，使新 skill 立即可用
  - [x] P10.3 skills 可见性与管理
  - [x] `/skills` 展示当前已安装 skills 与 diagnostics
  - [x] `/skill add` 进入导入流程
  - [x] `/skills reload` 触发当前 session 资源重载
- [ ] MCP
- [ ] 图片
- [ ] 拖拽
- [ ] clipboard image
- [ ] 更完整的 provider 管理

### P11 本地窗口式应用

 状态：待做
 
 - [ ]基于.agents-core\packages\web-ui 构建electron应用

## 当前下一步

当前回到 `P5 Slash Commands 实功能化`，优先补:

- 其他高频命令（如确有需要再补）
- 现有 slash commands 的执行反馈与结果回显收口
- 保持键盘 / 鼠标路径一致

## 执行顺序

严格按优先级推进:

1. P1 工具执行主链路
2. P2 审批 / 权限交互
3. P3 中断 / 重试 / 错误恢复
4. P5 Slash Commands 实功能化
5. P6 右侧状态 / 上下文面板
6. P7 diff / 文件改动呈现
7. P8 多会话一致性补完
8. P9 模式层
9. P10 高级扩展

## 禁止事项

- 不要为了省事在 `wepscli` 里复制一份 `coding-agent` 核心逻辑。
- 不要绕过共享 runtime 自己拼一套 provider / tool / session 执行系统。
- 不要继续把大块 UI 逻辑都堆回 `shell-app.tsx`。
- 不要在没有参考项目对照的情况下，凭感觉发明复杂 TUI 交互。
- 不要在高风险功能缺少中断和错误恢复前，继续向更深层能力扩张。
