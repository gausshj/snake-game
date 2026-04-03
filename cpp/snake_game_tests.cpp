#include "snake_game_logic.h"

#include <cassert>
#include <deque>
#include <iostream>

namespace {

using snake::Direction;
using snake::GameConfig;
using snake::GameState;
using snake::Position;

void assertPosition(const Position& actual, int expected_row, int expected_col) {
    assert(actual.row == expected_row);
    assert(actual.col == expected_col);
}

GameState makeState(std::deque<Position> snake_body,
                    Direction direction,
                    Position food,
                    int score = 0) {
    GameState state;
    state.snake = std::move(snake_body);
    state.direction = direction;
    state.queued_direction = direction;
    state.food = food;
    state.score = score;
    return state;
}

void testInitialState() {
    const GameConfig config{7, 7, 3};
    const GameState state = snake::createInitialState(config, 0);

    assert(state.snake.size() == 3);
    assertPosition(state.snake[0], 3, 3);
    assertPosition(state.snake[1], 3, 2);
    assertPosition(state.snake[2], 3, 1);
    assertPosition(state.food, 0, 0);
}

void testMovementStep() {
    const GameConfig config{7, 7, 3};
    GameState state = snake::createInitialState(config, 0);

    snake::step(state, config, 0);

    assertPosition(state.snake[0], 3, 4);
    assertPosition(state.snake[1], 3, 3);
    assertPosition(state.snake[2], 3, 2);
    assert(state.score == 0);
    assert(!state.game_over);
}

void testDirectionQueueRejectsReverse() {
    const GameConfig config{7, 7, 3};
    GameState state = snake::createInitialState(config, 0);

    const bool accepted = snake::queueDirectionChange(state, Direction::Left);
    snake::step(state, config, 0);

    assert(!accepted);
    assertPosition(state.snake[0], 3, 4);
}

void testGrowthAndRespawn() {
    const GameConfig config{5, 5, 3};
    GameState state = makeState(
        {{2, 2}, {2, 1}, {2, 0}},
        Direction::Right,
        Position{2, 3});

    snake::step(state, config, 0);

    assert(state.snake.size() == 4);
    assertPosition(state.snake[0], 2, 3);
    assert(state.score == 1);
    assertPosition(state.food, 0, 0);
}

void testWallCollision() {
    const GameConfig config{5, 5, 3};
    GameState state = makeState(
        {{0, 2}, {0, 1}, {0, 0}},
        Direction::Up,
        Position{4, 4});

    snake::step(state, config, 0);

    assert(state.game_over);
}

void testSelfCollision() {
    const GameConfig config{6, 6, 3};
    GameState state = makeState(
        {{2, 2}, {2, 1}, {1, 1}, {1, 2}, {1, 3}, {2, 3}},
        Direction::Up,
        Position{5, 5});

    snake::step(state, config, 0);

    assert(state.game_over);
}

void testFoodSelectionSkipsOccupiedCells() {
    const GameConfig config{2, 3, 2};
    const Position food = snake::selectFoodPosition(
        config,
        std::deque<Position>{{0, 0}, {0, 1}},
        0);

    assertPosition(food, 0, 2);
}

}  // namespace

int main() {
    testInitialState();
    testMovementStep();
    testDirectionQueueRejectsReverse();
    testGrowthAndRespawn();
    testWallCollision();
    testSelfCollision();
    testFoodSelectionSkipsOccupiedCells();

    std::cout << "All Snake logic tests passed.\n";
    return 0;
}
