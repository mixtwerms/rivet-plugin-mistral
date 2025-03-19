import type {
    ChartNode,
    ChatMessage,
    EditorDefinition,
    Inputs,
    InternalProcessContext,
    NodeId,
    NodeInputDefinition,
    NodeOutputDefinition,
    NodeUIData,
    Outputs,
    PluginNodeImpl,
    PortId,
    ScalarDataValue,
  } from '@ironclad/rivet-core';
  import { nanoid } from 'nanoid/non-secure';
  import { dedent } from 'ts-dedent';
  import retry from 'p-retry';
  import { match } from 'ts-pattern';
  import { streamChatCompletions, type MistralModels, mistralModels, mistralModelOptions } from '../mistral.js';
  import { coerceType, coerceTypeOptional } from '@ironclad/rivet-core';
  import { getInputOrData } from '@ironclad/rivet-core';
  import { isArrayDataValue, getScalarTypeOf } from '@ironclad/rivet-core';
  
  // Node type definitions
  export type MistralChatNode = ChartNode<'mistralChat', MistralChatNodeData>;
  
  export type MistralChatNodeConfigData = {
    model: MistralModels;
    temperature: number;
    maxTokens: number;
    topP: number;
    systemPrompt: string;
  };
  
  export type MistralChatNodeData = MistralChatNodeConfigData & {
    useModelInput: boolean;
    useTemperatureInput: boolean;
    useMaxTokensInput: boolean;
    useTopPInput: boolean;
    useSystemPromptInput: boolean;
    useMessagesInput: boolean;
    cache: boolean;
    useAsGraphPartialOutput?: boolean;
  };
  
  // Temporary cache for responses
  const cache = new Map<string, Outputs>();
  
  export const MistralChatNodeImpl: PluginNodeImpl<MistralChatNode> = {
    create(): MistralChatNode {
      return {
        id: nanoid() as NodeId,
        type: 'mistralChat',
        title: 'Mistral Chat',
        data: {
          model: 'mistral-small-latest',
          useModelInput: false,
  
          temperature: 0.7,
          useTemperatureInput: false,
  
          maxTokens: 1024,
          useMaxTokensInput: false,
  
          topP: 1,
          useTopPInput: false,
  
          systemPrompt: 'You are a helpful assistant.',
          useSystemPromptInput: false,
  
          useMessagesInput: false,
          cache: false,
          useAsGraphPartialOutput: true,
        },
        visualData: {
          x: 0,
          y: 0,
          width: 275,
        },
      };
    },
  
    getInputDefinitions(data): NodeInputDefinition[] {
      const inputs: NodeInputDefinition[] = [];
  
      if (data.useModelInput) {
        inputs.push({
          id: 'model' as PortId,
          title: 'Model',
          dataType: 'string',
          required: false,
        });
      }
  
      if (data.useSystemPromptInput) {
        inputs.push({
          id: 'systemPrompt' as PortId,
          title: 'System Prompt',
          dataType: 'string',
          required: false,
        });
      }
  
      if (data.useTemperatureInput) {
        inputs.push({
          dataType: 'number',
          id: 'temperature' as PortId,
          title: 'Temperature',
        });
      }
  
      if (data.useTopPInput) {
        inputs.push({
          dataType: 'number',
          id: 'top_p' as PortId,
          title: 'Top P',
        });
      }
  
      if (data.useMaxTokensInput) {
        inputs.push({
          dataType: 'number',
          id: 'maxTokens' as PortId,
          title: 'Max Tokens',
        });
      }
  
      if (data.useMessagesInput) {
        inputs.push({
          dataType: 'chat-message[]',
          id: 'messages' as PortId,
          title: 'Messages',
        });
      } else {
        inputs.push({
          dataType: ['chat-message', 'chat-message[]', 'string', 'string[]'] as const,
          id: 'prompt' as PortId,
          title: 'Prompt',
        });
      }
  
      return inputs;
    },
  
    getOutputDefinitions(): NodeOutputDefinition[] {
      return [
        {
          id: 'response' as PortId,
          title: 'Response',
          dataType: 'string',
        },
        {
          id: 'message' as PortId,
          title: 'Message',
          dataType: 'chat-message',
        },
        {
          id: 'all-messages' as PortId,
          title: 'All Messages',
          dataType: 'chat-message[]',
        },
      ];
    },
  
    getEditors(): EditorDefinition<MistralChatNode>[] {
      return [
        {
          type: 'dropdown',
          label: 'Model',
          dataKey: 'model',
          useInputToggleDataKey: 'useModelInput',
          options: mistralModelOptions,
        },
        {
          type: 'string',
          label: 'System Prompt',
          dataKey: 'systemPrompt',
          useInputToggleDataKey: 'useSystemPromptInput',
          multiline: true,
        },
        {
          type: 'number',
          label: 'Temperature',
          dataKey: 'temperature',
          useInputToggleDataKey: 'useTemperatureInput',
          min: 0,
          max: 2,
          step: 0.1,
        },
        {
          type: 'number',
          label: 'Top P',
          dataKey: 'topP',
          useInputToggleDataKey: 'useTopPInput',
          min: 0,
          max: 1,
          step: 0.1,
        },
        {
          type: 'number',
          label: 'Max Tokens',
          dataKey: 'maxTokens',
          useInputToggleDataKey: 'useMaxTokensInput',
          min: 1,
          step: 1,
        },
        {
          type: 'toggle',
          label: 'Use Messages Input',
          dataKey: 'useMessagesInput',
        },
        {
          type: 'toggle',
          label: 'Cache (same inputs, same outputs)',
          dataKey: 'cache',
        },
        {
          type: 'toggle',
          label: 'Use for subgraph partial output',
          dataKey: 'useAsGraphPartialOutput',
        },
      ];
    },
  
    getUIData(): NodeUIData {
      return {
        contextMenuTitle: 'Mistral Chat',
        group: ['AI', 'Mistral'],
        infoBoxBody: dedent`
          Makes a call to a Mistral AI chat model. Supports all available Mistral models
          and includes various parameters for fine-tuning the response.
        `,
        infoBoxTitle: 'Mistral Chat Node',
      };
    },
  
    getBody(data): string {
      return dedent`
        Model: ${mistralModels[data.model]?.displayName ?? data.model}
        Temperature: ${data.temperature}
        Max Tokens: ${data.maxTokens}
        Top P: ${data.topP}
      `;
    },
  
    async process(data, inputs: Inputs, context: InternalProcessContext): Promise<Outputs> {
      const output: Outputs = {};
  
      try {
        return await retry(
          async () => {
            // Get API key from plugin config
            const apiKey = context.getPluginConfig('mistralApiKey');
            if (!apiKey) {
              throw new Error('Mistral API key not configured. Please add your API key in the plugin configuration.');
            }
  
            // Get input values with fallbacks to node data
            const model = getInputOrData(data, inputs, 'model', 'string') ?? data.model;
            const temperature = getInputOrData(data, inputs, 'temperature', 'number') ?? data.temperature;
            const maxTokens = getInputOrData(data, inputs, 'maxTokens', 'number') ?? data.maxTokens;
            const topP = getInputOrData(data, inputs, 'topP', 'number') ?? data.topP;
            const systemPrompt = getInputOrData(data, inputs, 'systemPrompt', 'string') ?? data.systemPrompt;
  
            // Prepare messages array
            let messages: Array<{ role: 'user' | 'assistant' | 'system'; content: string }> = [];
  
            // Handle messages input if enabled
            if (data.useMessagesInput && inputs['messages' as PortId]) {
              const inputMessages = coerceType(inputs['messages' as PortId], 'chat-message[]');
              if (!inputMessages) {
                throw new Error('Invalid messages input format');
              }
  
              messages = inputMessages.map(msg => ({
                role: msg.type as 'user' | 'assistant' | 'system',
                content: typeof msg.message === 'string' ? msg.message : msg.message.join(' ')
              }));
            } else {
              // Add system message if provided
              if (systemPrompt?.trim()) {
                messages.push({
                  role: 'system',
                  content: systemPrompt
                });
              }
  
              // Handle prompt input
              const promptInput = inputs['prompt' as PortId];
              if (!promptInput) {
                throw new Error('No prompt provided. Please connect a string to the prompt input.');
              }
  
              // Convert prompt input to messages
              const chatMessages = match(promptInput)
                .with({ type: 'chat-message' }, (p) => [p.value])
                .with({ type: 'chat-message[]' }, (p) => p.value)
                .with({ type: 'string' }, (p): ChatMessage[] => [{ type: 'user', message: p.value }])
                .with({ type: 'string[]' }, (p): ChatMessage[] => p.value.map((v) => ({ type: 'user', message: v })))
                .otherwise((p): ChatMessage[] => {
                  if (isArrayDataValue(p)) {
                    const stringValues = (p.value as readonly unknown[]).map((v) =>
                      coerceType(
                        {
                          type: getScalarTypeOf(p.type),
                          value: v,
                        } as ScalarDataValue,
                        'string',
                      ),
                    );
                    return stringValues.filter((v) => v != null).map((v) => ({ type: 'user', message: v }));
                  }
                  const coercedMessage = coerceType(p, 'chat-message');
                  if (coercedMessage != null) {
                    return [coercedMessage];
                  }
                  const coercedString = coerceType(p, 'string');
                  return coercedString != null ? [{ type: 'user', message: coerceType(p, 'string') }] : [];
                });
  
              // Convert chat messages to Mistral format
              messages.push(...chatMessages.map(msg => ({
                role: msg.type as 'user' | 'assistant' | 'system',
                content: typeof msg.message === 'string' ? msg.message : msg.message.join(' ')
              })));
            }
  
            // Prepare completion options
            const completionOptions = {
              model,
              messages,
              temperature,
              maxTokens,
              topP,
              stream: true,
              apiKey,
              signal: context.signal,
            };
  
            // Check cache if enabled
            const cacheKey = JSON.stringify(completionOptions);
            if (data.cache) {
              const cached = cache.get(cacheKey);
              if (cached) {
                return cached;
              }
            }
  
            const startTime = Date.now();
            const chunks = streamChatCompletions(completionOptions);
  
            // Process the response chunks
            const responseParts: string[] = [];
  
            for await (const chunk of chunks) {
              if (chunk.choices[0]?.delta?.content) {
                responseParts.push(chunk.choices[0].delta.content);
  
                // Update partial outputs
                output['response' as PortId] = {
                  type: 'string',
                  value: responseParts.join('').trim(),
                };
  
                output['message' as PortId] = {
                  type: 'chat-message',
                  value: {
                    type: 'assistant',
                    message: responseParts.join('').trim(),
                  },
                };
  
                output['all-messages' as PortId] = {
                  type: 'chat-message[]',
                  value: [
                    ...messages.map(m => ({
                      type: m.role as 'user' | 'assistant' | 'system',
                      message: m.content,
                    })),
                    {
                      type: 'assistant',
                      message: responseParts.join('').trim(),
                    },
                  ],
                };
  
                if (data.useAsGraphPartialOutput) {
                  context.onPartialOutputs?.(output);
                }
              }
            }
  
            if (responseParts.length === 0) {
              throw new Error('No response received from Mistral');
            }
  
            // Calculate token counts and costs
            const tokenInfo = {
              requestTokens: await context.tokenizer.getTokenCountForString(
                messages.map(m => m.content).join(' '),
                { node: context.node, model }
              ),
              responseTokens: await context.tokenizer.getTokenCountForString(
                responseParts.join(''),
                { node: context.node, model }
              ),
            };
  
            output['requestTokens' as PortId] = { type: 'number', value: tokenInfo.requestTokens };
            output['responseTokens' as PortId] = { type: 'number', value: tokenInfo.responseTokens };
  
            // Calculate cost if model info is available
            const modelInfo = mistralModels[model as MistralModels];
            if (modelInfo) {
              const cost =
                modelInfo.cost.prompt * tokenInfo.requestTokens +
                modelInfo.cost.completion * tokenInfo.responseTokens;
              output['cost' as PortId] = { type: 'number', value: cost };
            }
  
            // Add duration
            output['duration' as PortId] = {
              type: 'number',
              value: Date.now() - startTime,
            };
  
            // Cache the result if enabled
            if (data.cache) {
              Object.freeze(output);
              cache.set(cacheKey, output);
            }
  
            return output;
          },
          {
            retries: 5,
            factor: 2,
            minTimeout: 1000,
            maxTimeout: 60000,
            randomize: true,
            signal: context.signal,
            onFailedAttempt(error) {
              context.trace(`Mistral API call failed, retrying: ${error.toString()}`);
              if (context.signal.aborted) {
                throw new Error('Aborted');
              }
            },
          }
        );
      } catch (error) {
        throw new Error(`Error in Mistral Chat Node: ${(error as Error).message}`);
      }
    },
  };
  
  export const mistralChatNode = pluginNodeDefinition(MistralChatNodeImpl, 'Chat');
  