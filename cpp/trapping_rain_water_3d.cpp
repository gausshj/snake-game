/**
 * 3D接雨水问题 (Trapping Rain Water II)
 *
 * 给定一个 m x n 的矩阵，其中的元素表示每个格子的高度。
 * 计算下雨后能接多少雨水。
 *
 * 算法思路：
 * 1. 使用最小堆从边界开始处理
 * 2. 每次取出最低的边界格子
 * 3. 检查其相邻的未访问格子：
 *    - 如果相邻格子高度 < 当前边界高度，可以接水
 *    - 将相邻格子加入堆（高度取 max(相邻格子高度, 当前边界高度)）
 */

#include <iostream>
#include <vector>
#include <queue>
#include <climits>

using namespace std;

class Solution {
public:
    int trapRainWater(vector<vector<int>>& heightMap) {
        if (heightMap.empty() || heightMap[0].empty()) return 0;

        int m = heightMap.size();
        int n = heightMap[0].size();
        if (m < 3 || n < 3) return 0;

        // 最小堆: (高度, 行, 列)
        priority_queue<vector<int>, vector<vector<int>>, greater<vector<int>>> minHeap;

        // 访问标记
        vector<vector<bool>> visited(m, vector<bool>(n, false));

        // 将边界加入堆
        for (int i = 0; i < m; i++) {
            for (int j = 0; j < n; j++) {
                if (i == 0 || i == m - 1 || j == 0 || j == n - 1) {
                    minHeap.push({heightMap[i][j], i, j});
                    visited[i][j] = true;
                }
            }
        }

        // 方向: 上下左右
        int dirs[4][2] = {{-1, 0}, {1, 0}, {0, -1}, {0, 1}};

        int water = 0;
        int maxHeight = 0;  // 当前边界最大高度

        while (!minHeap.empty()) {
            auto cell = minHeap.top();
            minHeap.pop();

            int h = cell[0];
            int r = cell[1];
            int c = cell[2];

            maxHeight = max(maxHeight, h);

            // 检查四个方向
            for (auto& dir : dirs) {
                int nr = r + dir[0];
                int nc = c + dir[1];

                if (nr >= 0 && nr < m && nc >= 0 && nc < n && !visited[nr][nc]) {
                    visited[nr][nc] = true;

                    // 如果相邻格子高度小于当前最大高度，可以接水
                    if (heightMap[nr][nc] < maxHeight) {
                        water += maxHeight - heightMap[nr][nc];
                    }

                    // 加入堆，高度取 max(原高度, maxHeight)
                    minHeap.push({max(heightMap[nr][nc], maxHeight), nr, nc});
                }
            }
        }

        return water;
    }
};

int main() {
    Solution sol;

    // 测试用例 1
    vector<vector<int>> heightMap1 = {
        {1, 4, 3, 1, 3, 2},
        {3, 2, 1, 3, 2, 4},
        {2, 3, 3, 2, 3, 1}
    };
    cout << "Test 1: " << sol.trapRainWater(heightMap1) << " (expected: 4)" << endl;

    // 测试用例 2
    vector<vector<int>> heightMap2 = {
        {3, 3, 3, 3, 3},
        {3, 2, 2, 2, 3},
        {3, 2, 1, 2, 3},
        {3, 2, 2, 2, 3},
        {3, 3, 3, 3, 3}
    };
    cout << "Test 2: " << sol.trapRainWater(heightMap2) << " (expected: 10)" << endl;

    // 测试用例 3: 简单情况
    vector<vector<int>> heightMap3 = {
        {5, 5, 5, 5},
        {5, 1, 1, 5},
        {5, 5, 5, 5}
    };
    cout << "Test 3: " << sol.trapRainWater(heightMap3) << " (expected: 8)" << endl;

    return 0;
}
