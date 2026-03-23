# TODO2

## 目的

本文件用于追踪在 `P11` 阶段基本结束后，由参考资料驱动的开发工作。

此阶段的目标**绝非**“不惜一切代价让 `WEPSCLI` 变得更庞大”。我们的目标是：

- 稳定当前的 Shell（命令行外壳）
- 整合交互模型
- 研究优秀的同类开源产品
- 避免从零开始重新发明那些已经被解决的问题模式
- 刻意为未来的 Electron 应用做准备，而不是日后临时拼凑

## 参考资料位置

- KiloCode 原始克隆版：
  `D:\WEPsCodingCLI\CLI\tui-learning\kilocode`
- 精选的 KiloCode 参考子集：
  `D:\WEPsCodingCLI\CLI\tui-learning\kilocode-ref`
- KiloCode 提交哈希：
  `a2ae35e1e34d3ca4f33807f876fe4f64f8a5c2ee`

## 为什么 Kilo 很重要

对于当前处于稳定阶段的 `WEPSCLI` Shell 细节而言，KiloCode 并不是最佳的参考对象。
但在稳定阶段**之后**，它是一个强有力的参考：

- 从“终端优先”的工具演变为更广泛的产品平台
- 在不同界面间共享 UI 和应用逻辑
- 分离 CLI、App、桌面端、Electron、SDK 以及共享 UI 包
- 打包桌面端行为，而不必将所有逻辑强行塞入一个 Shell 入口点

## 保留的 Kilo 子集

精选的参考子集仅保留了 `WEPSCLI` 最有用的部分：

- `packages/opencode`
  参考 CLI/TUI Shell 的演进以及源自 OpenCode 的终端产品模式。
- `packages/app`
  参考 App-Shell 结构、路由视图以及非终端产品界面。
- `packages/desktop-electron`
  参考未来 Electron 应用的方向。
- `packages/ui`
  参考跨产品界面的共享 UI 原语。
- `packages/kilo-ui`
  参考基于共享 UI 构建的产品层组件。
- `packages/sdk`
  参考 API/客户端边界以及共享契约。
- `packages/util`
  参考可复用的工具层架构。
- `packages/plugin`
  参考扩展/插件契约。
- `packages/kilo-i18n`
  参考产品化界面如何分离翻译文件和 UI 文案。


## 阶段顺序

### 阶段 A - 完成稳定化

- [ ] 在复制 Kilo 的产品层思路之前，先填补剩余的 `P11` 缺口。
- [ ] 让 `WEPSCLI` 首先专注于终端的正确性：运行时、会话、斜杠命令流、设置、Composer 行为。
- [ ] 不要过早地将桌面端/Web 架构复制到当前的 Shell 中。

### 阶段 B - 优化 / 整合

- [ ] 研究 `kilocode-ref/packages/opencode`，寻找 `P11` 之后值得采用的 Shell 模式。
- [ ] 研究 `kilocode-ref/packages/ui` 和 `kilocode-ref/packages/kilo-ui`，了解可复用组件的边界。
- [ ] 提取以下模式：
  - Composer 和 Dock 结构
  - 会话导航和上下文面板
  - 跨多个界面的共享视觉语言
  - 路由和视图/状态拆解
- [ ] 在实施之前，将每个采用的模式记录为“借用”、“改编”或“拒绝”。

### 阶段 C - Electron 准备

- [ ] 研究 `kilocode-ref/packages/desktop-electron` 作为主要的结构参考。
- [ ] 尽早决定未来的 Electron 应用是：
  - 围绕共享 App 包的薄壳
  - 还是定制的 Electron 优先实现
- [ ] 尽可能复用 Shell/App 逻辑，而不是创建并行的产品代码路径。
- [ ] 定义以下内容的边界：
  - Agent 运行时
  - 渲染器 UI
  - Electron 主进程
  - 持久化 / 设置 / 更新机制

## 具体阅读队列

### 先看 Kilo

- [ ] `kilocode-ref/packages/opencode`
  目标：识别 `P11` 之后仍然有用的 Shell/产品模式。
- [ ] `kilocode-ref/packages/app`
  目标：理解他们如何将应用级状态与纯终端逻辑分离。
- [ ] `kilocode-ref/packages/desktop-electron`
  目标：梳理未来的 Electron 打包方式以及主进程/渲染进程的职责。
- [ ] `kilocode-ref/packages/ui`
  目标：检查原语/组件分层。
- [ ] `kilocode-ref/packages/kilo-ui`
  目标：检查基于共享基础构建的产品特定组件。

### 仍需保留在旁

- [ ] `D:\WEPsCodingCLI\CLI\tui-learning\opencode`
  继续将其作为最直接的 TUI 体验参考。

## 规则

- [ ] 不要仅仅因为 Kilo 有某个功能就添加它。
- [ ] 只有在确定了某个模式能解决 `WEPSCLI` 的具体问题后，才进行复制。
- [ ] 对于每个借用的主要想法，写下：
  - 源项目
  - 源路径
  - 复制原因
  - 需要简化的内容
- [ ] 保持 `WEPSCLI` 与 `agents-core` 的一致性；不要把它变成每个参考项目的随机混合体。

## 本文件的交付物

当此阶段正式开始时，请扩展本文件，添加以下内容：

- “已采用的模式”部分
- “已拒绝的模式”部分
- “Electron 架构草案”部分
- 从 Kilo 模块到本地 `WEPSCLI` 模块的映射

## agents-core 当前锚点

在参考 Kilo 之前，先明确本地 `agents-core` 已经存在的分层：

- `agents-core/packages/wepscli`
  当前产品壳。已包含 onboarding、provider profile、session history、skills、OpenTUI Shell、审批覆盖层、运行时桥接，以及失败时的 workbench fallback。
- `agents-core/packages/coding-agent`
  当前最重要的共享运行时依赖。`WEPSCLI` 不是自己重新实现 agent loop，而是通过 `createAgentSession`、`ModelRegistry`、`SessionManager`、`AuthStorage` 复用已有能力。
- `agents-core/packages/agent`
  更底层的 agent loop、事件流与工具调用状态管理。
- `agents-core/packages/ai`
  模型、provider、流式输出与认证侧的统一抽象。
- `agents-core/packages/tui`
  终端组件和差量渲染基础设施；它是基础 UI 原语层，不应该承载产品状态。
- `agents-core/packages/web-ui`
  当前仓库里最接近“Kilo App/UI 分层”思路的浏览器端参考，但它还不是 `WEPSCLI` 的正式 App-Shell。

这意味着：`WEPSCLI` 现阶段最合理的路线不是把 Kilo 的包结构整体搬过来，而是围绕现有 `agents-core` 分层继续抽取边界。

## 已采用的模式（初稿）

### 1. 共享运行时 + 薄 Shell

- 判定：借用 / 改编
- 源项目：KiloCode
- 源路径：`packages/opencode`、`packages/app`、`packages/desktop-electron`
- 本地落点：`agents-core/packages/wepscli`、`agents-core/packages/coding-agent`、`agents-core/packages/agent`、`agents-core/packages/ai`
- 采用原因：Kilo 的价值不在某个具体界面，而在“运行时与界面解耦”的方向；本地 `WepsAgentRuntime` 已经通过 `pi-coding-agent` 复用会话与模型能力。
- 需要简化：当前只保留 TUI Shell 到共享运行时的桥接，不额外引入 Web/Electron 产品壳。

### 2. Provider / Model 配置与聊天会话分离

- 判定：借用
- 源项目：KiloCode
- 源路径：`packages/opencode/src/provider`、`packages/app/src/context`
- 本地落点：`agents-core/packages/wepscli/src/provider-profiles`、`agents-core/packages/wepscli/src/session-history`
- 采用原因：当前本地已经把 provider profile、API key、active selection、session metadata 拆成独立服务，而不是混进单一 Shell 状态对象里。
- 需要简化：继续保持 JSON 文件存储，不为此提前引入桌面端数据库或跨端同步层。

### 3. Transcript / Composer / Approval 分区

- 判定：借用 / 改编
- 源项目：KiloCode
- 源路径：`packages/app/src/pages/session/composer`、`packages/kilo-ui`
- 本地落点：`agents-core/packages/wepscli/src/WEPSCLI-shell/transcript-panel.tsx`、`shell-prompt-controller.ts`、`approval-overlay.tsx`、`tool-approval.ts`
- 采用原因：Kilo 的 Composer 和 Dock 结构对“输入区、消息区、审批区分离”很有价值；本地也已经形成 transcript、composer、approval overlay 的独立职责。
- 需要简化：先保持 TUI 里的轻量 overlay，不提前复制完整 Dock 体系。

### 4. 会话元数据与运行时会话绑定分离

- 判定：改编
- 源项目：KiloCode
- 源路径：`packages/opencode/src/session`、`packages/app/src/pages/session`
- 本地落点：`agents-core/packages/wepscli/src/session-history/session-history-service.ts`、`agents-core/packages/wepscli/src/WEPSCLI-shell/agent-runtime.ts`
- 采用原因：本地已经把可展示的 Shell session record 与底层 `runtimeSessionFile` 绑定关系拆开，这有利于未来切换 UI 载体时保持会话一致性。
- 需要简化：暂时不做复杂的多视图、多工作区、多 tab 同步。

### 5. 产品包建立在基础 UI 包之上，而不是反过来

- 判定：借用
- 源项目：KiloCode
- 源路径：`packages/ui`、`packages/kilo-ui`
- 本地落点：`agents-core/packages/tui`、`agents-core/packages/web-ui`、`agents-core/packages/wepscli`
- 采用原因：Kilo 明确区分基础 UI 原语与产品组件；本地也应保持 `pi-tui` 只做基础终端组件，产品交互留在 `wepscli`。
- 需要简化：当前不新增独立的 `weps-ui` 包，先在 `wepscli` 内部稳定产品组件边界。

## 已拒绝或暂缓的模式（初稿）

### 1. 将 Kilo 的 App 路由层直接移植进当前 Shell

- 判定：拒绝
- 源项目：KiloCode
- 源路径：`packages/app/src/pages/layout`、`packages/app/src/pages/session`
- 拒绝原因：当前 `WEPSCLI` 还处于 Shell 稳定化和交互整合阶段；直接引入页面路由、侧边栏、文件标签、多视图状态，只会把当前 TUI 复杂度提前拉高。

### 2. 提前建立 Electron 专属业务逻辑

- 判定：拒绝
- 源项目：KiloCode
- 源路径：`packages/desktop-electron/src/main`、`src/preload`、`src/renderer`
- 拒绝原因：Electron 应该是后续包装层，而不是新的业务主线；在共享 App 层还未抽出前，不应创建并行的 Electron-first 代码路径。

### 3. 提前复制大体量的产品组件库

- 判定：暂缓
- 源项目：KiloCode
- 源路径：`packages/kilo-ui`
- 暂缓原因：`kilo-ui` 展示的是成熟产品层组件集合，但本地很多交互还在变化；现在复制只会冻结错误边界。

### 4. 提前为国际化建立完整包边界

- 判定：暂缓
- 源项目：KiloCode
- 源路径：`packages/kilo-i18n`
- 暂缓原因：当前 `WEPSCLI` 的 Shell 文案和命令行为仍在演进。文案还没稳定之前，不值得抽出完整 i18n 包。

### 5. 把 `WEPSCLI` 变成多个前端各自持有业务逻辑的拼装体

- 判定：拒绝
- 源项目：KiloCode（反向约束）
- 源路径：整个包结构
- 拒绝原因：我们要学习的是边界，而不是复制包数量。未来即使有 TUI、Web、Electron，也必须共享运行时与核心状态模型。

## Electron 架构草案（初稿）

默认方向：优先采用“围绕共享 App 包的薄壳”，而不是 Electron 优先实现。

原因：

- `kilocode-ref/packages/desktop-electron` 的依赖关系本身就是这个方向：桌面壳依赖共享 `app` 和 `ui`，而不是把业务塞进主进程。
- 本地 `agents-core` 已经有共享运行时层：`packages/agent`、`packages/ai`、`packages/coding-agent`。
- 当前缺的不是另一个前端，而是一个可以被 TUI 与 Electron 共同消费的 `WEPS` 产品层状态边界。

建议的本地分层：

### 第 1 层：共享运行时

- 包：`agents-core/packages/agent`、`agents-core/packages/ai`、`agents-core/packages/coding-agent`
- 职责：模型访问、agent loop、工具调用、会话文件、认证存储、扩展/技能能力
- 约束：不感知 TUI、Web、Electron 细节

### 第 2 层：WEPS 领域服务

- 现有来源：`agents-core/packages/wepscli/src/provider-profiles`、`session-history`、`storage`、`skills`、`WEPSCLI-shell/agent-runtime.ts`
- 未来动作：把 UI 无关逻辑逐步抽到一个共享包中，例如未来的 `packages/weps-core` 或 `packages/weps-app-core`
- 职责：provider profile、active selection、session metadata、runtime binding、审批策略、持久化约定

### 第 3 层：前端壳

- TUI：继续由 `agents-core/packages/wepscli` 承载
- Web/App：未来新建共享 App 包承载非终端视图状态与组件编排
- Electron：未来只保留 `main`、`preload`、`renderer entry`、窗口生命周期、菜单、自动更新、OS 集成

### Electron 主进程边界

- 只负责：窗口创建、菜单、日志、自动更新、文件系统/原生能力桥接、深链接、单实例控制
- 不负责：会话编排、provider 业务逻辑、聊天状态机、审批决策本身

### Electron 渲染器边界

- 负责：会话列表、transcript、composer、approval UI、settings UI
- 复用目标：尽量消费未来共享 App 层，而不是重新实现一份 Electron 专用界面逻辑

### 持久化边界

- 继续沿用当前 `WEPSCLI` 已存在的数据对象：
  - `providers.json`
  - `auth.json`
  - `sessions.json`
  - runtime session files
- 在进入 Electron 前，先把这些文件访问封装在服务层接口之后，而不是散落在不同 UI 入口中

### 进入阶段 C 之前的抽取顺序

1. 先稳定 `wepscli` 内部 transcript/composer/approval/session 行为。
2. 再把 UI 无关的 provider、session、runtime binding 逻辑从 `wepscli` 中抽成共享服务。
3. 然后再决定是否引入共享 App 包。
4. 最后才创建 Electron 壳。

## Kilo 模块到本地模块的映射（初稿）

| Kilo 模块 | Kilo 关注点 | 本地对应模块 | 当前结论 |
| --- | --- | --- | --- |
| `packages/opencode` | CLI/TUI Shell、provider、session、命令流 | `agents-core/packages/wepscli` + `agents-core/packages/coding-agent` + `agents-core/packages/tui` | 阶段 B 的主要参考来源 |
| `packages/app` | App-Shell、页面路由、session 页面、sidebar、composer dock | 当前无直接等价物；最近邻是 `agents-core/packages/web-ui`，未来建议抽共享 App 包 | 学结构，不直接复制 |
| `packages/desktop-electron` | 桌面壳、主进程、preload、renderer 入口、打包 | 当前无直接对应；未来建议新建薄壳桌面包 | 阶段 C 主要参考来源 |
| `packages/ui` | 跨产品共享 UI 原语 | `agents-core/packages/tui`（终端原语）+ `agents-core/packages/web-ui`（浏览器原语） | 借用“分层思想”，不直接搬组件 |
| `packages/kilo-ui` | 产品层组件、dock、message、review、状态组件 | `agents-core/packages/wepscli/src/WEPSCLI-shell` | 借用组件边界，不复制整套实现 |
| `packages/sdk/js` | API/客户端契约、client/server SDK | `agents-core/packages/agent` + `agents-core/packages/ai` + `agents-core/packages/coding-agent` | 本地已有更核心的运行时能力 |
| `packages/plugin` | 插件/扩展契约 | `agents-core/packages/coding-agent` 的扩展/技能能力 + `agents-core/packages/wepscli/src/skills` | 可继续对齐概念边界 |
| `packages/util` | 可复用工具函数 | 当前分散在各包内部工具文件 | 等边界稳定后再考虑抽公共 util |
| `packages/kilo-i18n` | 产品文案与翻译拆分 | 当前暂无等价包 | 暂缓，等文案稳定后再做 |

## 下一轮补全文档时应继续记录的内容

- 新增的模式必须落到“借用 / 改编 / 拒绝”三类之一。
- 每次记录模式时，必须同时写出本地落点，不接受只有参考源、没有本地承接模块的条目。
- 一旦开始抽共享 App 层，需要把它加入上面的映射表，并更新 Electron 草案。
