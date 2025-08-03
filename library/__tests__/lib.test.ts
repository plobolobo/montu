import { exampleFunction } from '../src/lib';

describe('exampleFunction', () => {
  it('should process input correctly', () => {
    const input = 'test';
    const result = exampleFunction(input);
    expect(result).toBe('Processed: test');
  });
});