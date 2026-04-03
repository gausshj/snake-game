from __future__ import annotations

import argparse
import json
from pathlib import Path
import random
import statistics
from typing import Dict, List, Sequence, Tuple

import torch
from torch import nn
from torch.utils.data import DataLoader, TensorDataset, random_split

from expert_teacher import (
    RELATIVE_ACTIONS,
    compute_rule_direction,
    direction_to_relative,
    distilled_feature_vector,
    to_teacher_state,
)
from snake_env import SnakeConfig, SnakeEnv


BASE_DIR = Path(__file__).resolve().parent


class DistilledExpertNet(nn.Module):
    def __init__(self, feature_size: int, hidden_sizes: Sequence[int]) -> None:
        super().__init__()
        layers: List[nn.Module] = []
        input_size = feature_size
        for hidden_size in hidden_sizes:
            layers.append(nn.Linear(input_size, hidden_size))
            layers.append(nn.ReLU())
            input_size = hidden_size
        layers.append(nn.Linear(input_size, len(RELATIVE_ACTIONS)))
        self.network = nn.Sequential(*layers)

    def forward(self, inputs: torch.Tensor) -> torch.Tensor:
        return self.network(inputs)


def parse_size(value: str) -> Tuple[int, int]:
    rows_text, cols_text = value.lower().split("x", maxsplit=1)
    return (int(rows_text), int(cols_text))


def collect_dataset(
    sizes: Sequence[Tuple[int, int]],
    episodes_per_size: int,
    seed: int,
) -> Tuple[List[List[float]], List[int]]:
    features: List[List[float]] = []
    labels: List[int] = []

    for size_index, (rows, cols) in enumerate(sizes):
        config = SnakeConfig(rows=rows, cols=cols, max_steps=rows * cols * 4)
        seed_base = seed + size_index * 100_000

        for episode in range(episodes_per_size):
            env = SnakeEnv(config=config, seed=seed_base + episode)
            env.reset(seed=seed_base + episode)

            while not env.done:
                teacher_state = to_teacher_state(env)
                direction = compute_rule_direction(teacher_state, config)
                relative_action = direction_to_relative(teacher_state["direction"], direction)
                if relative_action is None:
                    break

                features.append(distilled_feature_vector(teacher_state, config))
                labels.append(RELATIVE_ACTIONS.index(relative_action))
                env.step(RELATIVE_ACTIONS.index(relative_action))

    return features, labels


def train_network(
    features: List[List[float]],
    labels: List[int],
    hidden_sizes: Sequence[int],
    seed: int,
    epochs: int,
    batch_size: int,
) -> Tuple[DistilledExpertNet, Dict[str, float]]:
    torch.manual_seed(seed)
    random.seed(seed)

    feature_tensor = torch.tensor(features, dtype=torch.float32)
    label_tensor = torch.tensor(labels, dtype=torch.long)

    dataset = TensorDataset(feature_tensor, label_tensor)
    validation_size = max(1, int(len(dataset) * 0.1))
    train_size = len(dataset) - validation_size
    train_dataset, validation_dataset = random_split(
        dataset,
        [train_size, validation_size],
        generator=torch.Generator().manual_seed(seed),
    )

    model = DistilledExpertNet(feature_tensor.shape[1], hidden_sizes)
    optimizer = torch.optim.Adam(model.parameters(), lr=1e-3)
    criterion = nn.CrossEntropyLoss()

    train_loader = DataLoader(train_dataset, batch_size=batch_size, shuffle=True)
    validation_loader = DataLoader(validation_dataset, batch_size=batch_size)

    for _ in range(epochs):
        model.train()
        for batch_features, batch_labels in train_loader:
            optimizer.zero_grad()
            loss = criterion(model(batch_features), batch_labels)
            loss.backward()
            optimizer.step()

    def accuracy(loader: DataLoader) -> float:
        model.eval()
        correct = 0
        total = 0
        with torch.no_grad():
            for batch_features, batch_labels in loader:
                predictions = model(batch_features).argmax(dim=1)
                correct += int((predictions == batch_labels).sum().item())
                total += batch_labels.numel()
        return correct / max(1, total)

    metrics = {
        "trainingAccuracy": round(accuracy(DataLoader(train_dataset, batch_size=batch_size)), 4),
        "validationAccuracy": round(accuracy(validation_loader), 4),
    }
    return model, metrics


def evaluate_teacher(config: SnakeConfig, start_seed: int, episodes: int) -> float:
    scores: List[int] = []
    for episode in range(episodes):
        env = SnakeEnv(config=config, seed=start_seed + episode)
        env.reset(seed=start_seed + episode)
        while not env.done:
            teacher_state = to_teacher_state(env)
            direction = compute_rule_direction(teacher_state, config)
            relative_action = direction_to_relative(teacher_state["direction"], direction)
            if relative_action is None:
                break
            env.step(RELATIVE_ACTIONS.index(relative_action))
        scores.append(env.score)
    return round(statistics.fmean(scores), 3)


def relative_probabilities(logits: torch.Tensor) -> List[float]:
    probabilities = torch.softmax(logits, dim=0)
    return [float(value) for value in probabilities.tolist()]


def choose_relative_action(
    model: DistilledExpertNet,
    teacher_state: Dict[str, object],
    config: SnakeConfig,
    confidence_threshold: float,
) -> int:
    features = torch.tensor(distilled_feature_vector(teacher_state, config), dtype=torch.float32)
    with torch.no_grad():
        logits = model(features)

    probabilities = relative_probabilities(logits)
    best_index = max(range(len(probabilities)), key=lambda index: probabilities[index])
    if probabilities[best_index] >= confidence_threshold:
        return best_index

    fallback_direction = compute_rule_direction(teacher_state, config)
    fallback_relative = direction_to_relative(teacher_state["direction"], fallback_direction)
    if fallback_relative is None:
        return best_index
    return RELATIVE_ACTIONS.index(fallback_relative)


def evaluate_network(
    model: DistilledExpertNet,
    sizes: Sequence[Tuple[int, int]],
    seed: int,
    evaluation_episodes: int,
    confidence_threshold: float,
) -> float:
    scores: List[int] = []

    for size_index, (rows, cols) in enumerate(sizes):
        config = SnakeConfig(rows=rows, cols=cols, max_steps=rows * cols * 4)
        seed_base = seed + 1_000_000 + size_index * 100_000

        for episode in range(evaluation_episodes):
            env = SnakeEnv(config=config, seed=seed_base + episode)
            env.reset(seed=seed_base + episode)

            while not env.done:
                teacher_state = to_teacher_state(env)
                action_index = choose_relative_action(
                    model,
                    teacher_state,
                    config,
                    confidence_threshold=confidence_threshold,
                )
                env.step(action_index)

            scores.append(env.score)

    return round(statistics.fmean(scores), 3)


def export_network(model: DistilledExpertNet) -> Dict[str, object]:
    layers = []
    for module in model.network:
        if isinstance(module, nn.Linear):
            weight_rows = [
                [round(float(value), 6) for value in row]
                for row in module.weight.detach().cpu().tolist()
            ]
            bias_values = [round(float(value), 6) for value in module.bias.detach().cpu().tolist()]
            layers.append({
                "weights": weight_rows,
                "bias": bias_values,
            })

    first_layer = next(layer for layer in model.network if isinstance(layer, nn.Linear))
    return {
        "featureSize": int(first_layer.in_features),
        "layers": layers,
    }


def build_result(
    sizes: Sequence[Tuple[int, int]],
    episodes_per_size: int,
    seed: int,
    hidden_sizes: Sequence[int],
    epochs: int,
    batch_size: int,
    teacher_evaluation_episodes: int,
    network_evaluation_episodes: int,
    confidence_threshold: float,
) -> Dict[str, object]:
    features, labels = collect_dataset(sizes, episodes_per_size, seed)
    model, metrics = train_network(
        features=features,
        labels=labels,
        hidden_sizes=hidden_sizes,
        seed=seed,
        epochs=epochs,
        batch_size=batch_size,
    )

    teacher_scores = []
    for size_index, (rows, cols) in enumerate(sizes):
        config = SnakeConfig(rows=rows, cols=cols, max_steps=rows * cols * 4)
        teacher_scores.append(
            evaluate_teacher(
                config,
                seed + 2_000_000 + size_index * 10_000,
                teacher_evaluation_episodes,
            )
        )

    fallback_score = evaluate_network(
        model=model,
        sizes=sizes,
        seed=seed,
        evaluation_episodes=network_evaluation_episodes,
        confidence_threshold=confidence_threshold,
    )

    return {
        "metadata": {
            "algorithm": "Distilled Expert Net",
            "boardSizes": [f"{rows}x{cols}" for rows, cols in sizes],
            "collectedSamples": len(features),
            "confidenceThreshold": confidence_threshold,
            "episodesPerSize": episodes_per_size,
            "fallbackEvaluationScore": fallback_score,
            "featureDescription": [
                "rotated_local_5x5_window_one_hot",
                "normalized_rotated_food_delta",
                "relative_safe_moves",
                "snake_length_ratio",
            ],
            "hiddenSizes": list(hidden_sizes),
            "seed": seed,
            "teacherEvaluationScore": round(statistics.fmean(teacher_scores), 3),
            "trainingAccuracy": metrics["trainingAccuracy"],
            "validationAccuracy": metrics["validationAccuracy"],
        },
        "network": export_network(model),
    }


def write_outputs(result: Dict[str, object], json_path: Path, ts_path: Path) -> None:
    json_path.parent.mkdir(parents=True, exist_ok=True)
    ts_path.parent.mkdir(parents=True, exist_ok=True)

    json_path.write_text(
        json.dumps(result, indent=2, sort_keys=True) + "\n",
        encoding="utf-8",
    )

    ts_module = (
        'import type { DistilledExpertMetadata, DistilledExpertNetwork } from "./types.js";\n\n'
        "export const DISTILLED_EXPERT_METADATA: DistilledExpertMetadata = "
        + json.dumps(result["metadata"], indent=2, sort_keys=True)
        + ";\n\nexport const DISTILLED_EXPERT_NETWORK: DistilledExpertNetwork = "
        + json.dumps(result["network"], indent=2, sort_keys=True)
        + ";\n"
    )
    ts_path.write_text(ts_module, encoding="utf-8")


def parse_args() -> argparse.Namespace:
    parser = argparse.ArgumentParser(description="Train a PyTorch distilled expert Snake model.")
    parser.add_argument("--episodes-per-size", type=int, default=24)
    parser.add_argument("--seed", type=int, default=11)
    parser.add_argument("--sizes", nargs="+", default=["12x12", "16x16"])
    parser.add_argument("--epochs", type=int, default=4)
    parser.add_argument("--batch-size", type=int, default=256)
    parser.add_argument("--teacher-eval-episodes", type=int, default=3)
    parser.add_argument("--network-eval-episodes", type=int, default=8)
    parser.add_argument("--confidence-threshold", type=float, default=0.7)
    parser.add_argument("--hidden-sizes", nargs="+", type=int, default=[128, 64])
    parser.add_argument(
        "--json-output",
        type=Path,
        default=BASE_DIR / "models/distilled_expert_net.json",
    )
    parser.add_argument(
        "--ts-output",
        type=Path,
        default=BASE_DIR.parent / "src/game/distilledExpertPolicyData.generated.ts",
    )
    return parser.parse_args()


def main() -> None:
    args = parse_args()
    sizes = [parse_size(value) for value in args.sizes]
    result = build_result(
        sizes=sizes,
        episodes_per_size=args.episodes_per_size,
        seed=args.seed,
        hidden_sizes=args.hidden_sizes,
        epochs=args.epochs,
        batch_size=args.batch_size,
        teacher_evaluation_episodes=args.teacher_eval_episodes,
        network_evaluation_episodes=args.network_eval_episodes,
        confidence_threshold=args.confidence_threshold,
    )
    write_outputs(result, args.json_output, args.ts_output)
    print(
        f"Trained distilled expert net on {result['metadata']['collectedSamples']} samples. "
        f"Fallback evaluation score: {result['metadata']['fallbackEvaluationScore']}"
    )


if __name__ == "__main__":
    main()
