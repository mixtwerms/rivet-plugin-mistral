export type MistralModel = {
    maxTokens: number;
    cost: {
      prompt: number;
      completion: number;
    };
    displayName: string;
  };
  
  export const mistralModels = {
    'mistral-tiny-latest': {
      maxTokens: 32000,
      cost: {
        prompt: 0.00014,
        completion: 0.00042,
      },
      displayName: 'Mistral Tiny',
    },
    'mistral-small-latest': {
      maxTokens: 32000,
      cost: {
        prompt: 0.00027,
        completion: 0.00081,
      },
      displayName: 'Mistral Small',
    },
    'mistral-medium-latest': {
      maxTokens: 32000,
      cost: {
        prompt: 0.00381,
        completion: 0.01143,
      },
      displayName: 'Mistral Medium',
    },
  } as const;
  
  export type MistralModels = keyof typeof mistralModels;
  
  export const mistralModelOptions = Object.entries(mistralModels).map(([id, { displayName }]) => ({
    value: id,
    label: displayName,
  }));
  
  export type ChatCompletionOptions = {
    model: MistralModels;
    messages: Array<{
      role: 'user' | 'assistant' | 'system';
      content: string;
    }>;
    temperature?: number;
    maxTokens?: number;
    topP?: number;
    stream?: boolean;
    apiKey: string;
    signal?: AbortSignal;
  };
  
  export type ChatCompletionChunk = {
    id: string;
    choices: Array<{
      index: number;
      delta: {
        content?: string;
      };
      finish_reason: string | null;
    }>;
  };
  
  export async function* streamChatCompletions(options: ChatCompletionOptions): AsyncGenerator<ChatCompletionChunk> {
    const response = await fetch('https://api.mistral.ai/v1/chat/completions', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        Authorization: `Bearer ${options.apiKey}`,
      },
      body: JSON.stringify({
        model: options.model,
        messages: options.messages,
        temperature: options.temperature,
        max_tokens: options.maxTokens,
        top_p: options.topP,
        stream: true,
      }),
      signal: options.signal,
    });
  
    if (!response.ok) {
      const text = await response.text();
      throw new Error(`Mistral API error: ${response.status} - ${text}`);
    }
  
    const reader = response.body?.getReader();
    if (!reader) throw new Error('No response body');
  
    const decoder = new TextDecoder();
    let buffer = '';
  
    while (true) {
      const { done, value } = await reader.read();
      if (done) break;
  
      buffer += decoder.decode(value, { stream: true });
      const lines = buffer.split('\n');
      buffer = lines.pop() || '';
  
      for (const line of lines) {
        if (line.trim() === '') continue;
        if (line.startsWith('data: ')) {
          const data = line.slice(6);
          if (data === '[DONE]') continue;
          try {
            const json = JSON.parse(data);
            yield json;
          } catch (e) {
            console.error('Error parsing JSON from stream:', e);
          }
        }
      }
    }
  }
  