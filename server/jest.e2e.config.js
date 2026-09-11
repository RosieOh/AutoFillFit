/** @type {import('jest').Config} */
module.exports = {
  preset: 'ts-jest',
  testEnvironment: 'node',
  rootDir: 'test',
  testRegex: '.*\.e2e-spec\.ts$',
  moduleFileExtensions: ['js', 'json', 'ts'],
  // 하나의 DB를 공유하고 테스트 간 TRUNCATE로 격리하므로 순차 실행한다.
  maxWorkers: 1,
  testTimeout: 30_000,
};
