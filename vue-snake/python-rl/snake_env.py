from __future__ import annotations

from dataclasses import dataclass
import random
from typing import Dict, List, Optional, Sequence, Tuple


ABSOLUTE_DIRECTIONS = ("up", "right", "down", "left")
RELATIVE_ACTIONS = ("straight", "left", "right")

OFFSETS = {
    "up": (-1, 0),
    "down": (1, 0),
    "left": (0, -1),
    "right": (0, 1),
}


@dataclass(frozen=True)
class SnakeConfig:
    rows: int = 12
    cols: int = 12
    initial_length: int = 3
    max_steps: int = 400


def rotate_direction(direction: str, relative_action: str) -> str:
    index = ABSOLUTE_DIRECTIONS.index(direction)
    if relative_action == "left":
        return ABSOLUTE_DIRECTIONS[(index - 1) % len(ABSOLUTE_DIRECTIONS)]
    if relative_action == "right":
        return ABSOLUTE_DIRECTIONS[(index + 1) % len(ABSOLUTE_DIRECTIONS)]
    return direction


class SnakeEnv:
    def __init__(self, config: SnakeConfig | None = None, seed: int = 7) -> None:
        self.config = config or SnakeConfig()
        self.random = random.Random(seed)
        self.seed_value = seed
        self.snake: List[Tuple[int, int]] = []
        self.direction = "right"
        self.food = (0, 0)
        self.score = 0
        self.steps = 0
        self.done = False

    def reset(self, seed: Optional[int] = None) -> str:
        if seed is not None:
            self.seed_value = seed
            self.random.seed(seed)

        center_row = self.config.rows // 2
        head_col = max(self.config.initial_length - 1, self.config.cols // 2)
        self.snake = [
            (center_row, head_col - offset) for offset in range(self.config.initial_length)
        ]
        self.direction = "right"
        self.food = self._spawn_food()
        self.score = 0
        self.steps = 0
        self.done = False
        return self.state_key()

    def step(self, action_index: int) -> Tuple[str, float, bool, Dict[str, int]]:
        if self.done:
            return self.state_key(), 0.0, True, {"score": self.score, "steps": self.steps}

        relative_action = RELATIVE_ACTIONS[action_index]
        next_direction = rotate_direction(self.direction, relative_action)
        next_head = self._next_position(self.snake[0], next_direction)
        previous_distance = self._food_distance(self.snake[0])

        self.steps += 1

        if not self._inside(next_head):
            self.done = True
            return self.state_key(), -1.0, True, {"score": self.score, "steps": self.steps}

        eats_food = next_head == self.food
        occupied = self.snake if eats_food else self.snake[:-1]
        if next_head in occupied:
            self.done = True
            return self.state_key(), -1.0, True, {"score": self.score, "steps": self.steps}

        self.direction = next_direction
        self.snake.insert(0, next_head)
        if not eats_food:
            self.snake.pop()
        else:
            self.score += 1
            if len(self.snake) == self.config.rows * self.config.cols:
                self.done = True
                return self.state_key(), 2.0, True, {"score": self.score, "steps": self.steps}
            self.food = self._spawn_food()

        if eats_food:
            reward = 2.0
        else:
            next_distance = self._food_distance(self.snake[0])
            reward = -0.02
            if next_distance < previous_distance:
                reward += 0.12
            elif next_distance > previous_distance:
                reward -= 0.04

        if self.steps >= self.config.max_steps:
            self.done = True
            reward -= 0.4

        return self.state_key(), reward, self.done, {"score": self.score, "steps": self.steps}

    def state_key(self) -> str:
        head = self.snake[0]
        left_direction = rotate_direction(self.direction, "left")
        right_direction = rotate_direction(self.direction, "right")

        danger_straight = self._is_danger(self.direction)
        danger_left = self._is_danger(left_direction)
        danger_right = self._is_danger(right_direction)

        food_up = int(self.food[0] < head[0])
        food_down = int(self.food[0] > head[0])
        food_left = int(self.food[1] < head[1])
        food_right = int(self.food[1] > head[1])

        bits = [
            int(danger_straight),
            int(danger_left),
            int(danger_right),
            food_up,
            food_down,
            food_left,
            food_right,
            int(self.direction == "up"),
            int(self.direction == "down"),
            int(self.direction == "left"),
            int(self.direction == "right"),
        ]
        return "".join(str(bit) for bit in bits)

    def _spawn_food(self) -> Tuple[int, int]:
        free_cells = [
            (row, col)
            for row in range(self.config.rows)
            for col in range(self.config.cols)
            if (row, col) not in self.snake
        ]
        return self.random.choice(free_cells)

    def _inside(self, position: Tuple[int, int]) -> bool:
        row, col = position
        return 0 <= row < self.config.rows and 0 <= col < self.config.cols

    def _next_position(self, position: Tuple[int, int], direction: str) -> Tuple[int, int]:
        row_delta, col_delta = OFFSETS[direction]
        return (position[0] + row_delta, position[1] + col_delta)

    def _is_danger(self, direction: str) -> bool:
        next_head = self._next_position(self.snake[0], direction)
        if not self._inside(next_head):
            return True

        occupied = self.snake[:-1]
        return next_head in occupied

    def _food_distance(self, head: Tuple[int, int]) -> int:
        return abs(head[0] - self.food[0]) + abs(head[1] - self.food[1])
