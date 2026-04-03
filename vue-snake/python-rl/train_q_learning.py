from __future__ import annotations

import argparse
import json
from pathlib import Path
import statistics
from typing import Dict, List

from snake_env import RELATIVE_ACTIONS, SnakeConfig, SnakeEnv


def epsilon_for_episode(episode: int, total_episodes: int) -> float:
    progress = episode / max(1, total_episodes - 1)
    return max(0.02, 1.0 - progress * 0.98)


def choose_action(q_values: List[float], epsilon: float, env: SnakeEnv) -> int:
    if env.random.random() < epsilon:
        return env.random.randrange(len(RELATIVE_ACTIONS))

    best_value = max(q_values)
    best_indices = [index for index, value in enumerate(q_values) if value == best_value]
    return env.random.choice(best_indices)


def run_training(episodes: int, seed: int, rows: int, cols: int) -> Dict[str, object]:
    config = SnakeConfig(rows=rows, cols=cols, max_steps=rows * cols * 3)
    env = SnakeEnv(config=config, seed=seed)

    q_table: Dict[str, List[float]] = {}
    alpha = 0.14
    gamma = 0.94

    for episode in range(episodes):
        state_key = env.reset(seed=seed + episode)
        epsilon = epsilon_for_episode(episode, episodes)

        while True:
            q_values = q_table.setdefault(state_key, [0.0, 0.0, 0.0])
            action_index = choose_action(q_values, epsilon, env)
            next_state_key, reward, done, _ = env.step(action_index)
            next_values = q_table.setdefault(next_state_key, [0.0, 0.0, 0.0])

            target = reward if done else reward + gamma * max(next_values)
            q_values[action_index] += alpha * (target - q_values[action_index])
            state_key = next_state_key

            if done:
                break

    evaluation_scores = []
    evaluation_steps = []
    for evaluation_episode in range(200):
        state_key = env.reset(seed=seed + episodes + evaluation_episode)
        while True:
            q_values = q_table.setdefault(state_key, [0.0, 0.0, 0.0])
            best_value = max(q_values)
            action_index = q_values.index(best_value)
            state_key, _, done, info = env.step(action_index)
            if done:
                evaluation_scores.append(info["score"])
                evaluation_steps.append(info["steps"])
                break

    return {
        "metadata": {
            "actionLabels": list(RELATIVE_ACTIONS),
            "algorithm": "Q-Learning",
            "averageEvaluationScore": round(statistics.fmean(evaluation_scores), 3),
            "averageEvaluationSteps": round(statistics.fmean(evaluation_steps), 3),
            "board": {"rows": rows, "cols": cols},
            "episodes": episodes,
            "featureDescription": [
                "danger_straight",
                "danger_left",
                "danger_right",
                "food_up",
                "food_down",
                "food_left",
                "food_right",
                "dir_up",
                "dir_down",
                "dir_left",
                "dir_right",
            ],
            "maxEvaluationScore": max(evaluation_scores),
            "seed": seed,
            "visitedStates": len(q_table),
        },
        "policy": {
            state_key: [round(value, 6) for value in q_values]
            for state_key, q_values in sorted(q_table.items())
        },
    }


def write_outputs(result: Dict[str, object], json_path: Path, ts_path: Path) -> None:
    json_path.parent.mkdir(parents=True, exist_ok=True)
    ts_path.parent.mkdir(parents=True, exist_ok=True)

    json_path.write_text(
        json.dumps(result, indent=2, sort_keys=True) + "\n",
        encoding="utf-8",
    )

    ts_module = (
        'import type { QLearningMetadata, QLearningPolicy } from "./types.js";\n\n'
        "export const Q_LEARNING_METADATA: QLearningMetadata = "
        + json.dumps(result["metadata"], indent=2, sort_keys=True)
        + ";\n\nexport const Q_LEARNING_POLICY: QLearningPolicy = "
        + json.dumps(result["policy"], indent=2, sort_keys=True)
        + ";\n"
    )
    ts_path.write_text(ts_module, encoding="utf-8")


def parse_args() -> argparse.Namespace:
    parser = argparse.ArgumentParser(description="Train a tabular Q-learning Snake agent.")
    parser.add_argument("--episodes", type=int, default=18000)
    parser.add_argument("--seed", type=int, default=7)
    parser.add_argument("--rows", type=int, default=12)
    parser.add_argument("--cols", type=int, default=12)
    parser.add_argument(
        "--json-output",
        type=Path,
        default=Path("python-rl/models/q_learning_policy.json"),
    )
    parser.add_argument(
        "--ts-output",
        type=Path,
        default=Path("src/game/qLearningPolicyData.generated.ts"),
    )
    return parser.parse_args()


def main() -> None:
    args = parse_args()
    result = run_training(
        episodes=args.episodes,
        seed=args.seed,
        rows=args.rows,
        cols=args.cols,
    )
    write_outputs(result, args.json_output, args.ts_output)
    print(
        f"Trained Q-learning policy with {result['metadata']['visitedStates']} visited states. "
        f"Average evaluation score: {result['metadata']['averageEvaluationScore']}"
    )


if __name__ == "__main__":
    main()
