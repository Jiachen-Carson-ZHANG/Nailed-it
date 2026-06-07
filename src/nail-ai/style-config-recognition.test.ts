import { describe, expect, it } from 'vitest';
import {
  buildStyleNamePrompt,
  parseStyleNameOutput,
  styleNameResponseFormat,
} from './style-config-recognition';

describe('parseStyleNameOutput', () => {
  it('accepts the exact naming contract', () => {
    expect(parseStyleNameOutput({ name: '猫眼星河', description: '蓝色猫眼光泽。' })).toEqual({
      name: '猫眼星河',
      description: '蓝色猫眼光泽。',
    });
  });

  it('rejects malformed or prose-wrapped model output', () => {
    expect(() => parseStyleNameOutput({ name: '', description: 'missing name' })).toThrow(
      'invalid_style_name_output',
    );
    expect(() => parseStyleNameOutput('Here is the answer: {"name":"猫眼"}')).toThrow(
      'invalid_style_name_output',
    );
    expect(() =>
      parseStyleNameOutput({ name: '猫眼', description: '蓝色', extra: true }),
    ).toThrow('invalid_style_name_output');
  });

  it('declares a strict JSON-schema response contract', () => {
    expect(styleNameResponseFormat.type).toBe('json_schema');
    expect(styleNameResponseFormat.json_schema.strict).toBe(true);
  });

  it('builds language-aware naming prompts', () => {
    expect(buildStyleNamePrompt('zh-CN')).toContain('Return the result in Simplified Chinese.');
    expect(buildStyleNamePrompt('en')).toContain('Return the result in English.');
  });
});
