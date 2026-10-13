<div align="center">

# Screeps World · TypeScript Bot

**从 RCL 1 到 RCL 8 的房间自动化**  
Room automation from RCL 1 to RCL 8

TypeScript · Vitest · Adaptive Population · Auto Construction · Base Defense

[简体中文](#简体中文) · [English](#english)

</div>

---

## 简体中文

适用于 **Screeps: World** 的 TypeScript 自动化脚本。放置第一个 spawn 后，脚本会管理已有己方房间的采矿、运输、建设、升级与基础防御，并根据能源、工程量和敌情调整 creep 数量及身体。

> 当前覆盖已有房间的基础发展。防御属于基础守家策略；自动扩张、远矿和完整工业供应链尚未实现。

### 快速开始

本地环境需要 **Node.js 24+** 和 npm。这个要求用于安装、测试和部署，不会改变游戏服务器的运行环境；游戏代码构建目标为 ES2020。

```bash
npm ci
npm run check
```

首次部署时，复制配置文件：

```bash
cp .env.sample .env
```

填写 `.env`：

```dotenv
SCREEPS_TOKEN=YOUR_ACCESS_TOKEN
SCREEPS_BRANCH=default
```

已有 `.env` 时保留原文件。请勿把真实 token 或 `.env` 提交到 GitHub。

```bash
npm run deploy
```

`deploy` 会重新构建并上传到指定 branch。也可以将 `dist/main.js` 的内容粘贴到游戏的 `main` 模块。

### 常用命令

| 命令                   | 用途                                 |
| ---------------------- | ------------------------------------ |
| `npm ci`               | 按 lock 文件重新安装依赖             |
| `npm run check`        | 依次进行类型检查、测试和构建，不上传 |
| `npm test`             | 运行 Vitest 测试                     |
| `npm run test:watch`   | 监听并重新运行测试                   |
| `npm run typecheck`    | 检查源码及测试的 TypeScript 类型     |
| `npm run format`       | 使用 Prettier 格式化整个项目         |
| `npm run format:check` | 只检查格式，不修改文件               |
| `npm run build`        | 构建 `dist/main.js`                  |
| `npm run deploy`       | 构建并上传游戏代码                   |
| `npm run watch`        | 监听源码变化，自动构建并上传         |

### 常用 Console 指令

下面的 JavaScript 在 **游戏 Console** 中运行；`npm` 命令在本地项目目录终端运行。示例使用 `W22S17`，其他房间请替换名称。先部署并运行一个 tick，让房间 Memory 初始化。

**查看房间目标人数、能源与敌情：**

```js
JSON.stringify(Memory.rooms['W22S17'].stats);
```

**统计实际 creep 人数（包含正在生成的单位）：**

```js
JSON.stringify(
  Object.values(Game.creeps)
    .filter((c) => (c.memory.home ?? c.room.name) === 'W22S17')
    .reduce((counts, c) => {
      counts[c.memory.role] = (counts[c.memory.role] || 0) + 1;
      return counts;
    }, {}),
);
```

**查看容器能源与位置：**

```js
JSON.stringify(
  Game.rooms['W22S17']
    .find(FIND_STRUCTURES)
    .filter((s) => s.structureType === STRUCTURE_CONTAINER)
    .map((s) => ({
      x: s.pos.x,
      y: s.pos.y,
      energy: s.store[RESOURCE_ENERGY],
      nearController: s.pos.inRangeTo(Game.rooms['W22S17'].controller, 3),
    })),
);
```

**查看能源积压模式、生产状态与 safe mode：**

```js
JSON.stringify(Memory.rooms['W22S17'].energyOverflow);
JSON.stringify(
  Game.rooms['W22S17'].find(FIND_MY_SPAWNS).map((s) => ({ name: s.name, spawning: s.spawning })),
);
JSON.stringify({
  active: Game.rooms['W22S17'].controller.safeMode,
  available: Game.rooms['W22S17'].controller.safeModeAvailable,
  cooldown: Game.rooms['W22S17'].controller.safeModeCooldown,
});
```

**开启或关闭自动建设，保留其他房间设置：**

```js
Memory.rooms['W22S17'].settings ??= {};
Memory.rooms['W22S17'].settings.autoBuild = false;
// 恢复时执行：
Memory.rooms['W22S17'].settings.autoBuild = true;
```

**开启或关闭 pixel，查看 CPU 与任务估计：**

```js
Memory.cpuPolicy ??= {};
Memory.cpuPolicy.generatePixel = true;
// 停止生成时执行：
Memory.cpuPolicy.generatePixel = false;

JSON.stringify(Memory.cpuStats);
JSON.stringify(Memory.cpuTaskCosts);
```

开关语句按需分别执行，不要把开启、关闭一起粘贴。`stats.targets` 是目标人数；实际数量可能因自然替换或生成中而不同。

### 代码格式化

项目已包含 Prettier、本地配置与格式检查命令；安装依赖后运行：

```bash
npm run format
npm run format:check
npm run check
```

`format` 会修改文件格式；`format:check` 只检查。输出目录、依赖目录和 lock 文件不会被格式化。VS Code 的 Prettier 插件会读取 `.prettierrc.json`；命令行使用项目中固定版本的 Prettier。

### 自动化能力

| 模块     | 行为                                                           |
| -------- | -------------------------------------------------------------- |
| 人口管理 | 根据矿点产量、运输距离、实际 WORK/CARRY、工程量与敌情调整需求  |
| 身体生成 | 按能源预算生成身体，最多 50 parts；寿命不足时提前补位          |
| 生产恢复 | 经济链断档时优先生产小 worker，最低 200 energy 起步            |
| 多 spawn | 同房间共享生产队列与能源预算                                   |
| 自动建设 | 随 RCL 解锁放置工地，由 worker 施工，保留已有建筑              |
| 基础防御 | towers 攻击、治疗与维修；远程守卫；关键建筑附近触发 safe mode  |
| 设施调度 | links 传输、terminal 补给；可配置 labs、factory 和 power 处理  |
| 多房运行 | 管理已有己方房间；清理死亡 creep Memory，隔离房间与 creep 错误 |

### RCL 1–8 发展路线

下表是各阶段的主要变化，实际施工受能源、地形和工地数量限制。

| 等级  | 主要发展                                                                                                |
| ----- | ------------------------------------------------------------------------------------------------------- |
| RCL 1 | worker 挖矿、建设与升级，规划能源容器                                                                   |
| RCL 2 | extensions、控制器容器、道路及关键建筑 rampart                                                          |
| RCL 3 | towers；容器建成后逐步转向专职采矿与运输                                                                |
| RCL 4 | storage；按储备和盈余调整建设与升级投入                                                                 |
| RCL 5 | storage、能源矿与控制器附近的 links                                                                     |
| RCL 6 | terminal、extractor、矿物容器、矿物采集与 labs                                                          |
| RCL 7 | 第二个 spawn、factory                                                                                   |
| RCL 8 | 第三个 spawn、6 towers、60 extensions、10 labs、observer、power spawn、nuker；upgrader 身体最多 15 WORK |

规划器默认每 **100 ticks** 检查一次，每次最多新增 **4 个工地**，单房最多保留 **12 个待建工地**。CPU bucket ≤ 1000 时暂停新增规划。

普通建筑围绕首个 spawn 的锚点寻找空位；容器、links 和道路按矿点、控制器与仓库位置规划。第一个 spawn 需要手动放置。记录锚点后，spawn 被毁且仍有可施工的 worker 时，可以规划替代工地。

这是一套基础布局规则。狭窄地形、出口附近或密集旧布局可能需要手动调整。

### Creep 分工

| 角色           | 任务                                                            |
| -------------- | --------------------------------------------------------------- |
| `worker`       | 早期采矿、填能、建设、维修、升级；后期保留恢复能力              |
| `miner`        | 固定矿点采矿，向附近容器或 link 交付能源                        |
| `hauler`       | 搬运能源与矿物，补充 spawn、extensions、towers 和控制器供能设施 |
| `upgrader`     | 专职升级；能源盈余时增加投入，RCL 8 保留一个                    |
| `defender`     | 远程守家，优先攻击 healer，尝试与近战保持距离                   |
| `mineralMiner` | 设施、矿量、能源和空间条件满足时采集矿物                        |

已有 creep 的身体不会改变。人口调整通过后续生产与自然替换完成；旧小 creep 的实际 WORK/CARRY 不足时会补充产能。

### 配置与状态

默认配置位于 [`src/config.ts`](src/config.ts)。在游戏 Console 中按房间覆盖，替换示例房间名；首次运行后再执行：

```js
Memory.rooms['W1N1'].settings = {
  autoBuild: true,
  storageReserve: 20000,
  upgradeSurplus: 60000,
  maxDefenders: 4,
};
```

| 设置             | 默认值  | 含义                   |
| ---------------- | ------- | ---------------------- |
| `autoBuild`      | `true`  | 自动放置工地           |
| `planInterval`   | `100`   | 规划间隔，单位 tick    |
| `maxNewSites`    | `4`     | 每轮最多新增工地       |
| `maxRoomSites`   | `12`    | 单房规划工地上限       |
| `storageReserve` | `20000` | 能源储备参考值         |
| `upgradeSurplus` | `60000` | 增加升级投入的储备阈值 |
| `maxDefenders`   | `4`     | 守卫数量上限           |

已有手动布局时，可以关闭规划；其他自动化继续运行：

```js
Memory.rooms['W1N1'].settings.autoBuild = false;

// 查看角色目标、RCL、能源与敌人数量。
JSON.stringify(Memory.rooms['W1N1'].stats);
```

`CONFIG.generatePixel` 默认关闭，可在源码中启用。

### 前期能源积压处理

没有 storage 且矿旁容器齐全时，若矿旁容器和矿点 2 格内掉落能源合计持续 100 ticks 达到每矿平均 1200，且进入前 spawn/extensions 能源至少为容量的 80%，启用额外升级投入。升级目标按矿点收入和身体 WORK 计算，最多 5 个；矿工、运输和建设 worker 保持更高生产优先级。

模式启用时，控制器补给阈值由 500 提高至 1500。每矿平均积压低于 400、出现武装敌人、建成 storage 或达到 RCL 8 时退出。退出后不再补充多余 upgrader，已有单位继续工作至自然替换；这不是紧急撤退机制。

查看模式：

```js
JSON.stringify(Memory.rooms['W22S17'].energyOverflow);
```

### 防御与边界

Towers 优先攻击敌方 healer，和平时治疗己方并按储备维修。武装敌人逼近关键建筑时尝试开启可用 safe mode，普通侦察单位不会触发守卫生产或 safe mode。Rampart 默认覆盖关键建筑，不会封闭整个房间。

经济 creep 在战斗敌人 5 格内暂停工作，优先避让或使用安全、可站立的己方 rampart；敌人仍在原撤退位置 6 格内时继续等待，危险解除后等待 25 ticks 再恢复工作。守卫优先攻击射程内目标，使用基地附近可站立的 rampart，避免追击远处敌人；无掩体时尝试躲开近战。有 tower 的 RCL 3+ 房间会在 spawn 附近规划最多两个可站立的 rampart 防守位置。

RCL 2 遇敌最多安排一个守卫。RCL 3+、容量至少 800 且有 tower 时，遇袭后 1500 ticks 内低优先级保留一个守卫；safe mode 期间暂停守卫补员。已有守卫不会被主动删除。

Safe mode 还会在至少两个未受 rampart 保护的经济 creep 已受伤且处于敌方攻击范围内，或唯一剩余的 worker/miner/hauler 遭遇此情况时尝试启用。仍检查可用次数、冷却等限制；不保证能在致命一击前触发。

尚未实现完整防御边界、boost 威胁评估、复杂 PvP、nuke 应对或 safe mode 次数自动补充。撤退路径、拥堵与战斗效果需要游戏内观察，无法保证抵御成熟玩家的军队。

### 高级设施

建筑自动规划，高级生产需要显式配置并准备原料：

```js
// 工厂：先装填配方原料。
Memory.rooms['W1N1'].factoryProduct = 'battery';

// 实验室：装填有效原料；输出 lab 距两个输入 lab 都应在 2 格内。
Memory.rooms['W1N1'].labReaction = {
  inputs: ['inputLabId1', 'inputLabId2'],
  outputs: ['outputLabId1'],
};

// Power spawn：装填 power 和 energy 后启用。
Memory.rooms['W1N1'].processPower = true;
```

Terminal 默认补至 10000 energy；能源需求满足后，运输可将富余矿物补至每种 5000。Observer 轮流观察相邻房间；nuker 只建设，不会自动发射。

原料装填与清空、配方规划、power creep 操作、市场交易、远矿和自动占领仍需自行管理。仓库满时没有完整溢出策略，能源仍可能掉落并消失。

### CPU bucket 与 pixel

Pixel 默认关闭，可在 Console 开启：

```js
Memory.cpuPolicy = { generatePixel: true };
JSON.stringify(Memory.cpuStats);
```

CPU 保留最近 200 ticks 的记录，统计窗口平均、峰值、超限次数和历史最高峰。漏 tick、执行错误或 CPU 额度改变会重新建立观察窗口。生成要求：

- 完整 200 ticks CPU 记录，平均不超过基础限额的 60%、峰值不超过 80%，当前消耗不超过 60%。20 CPU 时分别对应 12、16、12。
- 所有己方房间连续 200 ticks 经济稳定：有可用 spawn、有采集 worker 或各矿矿工加运输的生产链、spawn/extensions 至少 80% 满，并有能源缓冲。无 storage 时矿旁容器能源至少等于房间能源容量；有 storage 时至少达到 `storageReserve`。
- 近期 2000 ticks 无已记录武装威胁，当前无敌人、safe mode、避险单位或迫近的控制器降级；已有 towers 至少 700 energy。
- bucket 满 10000，API 可用。没有固定 RCL、storage 或 tower 的解锁要求，稳定的 RCL 2 也可以生成。

一个 pixel 消耗 10000 bucket，无法同时保留 bucket 储备。成功生成后至少 25 ticks 暂停额外任务，并等待 bucket 恢复到 3000。通常 bucket ≤ 1000 时也会进入恢复模式。

防御、生产、creep 行为和 links 优先运行；布局规划和高级工业在后面执行，按近期实际耗时估计判断能否安排，并预留至少基础 CPU 的 25%（最低 2 CPU）。多房额外任务轮换先后顺序。突发寻路、战斗或服务器波动仍可能超限，此策略不能保证下一 tick 的 CPU。

`Memory.cpuStats` 中 `peak`、`average`、`overLimitTicks` 是最近最多 200 个样本的统计；`peakEver` 是历史峰值。`pixelReason` 说明暂停原因：`disabled`、`recovering`、`economy-observation`、`cpu-observation`、`cpu-headroom`、`bucket-not-full` 等。`lastPixel` 和 `pixelResult` 记录最近生成情况；CPU 采样在统计写入之前。

矿工只补矿点缺少的 WORK（例如 4+1）；运输预算加入控制器补给距离，并考虑现有 upgrader 的实际 WORK，仍是估算而非完整交通仿真。

### 测试

Vitest 使用可重置的 Screeps mock。配置位于 `vitest.config.mts`，测试位于 `test/`；`test/tsconfig.json` 让 VS Code 识别测试项目和自定义 Memory 类型。

```bash
npm test
npm test -- test/population.test.ts
```

覆盖身体预算、RCL 1–8 人口与连续建设、断粮恢复、矿点分配、提前替换、多 spawn、防御、运输循环、矿物、links、生产开关及主循环错误隔离。

Mock 不等于完整服务器仿真。首次部署后应观察路径、拥堵、生产队列与能源储备；tick 末尾 intent 结算和 PvP 效果仍需游戏内验证。

---

## English

A TypeScript automation bot for **Screeps: World**. After you place the first spawn, it manages harvesting, hauling, construction, upgrading, and basic defense in your existing owned rooms. Creep counts and bodies adapt to energy supply, workload, and threats.

> The current scope is basic development in existing rooms. Defense is a foundation; automatic expansion, remote mining, and a complete industrial supply chain are not implemented.

### Quick start

Use **Node.js 24+** and npm locally. This requirement applies to installation, testing, and deployment, not the game server. The game bundle targets ES2020.

```bash
npm ci
npm run check

# First-time deployment setup; keep your existing .env if you have one.
cp .env.sample .env
```

Set your credentials and target branch in `.env`:

```dotenv
SCREEPS_TOKEN=YOUR_ACCESS_TOKEN
SCREEPS_BRANCH=default
```

Keep real tokens and `.env` out of GitHub.

```bash
npm run deploy
```

Deployment rebuilds the code and uploads it to the configured branch. Alternatively, paste `dist/main.js` into the game's `main` module.

### Commands

| Command                | Purpose                                   |
| ---------------------- | ----------------------------------------- |
| `npm ci`               | Reinstall dependencies from the lock file |
| `npm run check`        | Type-check, test, and build; no upload    |
| `npm test`             | Run Vitest tests                          |
| `npm run test:watch`   | Watch and rerun tests                     |
| `npm run typecheck`    | Check source and test types               |
| `npm run format`       | Format the project with Prettier          |
| `npm run format:check` | Check formatting without changing files   |
| `npm run build`        | Build `dist/main.js`                      |
| `npm run deploy`       | Build and upload game code                |
| `npm run watch`        | Watch source changes, build, and upload   |

### Console quick reference

Run this JavaScript in the **game Console**, and run `npm` commands in your local project terminal. Examples use `W22S17`; replace it for another room. Deploy and allow one tick to initialize room Memory first.

**Room targets, energy, and threats:**

```js
JSON.stringify(Memory.rooms['W22S17'].stats);
```

**Actual role counts, including spawning creeps:**

```js
JSON.stringify(
  Object.values(Game.creeps)
    .filter((c) => (c.memory.home ?? c.room.name) === 'W22S17')
    .reduce((counts, c) => {
      counts[c.memory.role] = (counts[c.memory.role] || 0) + 1;
      return counts;
    }, {}),
);
```

**Container positions and energy:**

```js
JSON.stringify(
  Game.rooms['W22S17']
    .find(FIND_STRUCTURES)
    .filter((s) => s.structureType === STRUCTURE_CONTAINER)
    .map((s) => ({
      x: s.pos.x,
      y: s.pos.y,
      energy: s.store[RESOURCE_ENERGY],
      nearController: s.pos.inRangeTo(Game.rooms['W22S17'].controller, 3),
    })),
);
```

**Overflow mode, spawn activity, and safe mode:**

```js
JSON.stringify(Memory.rooms['W22S17'].energyOverflow);
JSON.stringify(
  Game.rooms['W22S17'].find(FIND_MY_SPAWNS).map((s) => ({ name: s.name, spawning: s.spawning })),
);
JSON.stringify({
  active: Game.rooms['W22S17'].controller.safeMode,
  available: Game.rooms['W22S17'].controller.safeModeAvailable,
  cooldown: Game.rooms['W22S17'].controller.safeModeCooldown,
});
```

**Toggle construction without replacing other room settings:**

```js
Memory.rooms['W22S17'].settings ??= {};
Memory.rooms['W22S17'].settings.autoBuild = false;
// To resume:
Memory.rooms['W22S17'].settings.autoBuild = true;
```

**Toggle pixels and inspect CPU and task estimates:**

```js
Memory.cpuPolicy ??= {};
Memory.cpuPolicy.generatePixel = true;
// To disable:
Memory.cpuPolicy.generatePixel = false;

JSON.stringify(Memory.cpuStats);
JSON.stringify(Memory.cpuTaskCosts);
```

Run enable/disable statements separately as needed. `stats.targets` contains desired counts; actual counts can differ during spawning or natural replacement.

### Formatting

Prettier, its configuration, and scripts are included. After installing dependencies:

```bash
npm run format
npm run format:check
npm run check
```

`format` changes formatting; `format:check` only checks it. Dependencies, build output, and the lock file are ignored. The VS Code extension reads `.prettierrc.json`; CLI commands use the project's pinned Prettier version.

### Features

| System              | Behavior                                                                                            |
| ------------------- | --------------------------------------------------------------------------------------------------- |
| Adaptive population | Accounts for source output, hauling distance, actual WORK/CARRY, construction workload, and threats |
| Body generation     | Respects energy budgets and the 50-part limit; schedules replacements before expiration             |
| Economic recovery   | Prioritizes a small recovery worker when the economy breaks, starting at 200 energy                 |
| Multiple spawns     | Shares a room's queue and energy budget                                                             |
| Construction        | Places sites as RCL unlocks structures and preserves existing buildings                             |
| Basic defense       | Tower combat, healing and repairs; ranged defenders; safe mode near critical structures             |
| Structure control   | Link transfers, terminal supply, and configurable labs, factory, and power processing               |
| Multiple rooms      | Manages existing owned rooms, cleans dead creep Memory, and isolates execution errors               |

### RCL progression

Construction depends on available energy, terrain, and site limits.

| Level | Main additions                                                                                                     |
| ----- | ------------------------------------------------------------------------------------------------------------------ |
| RCL 1 | Workers harvest, build, and upgrade; source containers are planned                                                 |
| RCL 2 | Extensions, controller container, roads, and ramparts on critical structures                                       |
| RCL 3 | Towers; dedicated miners and haulers as containers become available                                                |
| RCL 4 | Storage; construction and upgrading budgets based on reserves                                                      |
| RCL 5 | Links near storage, sources, and the controller                                                                    |
| RCL 6 | Terminal, extractor, mineral container, mineral mining, and labs                                                   |
| RCL 7 | Second spawn and factory                                                                                           |
| RCL 8 | Third spawn, 6 towers, 60 extensions, 10 labs, observer, power spawn, and nuker; upgrader bodies capped at 15 WORK |

By default, planning runs every **100 ticks**, adds up to **4 sites** per pass, and keeps at most **12 pending sites** per room. New planning pauses at CPU bucket ≤ 1000.

General structures are placed around the first spawn's anchor. Containers, links, and roads follow source, controller, and storage positions. Place the first spawn manually. With a recorded anchor and surviving workers able to build, a replacement spawn site can be planned after destruction.

The planner uses basic placement rules. Narrow terrain, exits, and dense existing layouts may need manual adjustments.

### Creep roles

| Role           | Responsibility                                                                                   |
| -------------- | ------------------------------------------------------------------------------------------------ |
| `worker`       | Early harvesting, filling, construction, repair, and upgrading; later economic recovery          |
| `miner`        | Harvests an assigned source and delivers to a nearby container or link                           |
| `hauler`       | Moves energy and minerals; supplies spawns, extensions, towers, and controller supply structures |
| `upgrader`     | Dedicated upgrading; more investment with surplus energy, one at RCL 8                           |
| `defender`     | Ranged defense, healer targeting, and attempts to keep distance from melee enemies               |
| `mineralMiner` | Mines minerals when infrastructure, energy, mineral availability, and capacity allow             |

Existing bodies do not change. Adaptation happens through new spawning and natural replacement. Additional capacity is spawned when older, smaller creeps provide insufficient WORK or CARRY.

### Configuration and monitoring

Defaults live in [`src/config.ts`](src/config.ts). Override settings per room through the game Console after the bot has initialized room Memory:

```js
Memory.rooms['W1N1'].settings = {
  autoBuild: true,
  storageReserve: 20000,
  upgradeSurplus: 60000,
  maxDefenders: 4,
};
```

| Setting          | Default | Meaning                                   |
| ---------------- | ------- | ----------------------------------------- |
| `autoBuild`      | `true`  | Automatic construction-site placement     |
| `planInterval`   | `100`   | Planning interval in ticks                |
| `maxNewSites`    | `4`     | Maximum new sites per pass                |
| `maxRoomSites`   | `12`    | Pending-site limit for room planning      |
| `storageReserve` | `20000` | Energy reserve reference                  |
| `upgradeSurplus` | `60000` | Reserve threshold for increased upgrading |
| `maxDefenders`   | `4`     | Defender count limit                      |

Disable construction planning for a custom layout, or inspect room statistics:

```js
Memory.rooms['W1N1'].settings.autoBuild = false;
JSON.stringify(Memory.rooms['W1N1'].stats);
```

Other automation continues when planning is disabled. Pixel generation is disabled by default and can be enabled through `CONFIG.generatePixel` in the source.

### Early energy backlog

Before storage is built, with containers at every source, the bot enables extra upgrading after source containers and dropped energy within range 2 of sources hold an average of at least 1200 energy per source for 100 consecutive ticks. Spawn/extension energy must remain at least 80% full during activation. The target uses source income and upgrader WORK, capped at five upgraders; miners, haulers, and construction workers retain higher spawn priority.

While active, the controller supply threshold rises from 500 to 1500. The mode ends below 400 backlog energy per source, upon armed enemy arrival, when storage exists, or at RCL 8. Surplus upgraders stop being replaced but existing creeps continue working until natural replacement. This is not an emergency retreat system.

Inspect the mode:

```js
JSON.stringify(Memory.rooms['W22S17'].energyOverflow);
```

### Defense and limitations

Towers prioritize hostile healers, then heal friendly units and repair according to reserves during peace. Armed enemies approaching critical structures trigger an attempt to activate available safe mode. Unarmed scouts do not trigger defender spawning or safe mode. Ramparts protect critical structures rather than enclosing the room.

Economic creeps pause work within range 5 of hostile combatants and flee or use a safe, walkable friendly rampart. They keep waiting while enemies camp within range 6 of the original retreat position, then wait 25 safe ticks before resuming work. Guards prioritize targets already in firing range, use walkable ramparts near the base, avoid distant pursuit, and attempt to evade nearby melee attackers without cover. At RCL 3+ with a tower, planning adds up to two walkable rampart positions near the spawn.

RCL 2 requests at most one guard during an attack. At RCL 3+, with at least 800 energy capacity and a tower, one low-priority standby guard is maintained for 1500 ticks after a threat. Safe mode suspends defender replacement; existing guards are not removed.

Safe mode also attempts activation when at least two unprotected economic creeps are injured and within hostile attack range, or when the sole remaining worker/miner/hauler is in that condition. Availability and cooldown checks still apply. This cannot guarantee activation before a lethal hit.

Full perimeter planning, boost-aware threat evaluation, advanced PvP, nuke response, and automatic safe mode replenishment remain unimplemented. Retreat routing, congestion, and combat need in-game observation; this is not a guarantee against advanced armies.

### Advanced structures

Infrastructure is planned automatically. Production requires explicit configuration and prepared materials:

```js
// Factory: load recipe ingredients first.
Memory.rooms['W1N1'].factoryProduct = 'battery';

// Labs: load valid reagents; each output must be within range 2 of both inputs.
Memory.rooms['W1N1'].labReaction = {
  inputs: ['inputLabId1', 'inputLabId2'],
  outputs: ['outputLabId1'],
};

// Power spawn: supply power and energy before enabling processing.
Memory.rooms['W1N1'].processPower = true;
```

The terminal targets 10000 energy. Once energy needs are met, haulers may supply surplus minerals up to 5000 of each type. The observer cycles through neighboring rooms. The nuker is built but never fired automatically.

Ingredient loading and clearing, recipe planning, power creep operations, trading, remote mining, and claiming new rooms require separate management. There is no complete overflow strategy; energy may still be dropped and decay when storage fills.

### CPU bucket and pixels

Pixels are disabled by default. Opt in through the Console:

```js
Memory.cpuPolicy = { generatePixel: true };
JSON.stringify(Memory.cpuStats);
```

The bot keeps 200 recent CPU samples, recording the window average, peak, over-limit count, and lifetime peak. Missed ticks, execution errors, or a changed CPU limit restart observation. Generation requires:

- A complete 200-tick CPU window: average ≤ 60% of base CPU, peak ≤ 80%, current usage ≤ 60%. With 20 CPU, these thresholds are 12, 16, and 12.
- Every owned room economically stable for 200 consecutive ticks: an active spawn, a productive worker or miners assigned to each source plus a hauler, at least 80% spawn/extension energy, and an energy buffer. Source containers must hold at least the room's energy capacity without storage; storage must meet `storageReserve` when present.
- No recorded armed threat in 2000 ticks, current hostile, safe mode, retreating unit, or imminent controller downgrade. Existing towers must hold at least 700 energy.
- A full 10000 bucket and an available pixel API. There is no fixed RCL, storage, or tower unlock requirement: stable RCL 2 rooms can qualify.

A pixel consumes 10000 bucket, so it cannot preserve an emergency bucket reserve. After success, optional tasks pause for at least 25 ticks and until bucket recovers to 3000. Bucket ≤ 1000 also triggers recovery mode.

Defense, spawning, creep actions, and links take priority. Planning and advanced industry run afterward, using estimates from recent measured task costs and reserving at least 25% of base CPU (minimum 2 CPU). Optional room order rotates for fairness. Sudden routing, combat, or server variation can still exceed limits; this does not guarantee next-tick CPU safety.

In `Memory.cpuStats`, `peak`, `average`, and `overLimitTicks` describe up to 200 recent samples. `peakEver` is the lifetime peak. `pixelReason` explains pauses such as `disabled`, `recovering`, `economy-observation`, `cpu-observation`, `cpu-headroom`, or `bucket-not-full`. `lastPixel` and `pixelResult` retain generation results. CPU is sampled before statistics are written.

Miners fill only missing source WORK (for example 4+1). Hauling estimates include the controller route and actual WORK of existing upgraders; they are not a full traffic simulation.

### Testing

Vitest uses resettable Screeps mocks. Configuration lives in `vitest.config.mts`, with tests under `test/`. `test/tsconfig.json` enables VS Code to recognize the test project and custom Memory types.

```bash
npm test
npm test -- test/population.test.ts
```

Coverage includes body budgets, RCL 1–8 population and progressive construction, recovery, source assignment, early replacement, shared spawn budgets, defense, hauling loops, minerals, links, production toggles, and main-loop error isolation.

Mocks are not a full Screeps server simulation. Observe routing, congestion, spawn queues, and energy reserves after deployment. End-of-tick intent resolution and combat outcomes still require in-game validation.
