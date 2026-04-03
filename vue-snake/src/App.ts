import {
  computed,
  defineComponent,
  onBeforeUnmount,
  onMounted,
  ref,
  watch
} from "./vue-browser-runtime.js";

import {
  DEFAULT_APP_CONFIG,
  resolveMapPreset,
  resolveThemePreset
} from "./appConfig.js";
import { computeAIDirection, explainAIMove } from "./game/ai.js";
import {
  computeDistilledExpertDirection,
  explainDistilledExpertMove
} from "./game/distilledExpert.js";
import { DEFAULT_CONFIG, createInitialState, positionKey, requestDirection, startGame, step, togglePause } from "./game/logic.js";
import { DISTILLED_EXPERT_METADATA } from "./game/distilledExpertPolicyData.generated.js";
import { Q_LEARNING_METADATA } from "./game/qLearningPolicyData.generated.js";
import { computeQLearningDirection, explainQLearningMove } from "./game/qLearning.js";
import type { AppConfig, MapPreset } from "./appConfig.js";
import type { AIModel, BoardCell, Direction, GameConfig, GameState, MapSize, ThemeName } from "./game/types.js";
const DIRECTION_KEYS = new Set(["arrowdown", "arrowleft", "arrowright", "arrowup", "a", "d", "s", "w"]);
const SPEED_OPTIONS = [
  { label: "0.5x", value: 0.5 },
  { label: "0.75x", value: 0.75 },
  { label: "1x", value: 1 },
  { label: "1.25x", value: 1.25 },
  { label: "1.5x", value: 1.5 },
  { label: "2x", value: 2 }
] as const;

function nextFoodSelector(): number {
  return Math.floor(Math.random() * Number.MAX_SAFE_INTEGER);
}

function isAiModel(value: string): value is AIModel {
  return value === "human" || value === "rule" || value === "q_learning" || value === "distilled";
}

function toGameConfig(preset: MapPreset): GameConfig {
  return {
    cols: preset.cols,
    initialLength: preset.initialLength,
    rows: preset.rows,
    tickMs: preset.tickMs
  };
}

function createState(nextConfig: GameConfig): GameState {
  return createInitialState(nextConfig, nextFoodSelector());
}

function createBoard(state: GameState, activeConfig: GameConfig): BoardCell[] {
  const snakeLookup = new Map<string, number>(
    state.snake.map((segment, index) => [positionKey(segment), index])
  );
  const cells: BoardCell[] = [];

  for (let row = 0; row < activeConfig.rows; row += 1) {
    for (let col = 0; col < activeConfig.cols; col += 1) {
      const key = positionKey({ row, col });
      let type: BoardCell["type"] = "empty";

      if (state.food.row === row && state.food.col === col) {
        type = "food";
      }

      if (snakeLookup.has(key)) {
        type = snakeLookup.get(key) === 0 ? "head" : "snake";
      }

      cells.push({ key, type });
    }
  }

  return cells;
}

function boardSizeForConfig(config: GameConfig): number {
  const longestEdge = Math.max(config.rows, config.cols);
  const cellSize = 25;
  const gap = 3;
  const padding = 16;
  return longestEdge * cellSize + Math.max(0, longestEdge - 1) * gap + padding;
}

export default defineComponent({
  name: "SnakeApp",
  setup() {
    const appConfig = ref<AppConfig>(DEFAULT_APP_CONFIG);
    const mapSize = ref<MapSize>(appConfig.value.defaults.mapId);
    const theme = ref<ThemeName>(appConfig.value.defaults.themeId);
    const gameConfig = ref<GameConfig>(toGameConfig(resolveMapPreset(appConfig.value, mapSize.value)));
    const state = ref<GameState>(createState(gameConfig.value));
    const aiMode = ref<AIModel>(appConfig.value.defaults.aiMode);
    const boostRequested = ref(false);
    const settingsOpen = ref(false);
    const settingsPausedGame = ref(false);
    const configPath = ref("");
    const configStatus = ref("使用内置默认配置。");
    const speedMultiplier = ref(appConfig.value.controls.speedMultiplier);
    const mapOptions = computed(() => appConfig.value.maps);
    const speedOptions = SPEED_OPTIONS;
    const themeOptions = computed(() => appConfig.value.themes);
    const aiEnabled = computed(() => aiMode.value !== "human");
    const boostActive = computed(() => boostRequested.value && !aiEnabled.value);
    const themeStyle = computed<Record<string, string>>(
      () => resolveThemePreset(appConfig.value, theme.value).colors
    );
    const currentTickMs = computed(() => {
      const baseTickMs = gameConfig.value.tickMs ?? DEFAULT_CONFIG.tickMs ?? 140;
      const { boostMinTickMs, boostRatio } = appConfig.value.controls;
      const scaledBaseTickMs = Math.max(35, Math.floor(baseTickMs / speedMultiplier.value));
      const scaledBoostMinTickMs = Math.max(28, Math.floor(boostMinTickMs / speedMultiplier.value));
      return boostActive.value
        ? Math.max(scaledBoostMinTickMs, Math.floor(scaledBaseTickMs * boostRatio))
        : scaledBaseTickMs;
    });
    const modelBoardLabel = `${Q_LEARNING_METADATA.board.rows} x ${Q_LEARNING_METADATA.board.cols}`;
    const distilledBoardLabel = DISTILLED_EXPERT_METADATA.boardSizes.join(", ");
    const aiMessage = computed(() => {
      if (aiMode.value === "q_learning") {
        return `${explainQLearningMove(state.value, gameConfig.value)} 训练棋盘：${modelBoardLabel}。`;
      }
      if (aiMode.value === "distilled") {
        return `${explainDistilledExpertMove(state.value, gameConfig.value)} 覆盖棋盘：${distilledBoardLabel}。`;
      }
      if (aiMode.value === "rule") {
        return explainAIMove(state.value, gameConfig.value);
      }
      return "点击开始，或按方向键 / WASD 后再开始移动。长按方向键可加速。空格或 P 暂停，R 重开，逗号键打开设置。";
    });
    const boardCells = computed(() => createBoard(state.value, gameConfig.value));
    const boardStyle = computed(() => ({
      gridTemplateColumns: `repeat(${gameConfig.value.cols}, 1fr)`,
      maxWidth: "100%",
      width: `${boardSizeForConfig(gameConfig.value)}px`
    }));

    let tickHandle: number | null = null;
    const heldDirectionKeys = new Set<string>();
    let boostArmTimer: number | null = null;

    function clearBoostTimer(): void {
      if (boostArmTimer !== null) {
        window.clearTimeout(boostArmTimer);
        boostArmTimer = null;
      }
    }

    function applyRuntimeConfig(nextConfig: AppConfig, statusMessage: string): void {
      const nextMap = resolveMapPreset(nextConfig, nextConfig.defaults.mapId);
      const nextTheme = resolveThemePreset(nextConfig, nextConfig.defaults.themeId);

      appConfig.value = nextConfig;
      mapSize.value = nextMap.id;
      theme.value = nextTheme.id;
      aiMode.value = nextConfig.defaults.aiMode;
      speedMultiplier.value = nextConfig.controls.speedMultiplier;
      gameConfig.value = toGameConfig(nextMap);
      state.value = createState(gameConfig.value);
      clearBoostInputs();
      configStatus.value = statusMessage;
      stopLoop();
      startLoop();
    }

    async function syncDesktopConfig(reload = false): Promise<void> {
      if (!window.snakeDesktop) {
        return;
      }

      const payload = reload
        ? await window.snakeDesktop.reloadConfig()
        : await window.snakeDesktop.getConfig();
      configPath.value = payload.configPath;

      const statusMessage = payload.error
        ? `配置文件读取失败，已回退默认值：${payload.error}`
        : "已从外部 JSON 配置加载。修改文件后可点击“重新加载配置”。";
      applyRuntimeConfig(payload.config, statusMessage);
    }

    function start(): void {
      state.value = startGame(state.value);
    }

    function restart(): void {
      state.value = createState(gameConfig.value);
    }

    function runTick(): void {
      if (aiEnabled.value && !state.value.gameOver && !state.value.started) {
        state.value = startGame(state.value);
      }

      if (aiEnabled.value && !state.value.paused && !state.value.gameOver && state.value.started) {
        let direction = computeAIDirection(state.value, gameConfig.value);
        if (aiMode.value === "q_learning") {
          direction = computeQLearningDirection(state.value, gameConfig.value);
        } else if (aiMode.value === "distilled") {
          direction = computeDistilledExpertDirection(state.value, gameConfig.value);
        }
        state.value = requestDirection(state.value, direction);
      }

      state.value = step(state.value, gameConfig.value, nextFoodSelector());
    }

    function startLoop(): void {
      if (tickHandle !== null) {
        return;
      }

      tickHandle = window.setInterval(runTick, currentTickMs.value);
    }

    function stopLoop(): void {
      if (tickHandle === null) {
        return;
      }

      window.clearInterval(tickHandle);
      tickHandle = null;
    }

    function setDirection(direction: Direction): void {
      if (state.value.started && state.value.queuedDirection === direction) {
        return;
      }

      state.value = requestDirection(state.value, direction);
    }

    function armBoostIfHeld(): void {
      clearBoostTimer();
      boostRequested.value = false;

      if (
        heldDirectionKeys.size === 0 ||
        aiEnabled.value ||
        settingsOpen.value ||
        state.value.paused ||
        state.value.gameOver
      ) {
        return;
      }

      boostArmTimer = window.setTimeout(() => {
        if (
          heldDirectionKeys.size > 0 &&
          !aiEnabled.value &&
          !settingsOpen.value &&
          !state.value.paused &&
          !state.value.gameOver
        ) {
          boostRequested.value = true;
        }
        boostArmTimer = null;
      }, appConfig.value.controls.boostHoldMs);
    }

    function clearBoostInputs(): void {
      clearBoostTimer();
      heldDirectionKeys.clear();
      boostRequested.value = false;
    }

    function setAiMode(nextMode: string): void {
      if (!isAiModel(nextMode)) {
        return;
      }

      clearBoostInputs();
      aiMode.value = nextMode;
    }

    function applyMapSize(nextSize: string): void {
      const nextMap = mapOptions.value.find((item) => item.id === nextSize);
      if (!nextMap) {
        return;
      }

      mapSize.value = nextMap.id;
      gameConfig.value = toGameConfig(nextMap);
      restart();
      stopLoop();
      startLoop();
    }

    function applyTheme(nextTheme: string): void {
      const matchedTheme = themeOptions.value.find((item) => item.id === nextTheme);
      if (!matchedTheme) {
        return;
      }

      theme.value = matchedTheme.id;
    }

    function applySpeedMultiplier(nextValue: string): void {
      const parsedValue = Number(nextValue);
      const matchedOption = SPEED_OPTIONS.find((option) => option.value === parsedValue);
      if (!matchedOption) {
        return;
      }

      speedMultiplier.value = matchedOption.value;
    }

    function toggleGamePause(): void {
      if (!state.value.paused) {
        clearBoostInputs();
      }
      state.value = togglePause(state.value);
    }

    function setAiModeAndRefresh(nextMode: AIModel): void {
      clearBoostInputs();
      aiMode.value = nextMode;
    }

    function openSettings(): void {
      clearBoostInputs();
      settingsPausedGame.value = false;
      if (state.value.started && !state.value.paused && !state.value.gameOver) {
        state.value = togglePause(state.value);
        settingsPausedGame.value = true;
      }
      settingsOpen.value = true;
    }

    function closeSettings(): void {
      settingsOpen.value = false;
      if (settingsPausedGame.value && state.value.paused && !state.value.gameOver) {
        state.value = togglePause(state.value);
      }
      settingsPausedGame.value = false;
    }

    async function reloadConfigFromDisk(): Promise<void> {
      await syncDesktopConfig(true);
    }

    async function openConfigFile(): Promise<void> {
      if (!window.snakeDesktop) {
        return;
      }

      const error = await window.snakeDesktop.openConfigFile();
      if (error) {
        configStatus.value = `打开配置文件失败：${error}`;
        return;
      }

      configStatus.value = "已打开配置文件。保存修改后可回到应用点击“重新加载配置”。";
    }

    function handleKeydown(event: KeyboardEvent): void {
      const key = event.key.toLowerCase();
      const directionByKey: Record<string, Direction> = {
        arrowdown: "down",
        arrowleft: "left",
        arrowright: "right",
        arrowup: "up",
        a: "left",
        d: "right",
        s: "down",
        w: "up"
      };

      if (settingsOpen.value) {
        if (key === "escape") {
          event.preventDefault();
          closeSettings();
        }
        return;
      }

      if (directionByKey[key]) {
        event.preventDefault();
        if (event.repeat && heldDirectionKeys.has(key)) {
          return;
        }

        if (!heldDirectionKeys.has(key)) {
          heldDirectionKeys.add(key);
          armBoostIfHeld();
        }
        setDirection(directionByKey[key]);
        return;
      }

      if (key === " ") {
        event.preventDefault();
        toggleGamePause();
        return;
      }

      if (key === "p") {
        toggleGamePause();
        return;
      }

      if (key === "r") {
        restart();
        return;
      }

      if (key === "i") {
        setAiModeAndRefresh(aiMode.value === "human" ? "rule" : "human");
        return;
      }

      if (key === "1") {
        setAiModeAndRefresh("human");
        return;
      }

      if (key === "2") {
        setAiModeAndRefresh("rule");
        return;
      }

      if (key === "3") {
        setAiModeAndRefresh("q_learning");
        return;
      }

      if (key === "4") {
        setAiModeAndRefresh("distilled");
        return;
      }

      if (key === ",") {
        event.preventDefault();
        openSettings();
      }
    }

    function handleKeyup(event: KeyboardEvent): void {
      const key = event.key.toLowerCase();
      if (!DIRECTION_KEYS.has(key)) {
        return;
      }

      heldDirectionKeys.delete(key);
      if (heldDirectionKeys.size === 0) {
        clearBoostInputs();
        return;
      }

      if (!boostRequested.value) {
        armBoostIfHeld();
      }
    }

    watch(currentTickMs, () => {
      if (tickHandle === null) {
        return;
      }

      stopLoop();
      startLoop();
    });

    onMounted(() => {
      startLoop();
      window.addEventListener("keydown", handleKeydown);
      window.addEventListener("keyup", handleKeyup);
      window.addEventListener("blur", clearBoostInputs);
      void syncDesktopConfig(false);
    });

    onBeforeUnmount(() => {
      stopLoop();
      clearBoostInputs();
      window.removeEventListener("keydown", handleKeydown);
      window.removeEventListener("keyup", handleKeyup);
      window.removeEventListener("blur", clearBoostInputs);
    });

    return {
      aiEnabled,
      aiMessage,
      aiMode,
      applyMapSize,
      applySpeedMultiplier,
      applyTheme,
      boardCells,
      boardStyle,
      boostActive,
      closeSettings,
      configPath,
      configStatus,
      gameConfig,
      mapSize,
      mapOptions,
      openConfigFile,
      openSettings,
      reloadConfigFromDisk,
      restart,
      setAiMode,
      setDirection,
      settingsOpen,
      speedMultiplier,
      speedOptions,
      start,
      state,
      theme,
      themeOptions,
      themeStyle,
      toggleGamePause
    };
  },
  template: `
    <main class="app-shell" :style="themeStyle">
      <section class="game-card">
        <header class="topbar">
          <div>
            <p class="eyebrow">Snake Game</p>
            <h1>经典贪吃蛇</h1>
          </div>
          <div class="status-group">
            <span class="status-pill">Score {{ state.score }}</span>
            <span class="status-pill active" v-if="aiEnabled">AI On</span>
            <span
              class="status-pill boost"
              v-if="!aiEnabled"
              :style="{ visibility: boostActive ? 'visible' : 'hidden' }"
            >Boost</span>
            <span class="status-pill" v-if="!state.started && !state.gameOver">Ready</span>
            <span class="status-pill" v-if="state.paused">Paused</span>
            <span class="status-pill danger" v-if="state.gameOver">Game Over</span>
          </div>
        </header>

        <section class="toolbar">
          <button class="action-button" type="button" @click="start" v-if="!state.started && !state.gameOver">
            开始游戏
          </button>
          <button class="action-button" type="button" @click="toggleGamePause">
            {{ state.paused ? "继续" : "暂停" }}
          </button>
          <button class="action-button" type="button" @click="restart">
            重新开始
          </button>
          <button class="action-button secondary" type="button" @click="openSettings">
            设置
          </button>
        </section>

        <p class="hint">
          {{
            !state.started && !aiEnabled
              ? "点击开始，或按方向键 / WASD 后再开始移动。长按方向键可加速。空格或 P 暂停，R 重开，逗号键打开设置。"
              : aiMessage
          }}
        </p>

        <div class="board-frame">
          <section class="board" :style="boardStyle" aria-label="Snake board">
            <div
              v-for="cell in boardCells"
              :key="cell.key"
              class="cell"
              :class="'cell-' + cell.type"
            ></div>
          </section>
          <div class="board-overlay" v-if="!state.started && !state.gameOver">
            <p>等待开始</p>
            <button class="action-button" type="button" @click="start">开始游戏</button>
          </div>
        </div>
      </section>

      <div class="settings-overlay" v-if="settingsOpen" @click.self="closeSettings">
        <section class="settings-panel" aria-label="Settings panel">
          <header class="settings-header">
            <div>
              <p class="eyebrow">Settings</p>
              <h2>游戏设置</h2>
            </div>
            <button class="action-button secondary" type="button" @click="closeSettings">
              关闭
            </button>
          </header>

          <section class="menu-bar settings-grid">
            <label class="mode-field">
              <span>地图</span>
              <select class="mode-select" :value="mapSize" @change="applyMapSize($event.target.value)">
                <option v-for="option in mapOptions" :key="option.id" :value="option.id">
                  {{ option.label }}
                </option>
              </select>
            </label>
            <label class="mode-field">
              <span>主题</span>
              <select class="mode-select" :value="theme" @change="applyTheme($event.target.value)">
                <option v-for="option in themeOptions" :key="option.id" :value="option.id">
                  {{ option.label }}
                </option>
              </select>
            </label>
            <label class="mode-field">
              <span>AI 模式</span>
              <select class="mode-select" :value="aiMode" @change="setAiMode($event.target.value)">
                <option value="human">手动</option>
                <option value="rule">Rule AI</option>
                <option value="q_learning">Q-Learning</option>
                <option value="distilled">Distilled Expert</option>
              </select>
            </label>
            <label class="mode-field">
              <span>速度</span>
              <select class="mode-select" :value="String(speedMultiplier)" @change="applySpeedMultiplier($event.target.value)">
                <option v-for="option in speedOptions" :key="option.label" :value="option.value">
                  {{ option.label }}
                </option>
              </select>
            </label>
          </section>

          <section class="config-bar settings-section">
            <div class="config-copy">
              <p class="config-label">配置文件</p>
              <p class="config-path">{{ configPath || "当前使用内置默认配置。" }}</p>
              <p class="config-note">{{ configStatus }}</p>
            </div>
            <div class="config-actions" v-if="configPath">
              <button class="action-button secondary" type="button" @click="openConfigFile">
                打开配置
              </button>
              <button class="action-button secondary" type="button" @click="reloadConfigFromDisk">
                重新加载配置
              </button>
            </div>
          </section>

          <p class="hint settings-hint">
            当前支持直接编辑 JSON 配置文件来自定义地图、主题、默认 AI 和加速参数。后面可以继续把新增、删除和保存也做进这个设置面板。
          </p>
        </section>
      </div>
    </main>
  `
});
