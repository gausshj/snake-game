#include "snake_game_logic.h"

#include <chrono>
#include <cctype>
#include <cstddef>
#include <cstdint>
#include <fcntl.h>
#include <iostream>
#include <random>
#include <string>
#include <termios.h>
#include <thread>
#include <unistd.h>
#include <vector>

namespace {

using snake::Direction;
using snake::GameConfig;
using snake::GameState;
using snake::Position;

constexpr GameConfig kConfig{14, 24, 3};
constexpr auto kTickInterval = std::chrono::milliseconds(140);

class TerminalModeGuard {
public:
    TerminalModeGuard() {
        if (tcgetattr(STDIN_FILENO, &original_termios_) == -1) {
            throw std::runtime_error("Unable to read terminal attributes.");
        }

        const int current_flags = fcntl(STDIN_FILENO, F_GETFL, 0);
        if (current_flags == -1) {
            throw std::runtime_error("Unable to read terminal flags.");
        }

        original_flags_ = current_flags;

        termios raw_mode = original_termios_;
        raw_mode.c_lflag &= static_cast<unsigned long>(~(ICANON | ECHO));
        raw_mode.c_cc[VMIN] = 0;
        raw_mode.c_cc[VTIME] = 0;

        if (tcsetattr(STDIN_FILENO, TCSAFLUSH, &raw_mode) == -1) {
            throw std::runtime_error("Unable to enable raw terminal mode.");
        }

        if (fcntl(STDIN_FILENO, F_SETFL, current_flags | O_NONBLOCK) == -1) {
            throw std::runtime_error("Unable to set non-blocking terminal input.");
        }

        std::cout << "\x1b[?25l\x1b[2J";
    }

    ~TerminalModeGuard() {
        tcsetattr(STDIN_FILENO, TCSAFLUSH, &original_termios_);
        fcntl(STDIN_FILENO, F_SETFL, original_flags_);
        std::cout << "\x1b[?25h\x1b[0m\x1b[2J\x1b[H" << std::flush;
    }

    TerminalModeGuard(const TerminalModeGuard&) = delete;
    TerminalModeGuard& operator=(const TerminalModeGuard&) = delete;

private:
    termios original_termios_{};
    int original_flags_ = 0;
};

std::size_t randomSelector(std::mt19937& generator) {
    return static_cast<std::size_t>(generator());
}

Direction directionFromArrow(char code) {
    switch (code) {
        case 'A':
            return Direction::Up;
        case 'B':
            return Direction::Down;
        case 'C':
            return Direction::Right;
        case 'D':
            return Direction::Left;
        default:
            return Direction::Right;
    }
}

void appendPendingInput(std::string& pending_input) {
    char buffer[32];
    ssize_t bytes_read = 0;

    while ((bytes_read = read(STDIN_FILENO, buffer, sizeof(buffer))) > 0) {
        pending_input.append(buffer, buffer + bytes_read);
    }
}

void handleKey(GameState& state,
               bool& running,
               char key,
               const GameConfig& config,
               std::mt19937& generator) {
    switch (std::tolower(static_cast<unsigned char>(key))) {
        case 'w':
            snake::queueDirectionChange(state, Direction::Up);
            break;
        case 's':
            snake::queueDirectionChange(state, Direction::Down);
            break;
        case 'a':
            snake::queueDirectionChange(state, Direction::Left);
            break;
        case 'd':
            snake::queueDirectionChange(state, Direction::Right);
            break;
        case 'p':
        case ' ':
            snake::togglePause(state);
            break;
        case 'r':
            snake::restartGame(state, config, randomSelector(generator));
            break;
        case 'q':
            running = false;
            break;
        default:
            break;
    }
}

void processPendingInput(std::string& pending_input,
                         GameState& state,
                         bool& running,
                         const GameConfig& config,
                         std::mt19937& generator) {
    std::size_t index = 0;

    while (index < pending_input.size()) {
        const char current = pending_input[index];

        if (current == '\x1b') {
            if (index + 2 >= pending_input.size()) {
                break;
            }

            if (pending_input[index + 1] == '[') {
                snake::queueDirectionChange(state, directionFromArrow(pending_input[index + 2]));
                index += 3;
                continue;
            }
        }

        handleKey(state, running, current, config, generator);
        ++index;
    }

    pending_input.erase(0, index);
}

void render(const GameState& state, const GameConfig& config) {
    std::vector<std::string> board(
        config.rows, std::string(static_cast<std::size_t>(config.cols), ' '));

    board[state.food.row][state.food.col] = '*';

    for (std::size_t index = 0; index < state.snake.size(); ++index) {
        const Position& segment = state.snake[index];
        board[segment.row][segment.col] = index == 0 ? '@' : 'o';
    }

    std::cout << "\x1b[H";
    std::cout << "Snake  Score: " << state.score;
    if (state.paused) {
        std::cout << "  [Paused]";
    } else if (state.game_over) {
        std::cout << "  [Game Over]";
    }
    std::cout << "\n";

    std::cout << '+'
              << std::string(static_cast<std::size_t>(config.cols), '-')
              << "+\n";

    for (const std::string& row : board) {
        std::cout << '|' << row << "|\n";
    }

    std::cout << '+'
              << std::string(static_cast<std::size_t>(config.cols), '-')
              << "+\n";
    std::cout << "Controls: arrows/WASD move, P or Space pause, R restart, Q quit\n";

    if (state.game_over) {
        std::cout << "You hit a wall or yourself. Press R to restart.\n";
    } else {
        std::cout << "Eat food (*) to grow. Reverse turns are blocked.\n";
    }

    std::cout << std::flush;
}

}  // namespace

int main() {
    try {
        std::random_device device;
        std::mt19937 generator(device());
        GameState state = snake::createInitialState(kConfig, randomSelector(generator));
        TerminalModeGuard terminal_guard;

        bool running = true;
        std::string pending_input;
        auto last_tick = std::chrono::steady_clock::now();

        while (running) {
            appendPendingInput(pending_input);
            processPendingInput(pending_input, state, running, kConfig, generator);

            const auto now = std::chrono::steady_clock::now();
            if (state.paused || state.game_over) {
                last_tick = now;
            } else {
                while (now - last_tick >= kTickInterval) {
                    snake::step(state, kConfig, randomSelector(generator));
                    last_tick += kTickInterval;
                }
            }

            render(state, kConfig);
            std::this_thread::sleep_for(std::chrono::milliseconds(16));
        }
    } catch (const std::exception& error) {
        std::cerr << "Snake failed to start: " << error.what() << '\n';
        return 1;
    }

    return 0;
}
