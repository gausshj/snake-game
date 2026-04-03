CXX ?= c++
CXXFLAGS ?= -std=c++17 -Wall -Wextra -pedantic
BINDIR ?= bin

.PHONY: all test clean

all: $(BINDIR)/snake_game

$(BINDIR):
	mkdir -p $(BINDIR)

$(BINDIR)/snake_game: snake_game.cpp snake_game_logic.h | $(BINDIR)
	$(CXX) $(CXXFLAGS) snake_game.cpp -o $(BINDIR)/snake_game

$(BINDIR)/snake_game_tests: snake_game_tests.cpp snake_game_logic.h | $(BINDIR)
	$(CXX) $(CXXFLAGS) snake_game_tests.cpp -o $(BINDIR)/snake_game_tests

test: $(BINDIR)/snake_game_tests
	./$(BINDIR)/snake_game_tests

clean:
	rm -rf $(BINDIR)
