from __future__ import annotations

from collections import deque
from typing import Deque, Dict, List, Optional, Sequence, Tuple

from snake_env import rotate_direction


DIRECTIONS = ("up", "down", "left", "right")
DIRECTION_ORDER = ("up", "right", "down", "left")
RELATIVE_ACTIONS = ("straight", "left", "right")
WINDOW_RADIUS = 2

OFFSETS = {
    "up": (-1, 0),
    "down": (1, 0),
    "left": (0, -1),
    "right": (0, 1),
}

OPPOSITE_DIRECTIONS = {
    "up": "down",
    "down": "up",
    "left": "right",
    "right": "left",
}


GameState = Dict[str, object]
Position = Tuple[int, int]


def clone_state(state: GameState) -> GameState:
    return {
        "direction": state["direction"],
        "food": tuple(state["food"]),
        "game_over": state["game_over"],
        "paused": state["paused"],
        "queued_direction": state["queued_direction"],
        "score": state["score"],
        "started": state["started"],
        "snake": [tuple(segment) for segment in state["snake"]],
    }


def to_teacher_state(env: object) -> GameState:
    return {
        "direction": env.direction,
        "food": tuple(env.food),
        "game_over": env.done,
        "paused": False,
        "queued_direction": env.direction,
        "score": env.score,
        "started": True,
        "snake": [tuple(segment) for segment in env.snake],
    }


def position_key(position: Position) -> str:
    return f"{position[0]}:{position[1]}"


def positions_equal(left: Position, right: Position) -> bool:
    return left[0] == right[0] and left[1] == right[1]


def is_opposite_direction(current: str, next_direction: str) -> bool:
    return OPPOSITE_DIRECTIONS[current] == next_direction


def next_head_position(head: Position, direction: str) -> Position:
    row_delta, col_delta = OFFSETS[direction]
    return (head[0] + row_delta, head[1] + col_delta)


def is_inside_board(config: object, position: Position) -> bool:
    return 0 <= position[0] < config.rows and 0 <= position[1] < config.cols


def contains_position(snake: Sequence[Position], target: Position) -> bool:
    return any(positions_equal(segment, target) for segment in snake)


def request_direction(state: GameState, next_direction: str) -> GameState:
    if state["game_over"] or next_direction not in DIRECTIONS:
        return state

    if is_opposite_direction(state["direction"], next_direction):
        return state

    next_state = dict(state)
    next_state["queued_direction"] = next_direction
    next_state["started"] = True
    return next_state


def get_occupied_after_move(state: GameState, next_head: Position) -> List[Position]:
    snake = list(state["snake"])
    eats_food = positions_equal(next_head, state["food"])
    return snake if eats_food else snake[:-1]


def is_safe_move(state: GameState, config: object, direction: str) -> bool:
    if is_opposite_direction(state["direction"], direction):
        return False

    next_head = next_head_position(state["snake"][0], direction)
    if not is_inside_board(config, next_head):
        return False

    return not contains_position(get_occupied_after_move(state, next_head), next_head)


def select_food_position(config: object, snake: Sequence[Position], selector: int = 0) -> Position:
    occupied = {position_key(segment) for segment in snake}
    free_cells: List[Position] = []

    for row in range(config.rows):
        for col in range(config.cols):
            candidate = (row, col)
            if position_key(candidate) not in occupied:
                free_cells.append(candidate)

    if not free_cells:
        raise ValueError("No free cells available for food placement.")

    return free_cells[abs(selector) % len(free_cells)]


def step_state(state: GameState, config: object, food_selector: int = 0) -> GameState:
    if state["game_over"] or state["paused"] or not state["started"]:
        return state

    direction = (
        state["direction"]
        if is_opposite_direction(state["direction"], state["queued_direction"])
        else state["queued_direction"]
    )

    next_head = next_head_position(state["snake"][0], direction)
    if not is_inside_board(config, next_head):
        next_state = dict(state)
        next_state["direction"] = direction
        next_state["queued_direction"] = direction
        next_state["game_over"] = True
        return next_state

    eats_food = positions_equal(next_head, state["food"])
    occupied = get_occupied_after_move(state, next_head)
    if contains_position(occupied, next_head):
        next_state = dict(state)
        next_state["direction"] = direction
        next_state["queued_direction"] = direction
        next_state["game_over"] = True
        return next_state

    snake = [next_head, *state["snake"]]
    if not eats_food:
        snake.pop()

    next_state = dict(state)
    next_state["direction"] = direction
    next_state["queued_direction"] = direction
    next_state["snake"] = snake

    if not eats_food:
        return next_state

    score = state["score"] + 1
    next_state["score"] = score
    if len(snake) == config.rows * config.cols:
        next_state["game_over"] = True
        return next_state

    next_state["food"] = select_food_position(config, snake, food_selector)
    return next_state


def direction_priority(state: GameState, target: Position) -> List[str]:
    head = state["snake"][0]

    def sort_key(direction: str) -> Tuple[int, int]:
        candidate = next_head_position(head, direction)
        distance = abs(candidate[0] - target[0]) + abs(candidate[1] - target[1])
        direction_bias = 0 if direction == state["direction"] else 1
        return (distance, direction_bias)

    return sorted(DIRECTIONS, key=sort_key)


def find_path(state: GameState, config: object, target: Position) -> List[str]:
    start = state["snake"][0]
    tail = state["snake"][-1]
    blocked = {
        position_key(segment)
        for segment in state["snake"][1:-1]
        if not positions_equal(segment, target)
    }

    if not positions_equal(target, tail):
        blocked.add(position_key(tail))
        blocked.discard(position_key(target))

    queue: Deque[Position] = deque([start])
    previous: Dict[str, Optional[Tuple[str, str]]] = {position_key(start): None}

    while queue:
        current = queue.popleft()
        if positions_equal(current, target):
            directions: List[str] = []
            cursor = position_key(current)
            while previous[cursor] is not None:
                direction, parent = previous[cursor]
                directions.append(direction)
                cursor = parent
            directions.reverse()
            return directions

        for direction in direction_priority(state, target):
            candidate = next_head_position(current, direction)
            key = position_key(candidate)

            if not is_inside_board(config, candidate) or key in blocked or key in previous:
                continue

            previous[key] = (direction, position_key(current))
            queue.append(candidate)

    return []


def simulate_path(state: GameState, config: object, directions: Sequence[str]) -> GameState:
    simulated = clone_state(state)
    for direction in directions:
        simulated = request_direction(simulated, direction)
        simulated = step_state(simulated, config, 0)
        if simulated["game_over"]:
            break
    return simulated


def path_keeps_tail_reachable(state: GameState, config: object, path_to_food: Sequence[str]) -> bool:
    if not path_to_food:
        return False

    simulated = simulate_path(state, config, path_to_food)
    if simulated["game_over"]:
        return False

    tail = simulated["snake"][-1]
    if positions_equal(simulated["snake"][0], tail):
        return True

    return len(find_path(simulated, config, tail)) > 0


def choose_fallback_direction(state: GameState, config: object) -> str:
    safe_directions = [direction for direction in DIRECTIONS if is_safe_move(state, config, direction)]
    if not safe_directions:
        return state["direction"]

    center = (config.rows // 2, config.cols // 2)

    def sort_key(direction: str) -> Tuple[int, int]:
        candidate = next_head_position(state["snake"][0], direction)
        distance = abs(candidate[0] - center[0]) + abs(candidate[1] - center[1])
        direction_bias = 0 if direction == state["direction"] else 1
        return (distance, direction_bias)

    return sorted(safe_directions, key=sort_key)[0]


def compute_rule_direction(state: GameState, config: object) -> str:
    if state["game_over"] or state["paused"] or not state["started"]:
        return state["direction"]

    path_to_food = find_path(state, config, state["food"])
    if path_to_food and path_keeps_tail_reachable(state, config, path_to_food):
        return path_to_food[0]

    tail = state["snake"][-1]
    path_to_tail = find_path(state, config, tail)
    if path_to_tail:
        return path_to_tail[0]

    return choose_fallback_direction(state, config)


def direction_to_relative(current: str, target: str) -> Optional[str]:
    current_index = DIRECTION_ORDER.index(current)
    target_index = DIRECTION_ORDER.index(target)
    delta = (target_index - current_index) % len(DIRECTION_ORDER)

    if delta == 0:
        return "straight"
    if delta == 1:
        return "right"
    if delta == 3:
        return "left"
    return None


def project_relative_offset(direction: str, forward: int, right: int) -> Position:
    if direction == "up":
        return (-forward, right)
    if direction == "right":
        return (right, forward)
    if direction == "down":
        return (forward, -right)
    return (-right, -forward)


def rotate_food_delta(direction: str, head: Position, food: Position) -> Tuple[int, int]:
    row_delta = food[0] - head[0]
    col_delta = food[1] - head[1]

    if direction == "up":
        return (-row_delta, col_delta)
    if direction == "right":
        return (col_delta, row_delta)
    if direction == "down":
        return (row_delta, -col_delta)
    return (-col_delta, -row_delta)


def normalize_delta(value: int, scale: int) -> float:
    if scale <= 0:
        return 0.0
    return max(-1.0, min(1.0, value / scale))


def distilled_feature_vector(state: GameState, config: object) -> List[float]:
    head = state["snake"][0]
    body = {position_key(segment) for segment in state["snake"][1:]}
    food_forward, food_right = rotate_food_delta(state["direction"], head, state["food"])
    features: List[float] = []

    for forward in range(WINDOW_RADIUS, -WINDOW_RADIUS - 1, -1):
        for right in range(-WINDOW_RADIUS, WINDOW_RADIUS + 1):
            wall = 0.0
            body_value = 0.0
            food_value = 0.0
            self_value = 0.0

            if forward == 0 and right == 0:
                self_value = 1.0
            else:
                row_offset, col_offset = project_relative_offset(state["direction"], forward, right)
                candidate = (head[0] + row_offset, head[1] + col_offset)

                if not is_inside_board(config, candidate):
                    wall = 1.0
                elif position_key(candidate) in body:
                    body_value = 1.0
                elif positions_equal(candidate, state["food"]):
                    food_value = 1.0

            features.extend([wall, body_value, food_value, self_value])

    features.extend(
        [
            normalize_delta(food_forward, max(1, config.rows - 1)),
            normalize_delta(food_right, max(1, config.cols - 1)),
            float(is_safe_move(state, config, state["direction"])),
            float(is_safe_move(state, config, rotate_direction(state["direction"], "left"))),
            float(is_safe_move(state, config, rotate_direction(state["direction"], "right"))),
            len(state["snake"]) / float(config.rows * config.cols),
        ]
    )

    return features
