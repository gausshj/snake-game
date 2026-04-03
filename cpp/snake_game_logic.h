#ifndef SNAKE_GAME_LOGIC_H
#define SNAKE_GAME_LOGIC_H

#include <algorithm>
#include <cstddef>
#include <deque>
#include <stdexcept>
#include <vector>

namespace snake {

struct Position {
    int row = 0;
    int col = 0;

    bool operator==(const Position& other) const {
        return row == other.row && col == other.col;
    }

    bool operator!=(const Position& other) const {
        return !(*this == other);
    }
};

enum class Direction {
    Up,
    Down,
    Left,
    Right,
};

struct GameConfig {
    int rows = 14;
    int cols = 24;
    int initial_length = 3;
};

struct GameState {
    std::deque<Position> snake;
    Direction direction = Direction::Right;
    Direction queued_direction = Direction::Right;
    Position food{0, 0};
    int score = 0;
    bool game_over = false;
    bool paused = false;
};

inline bool isOpposite(Direction current, Direction next) {
    return (current == Direction::Up && next == Direction::Down) ||
           (current == Direction::Down && next == Direction::Up) ||
           (current == Direction::Left && next == Direction::Right) ||
           (current == Direction::Right && next == Direction::Left);
}

inline Position nextPosition(const Position& current, Direction direction) {
    switch (direction) {
        case Direction::Up:
            return Position{current.row - 1, current.col};
        case Direction::Down:
            return Position{current.row + 1, current.col};
        case Direction::Left:
            return Position{current.row, current.col - 1};
        case Direction::Right:
            return Position{current.row, current.col + 1};
    }

    return current;
}

inline bool isInsideBoard(const GameConfig& config, const Position& position) {
    return position.row >= 0 && position.row < config.rows &&
           position.col >= 0 && position.col < config.cols;
}

inline bool contains(const std::deque<Position>& snake_body, const Position& target) {
    for (const Position& segment : snake_body) {
        if (segment == target) {
            return true;
        }
    }
    return false;
}

inline std::vector<Position> collectFreeCells(const GameConfig& config,
                                              const std::deque<Position>& snake_body) {
    std::vector<std::vector<bool>> occupied(
        config.rows, std::vector<bool>(config.cols, false));

    for (const Position& segment : snake_body) {
        if (isInsideBoard(config, segment)) {
            occupied[segment.row][segment.col] = true;
        }
    }

    std::vector<Position> free_cells;
    free_cells.reserve(static_cast<std::size_t>(config.rows * config.cols) - snake_body.size());

    for (int row = 0; row < config.rows; ++row) {
        for (int col = 0; col < config.cols; ++col) {
            if (!occupied[row][col]) {
                free_cells.push_back(Position{row, col});
            }
        }
    }

    return free_cells;
}

inline Position selectFoodPosition(const GameConfig& config,
                                   const std::deque<Position>& snake_body,
                                   std::size_t selector) {
    std::vector<Position> free_cells = collectFreeCells(config, snake_body);

    if (free_cells.empty()) {
        throw std::runtime_error("No free cells available for food placement.");
    }

    return free_cells[selector % free_cells.size()];
}

inline GameState createInitialState(const GameConfig& config, std::size_t food_selector = 0) {
    if (config.rows < 3 || config.cols < 3) {
        throw std::invalid_argument("Board must be at least 3x3.");
    }

    if (config.initial_length < 2) {
        throw std::invalid_argument("Initial snake length must be at least 2.");
    }

    if (config.initial_length >= config.cols) {
        throw std::invalid_argument("Board is too narrow for the initial snake length.");
    }

    GameState state;
    const int center_row = config.rows / 2;
    const int head_col = std::max(config.initial_length - 1, config.cols / 2);

    for (int offset = 0; offset < config.initial_length; ++offset) {
        state.snake.push_back(Position{center_row, head_col - offset});
    }

    state.food = selectFoodPosition(config, state.snake, food_selector);
    return state;
}

inline bool queueDirectionChange(GameState& state, Direction next_direction) {
    if (state.game_over || isOpposite(state.direction, next_direction)) {
        return false;
    }

    state.queued_direction = next_direction;
    return true;
}

inline void togglePause(GameState& state) {
    if (!state.game_over) {
        state.paused = !state.paused;
    }
}

inline void restartGame(GameState& state, const GameConfig& config, std::size_t food_selector) {
    state = createInitialState(config, food_selector);
}

inline void step(GameState& state, const GameConfig& config, std::size_t food_selector) {
    if (state.game_over || state.paused) {
        return;
    }

    state.direction = state.queued_direction;

    const Position next_head = nextPosition(state.snake.front(), state.direction);
    if (!isInsideBoard(config, next_head)) {
        state.game_over = true;
        return;
    }

    const bool ate_food = next_head == state.food;
    std::deque<Position> occupied = state.snake;
    if (!ate_food) {
        occupied.pop_back();
    }

    if (contains(occupied, next_head)) {
        state.game_over = true;
        return;
    }

    state.snake.push_front(next_head);
    if (!ate_food) {
        state.snake.pop_back();
        return;
    }

    ++state.score;
    if (static_cast<int>(state.snake.size()) == config.rows * config.cols) {
        state.game_over = true;
        return;
    }

    state.food = selectFoodPosition(config, state.snake, food_selector);
}

}  // namespace snake

#endif
