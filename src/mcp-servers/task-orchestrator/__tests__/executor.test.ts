import { CodeExecutor } from '../src/index';

describe('task-orchestrator CodeExecutor integration', () => {
  const executor = new CodeExecutor();

  it('executes python code', async () => {
    const result = await executor.execute('python', 'print(1 + 1)');
    expect(result.exit_code).toBe(0);
    expect(result.output?.trim()).toBe('2');
  });

  it('executes javascript code', async () => {
    const result = await executor.execute('javascript', '3 + 4');
    expect(result.exit_code).toBe(0);
    expect(result.output?.trim()).toBe('7');
  });

  it('executes bash code', async () => {
    const result = await executor.execute('bash', 'echo 42');
    expect(result.exit_code).toBe(0);
    expect(result.output?.trim()).toBe('42');
  });
});
