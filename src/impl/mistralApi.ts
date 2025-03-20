import type { MistralModels, MistralMessage, ToolCall } from '../mistral';
export { mistralModels } from '../mistral';

// Add these types to match Mistral's API exactly
export type ChatMessage = {
  role: 'system' | 'user' | 'assistant' | 'tool';
  content: string;
  tool_calls?: ToolCall[];
  tool_call_id?: string;
  name?: string;
};

export type ChatCompletionOptions = {
  model: MistralModels;
  messages: MistralMessage[];
  temperature?: number;
  maxTokens?: number;
  topP?: number;
  stream?: boolean;
  apiKey: string;
  signal?: AbortSignal;
  safe_prompt?: boolean;
  random_seed?: number;
};
  
export type ChatCompletionResponse = {
  id: string;
  object: string;
  created: number;
  model: string;
  choices: Array<{
    index: number;
    message: {
      role: string;
      content: string;
      tool_calls?: ToolCall[];
    };
    finish_reason: 'stop' | 'length' | 'tool_calls';
  }>;
  usage: {
    prompt_tokens: number;
    completion_tokens: number;
    total_tokens: number;
  };
};
