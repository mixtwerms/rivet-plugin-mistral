import type {
  ChartNode,
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
  Rivet,
  ChatMessage as RivetChatMessage,
} from '@ironclad/rivet-core';
import { match } from 'ts-pattern';
import { 
  mistralModels, 
  mistralModelOptions, 
  type MistralModels, 
  type MistralMessage,
  convertToMistralMessage,
  createAssistantMessage,
  createSystemMessage,
  createUserMessage,
} from '../mistral.js';

export type MistralChatNode = ChartNode<'mistralChat', MistralChatNodeData>;

export type MistralChatNodeData = {
  model: MistralModels;
  useModelInput: boolean;
  temperature: number;
  useTemperatureInput: boolean;
  maxTokens: number;
  useMaxTokensInput: boolean;
  topP: number;
  useTopPInput: boolean;
  systemPrompt: string;
  useSystemPromptInput: boolean;
  useMessagesInput: boolean;
  useStream: boolean;
  useSafePrompt: boolean;
  useRandomSeed?: boolean;
  randomSeed?: number;
  currency: 'USD' | 'EUR'; // Add currency preference
};

export default function (rivet: typeof Rivet) {
  const nodeImpl: PluginNodeImpl<MistralChatNode> = {
    create(): MistralChatNode {
      return {
        id: rivet.newId<NodeId>(),
        type: 'mistralChat',
        title: 'Mistral Chat',
        data: {
          model: 'mistral-large-latest',
          useModelInput: false,
          temperature: 0.5,
          useTemperatureInput: false,
          maxTokens: 4096,
          useMaxTokensInput: false,
          topP: 1,
          useTopPInput: false,
          systemPrompt: 'You are a helpful assistant.',
          useSystemPromptInput: true,
          useMessagesInput: false,
          useStream: true,
          useSafePrompt: false,
          useRandomSeed: false,
          randomSeed: undefined,
          currency: 'USD', // Default to USD
        },
        visualData: {
          x: 0,
          y: 0,
          width: 300,
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
          dataType: ['chat-message', 'chat-message[]', 'string', 'string[]'],
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
          id: 'messages' as PortId,
          title: 'All Messages',
          dataType: 'chat-message[]',
        },
        {
          id: 'tokenDetails' as PortId,
          title: 'Token Details',
          dataType: 'object',
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
        },
        {
          type: 'number',
          label: 'Temperature',
          dataKey: 'temperature',
          useInputToggleDataKey: 'useTemperatureInput',
          min: 0,
          max: 1.5,
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
          min: 0,
          step: 1,
        },
        {
          type: 'toggle',
          label: 'Use Messages Input',
          dataKey: 'useMessagesInput',
        },
        {
          type: 'toggle',
          label: 'Stream Responses',
          dataKey: 'useStream',
        },
        {
          type: 'toggle',
          label: 'Use Safe Prompt',
          dataKey: 'useSafePrompt',
        },
        {
          type: 'toggle',
          label: 'Use Random Seed',
          dataKey: 'useRandomSeed',
        },
        {
          type: 'number',
          label: 'Random Seed',
          dataKey: 'randomSeed',
          min: 0,
          step: 1,
        },
        {
          type: 'dropdown',
          label: 'Currency',
          dataKey: 'currency',
          options: [
            { value: 'USD', label: 'USD ($)' },
            { value: 'EUR', label: 'EUR (€)' },
          ],
        },
      ];
    },

    getUIData(): NodeUIData {
      return {
        contextMenuTitle: 'Mistral Chat',
        group: 'AI/Chat (Mistral)',
        infoBoxBody: `Makes a call to Mistral AI's chat completion API. Supports all available Mistral models and includes various parameters for fine-tuning the response.`,
        infoBoxTitle: 'Mistral Chat Node',
      };
    },

    getBody(data): string {
      const modelInfo = mistralModels[data.model] || { 
        displayName: data.model, 
        cost: { 
          prompt: { USD: "-", EUR: "-" }, 
          completion: { USD: "-", EUR: "-" } 
        } 
      };
      
      // Get pricing for the selected currency
      const promptPrice = modelInfo.cost.prompt[data.currency];
      const completionPrice = modelInfo.cost.completion[data.currency];
      
      return `Model: ${modelInfo.displayName}
Temperature: ${data.temperature}
Max Tokens: ${data.maxTokens}
Top P: ${data.topP}
${promptPrice}/1M prompt tokens
${completionPrice}/1M completion tokens`;
    },

    async process(data, inputs: Inputs, context: InternalProcessContext): Promise<Outputs> {
      try {
        console.log("Starting Mistral Chat node processing...");
        
        const apiKey = context.getPluginConfig('mistralApiKey');
        if (!apiKey) {
          throw new Error('Mistral API key not configured. Please add your API key in the plugin configuration.');
        }

        const model = rivet.getInputOrData(data, inputs, 'model', 'string') ?? data.model;
        const temperature = rivet.getInputOrData(data, inputs, 'temperature', 'number') ?? data.temperature;
        const maxTokens = rivet.getInputOrData(data, inputs, 'maxTokens', 'number') ?? data.maxTokens;
        const topP = rivet.getInputOrData(data, inputs, 'topP', 'number') ?? data.topP;
        const systemPrompt = rivet.getInputOrData(data, inputs, 'systemPrompt', 'string') ?? data.systemPrompt;
        
        let messages: MistralMessage[] = [];

        if (systemPrompt?.trim()) {
          messages.push({
            role: 'system',
            content: systemPrompt,
          });
        }

        if (data.useMessagesInput) {
          const inputMessages = rivet.coerceType(inputs['messages' as PortId], 'chat-message[]');
          if (!inputMessages) {
            throw new Error('Invalid messages input format');
          }

          messages.push(...inputMessages.map(msg => ({
            role: msg.type as 'system' | 'user' | 'assistant',
            content: typeof msg.message === 'string' ? msg.message : msg.message.toString(),
          })));
        } else {
          const promptInput = inputs['prompt' as PortId];
          if (!promptInput) {
            throw new Error('No prompt provided');
          }
          
          let userMessages: RivetChatMessage[] = [];
          
          if (promptInput.type === 'chat-message') {
            userMessages = [promptInput.value];
          } else if (promptInput.type === 'chat-message[]') {
            userMessages = promptInput.value;
          } else if (promptInput.type === 'string') {
            userMessages = [createUserMessage(promptInput.value)];
          } else if (promptInput.type === 'string[]') {
            userMessages = promptInput.value.map(v => createUserMessage(v));
          } else {
            throw new Error(`Invalid prompt format: ${promptInput.type}`);
          }

          messages.push(...userMessages.map(convertToMistralMessage));
        }

        const requestBody = {
          model,
          messages,
          temperature,
          max_tokens: maxTokens,
          top_p: topP,
          stream: data.useStream,
          safe_prompt: data.useSafePrompt,
          random_seed: data.useRandomSeed ? data.randomSeed : undefined,
        };

        const response = await fetch('https://api.mistral.ai/v1/chat/completions', {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
            'Authorization': `Bearer ${apiKey}`,
          },
          body: JSON.stringify(requestBody),
        });

        if (!response.ok) {
          const errorText = await response.text();
          console.error("Mistral API error:", response.status, errorText);
          throw new Error(`Mistral API error: ${response.status} - ${errorText}`);
        }

        const output: Outputs = {};

        if (data.useStream) {
          const reader = response.body?.getReader();
          const decoder = new TextDecoder();
          let buffer = '';
          const responseParts: string[] = [];
          
          // Store all raw JSON chunks for analysis
          const allChunks: string[] = [];
          // Track if we've found token usage information
          let tokenUsageFound = false;
          let tokenUsage = {
            prompt_tokens: 0,
            completion_tokens: 0,
            total_tokens: 0
          };

          if (!reader) {
            throw new Error('No response body');
          }

          while (true) {
            const { done, value } = await reader.read();
            if (done) break;

            buffer += decoder.decode(value, { stream: true });
            const lines = buffer.split('\n');
            buffer = lines.pop() || '';

            for (const line of lines) {
              if (line.trim() === '') continue;
              if (line.startsWith('data: ')) {
                const dataContent = line.slice(6);
                if (dataContent === '[DONE]') continue;
                
                // Store the raw chunk for later analysis
                allChunks.push(dataContent);
                
                try {
                  const jsonData = JSON.parse(dataContent);
                  
                  // Check if this chunk contains token usage information
                  if (jsonData.usage && jsonData.usage.total_tokens) {
                    console.log("Found token usage in streaming response:", jsonData.usage);
                    tokenUsageFound = true;
                    tokenUsage = jsonData.usage;
                  }
                  
                  const content = jsonData.choices[0]?.delta?.content;
                  if (content) {
                    responseParts.push(content);
                    
                    const currentResponse = responseParts.join('');
                    const assistantMessage = createAssistantMessage(currentResponse);

                    output['response' as PortId] = {
                      type: 'string',
                      value: currentResponse,
                    };

                    output['message' as PortId] = {
                      type: 'chat-message',
                      value: assistantMessage,
                    };

                    output['messages' as PortId] = {
                      type: 'chat-message[]',
                      value: [
                        ...messages.map(m => {
                          if (m.role === 'system') return createSystemMessage(m.content);
                          if (m.role === 'user') return createUserMessage(m.content);
                          return createAssistantMessage(m.content);
                        }),
                        assistantMessage,
                      ],
                    };

                    // If we've found token usage, include it in the partial outputs
                    if (tokenUsageFound) {
                      // Calculate approximate cost
                      const modelInfo = mistralModels[model as MistralModels] || { 
                        cost: { 
                          prompt: { USD: "$0", EUR: "0 €" }, 
                          completion: { USD: "$0", EUR: "0 €" } 
                        } 
                      };

                      // Get the price for the selected currency
                      const promptPriceStr = modelInfo.cost.prompt[data.currency];
                      const completionPriceStr = modelInfo.cost.completion[data.currency];

                      // Parse the cost values (removing currency symbols and converting to number)
                      const promptCostPerMillion = parseFloat(promptPriceStr.replace(/[^0-9.]/g, ''));
                      const completionCostPerMillion = completionPriceStr === '-' ? 0 : parseFloat(completionPriceStr.replace(/[^0-9.]/g, ''));

                      // Calculate cost
                      const promptCost = (tokenUsage.prompt_tokens / 1000000) * promptCostPerMillion;
                      const completionCost = (tokenUsage.completion_tokens / 1000000) * completionCostPerMillion;
                      const totalCostDollars = promptCost + completionCost;
                      
                      // Convert to cents and round to 4 decimal places
                      const totalCostCents = Number((totalCostDollars * 100).toFixed(4));

                      output['tokenDetails' as PortId] = {
                        type: 'object',
                        value: {
                          prompt: tokenUsage.prompt_tokens,
                          completion: tokenUsage.completion_tokens,
                          total: tokenUsage.total_tokens,
                          estimatedCostCents: totalCostCents,
                          currency: data.currency
                        }
                      };
                    }

                    context.onPartialOutputs?.(output);
                  }
                } catch (e) {
                  console.error('Error parsing JSON from stream:', e);
                }
              }
            }
          }

          // After stream is complete, try to find token usage in the collected chunks
          if (!tokenUsageFound) {
            console.log("Analyzing all chunks for token usage information...");
            
            // Log all chunks for debugging
            console.log("All received chunks:", allChunks);
            
            // Try to find a chunk with usage information
            for (const chunk of allChunks) {
              try {
                const json = JSON.parse(chunk);
                if (json.usage && json.usage.total_tokens) {
                  console.log("Found token usage in chunk analysis:", json.usage);
                  tokenUsage = json.usage;
                  tokenUsageFound = true;
                  break;
                }
              } catch (e) {
                // Skip chunks that can't be parsed
                continue;
              }
            }
          }

          // If we still don't have token usage, make a fallback calculation
          if (!tokenUsageFound) {
            console.log("Token usage not found in streaming response, using estimates");
            
            // Estimate completion tokens based on response length
            // This is a very rough estimate and should be replaced with a better method
            const fullResponse = responseParts.join('');
            const estimatedCompletionTokens = Math.ceil(fullResponse.length / 4); // Very rough estimate
            
            // We don't know prompt tokens, so we'll use a placeholder
            tokenUsage = {
              prompt_tokens: 0, // Unknown
              completion_tokens: estimatedCompletionTokens,
              total_tokens: estimatedCompletionTokens // Incomplete total
            };
            
            output['tokenDetails' as PortId] = {
              type: 'object',
              value: {
                note: "Token details estimated - actual counts not available in streaming mode",
                prompt: tokenUsage.prompt_tokens,
                completion: tokenUsage.completion_tokens,
                total: tokenUsage.total_tokens,
                estimatedCostCents: 0, // Can't calculate accurately without prompt tokens
                currency: data.currency
              }
            };
          } else {
            // Calculate cost with the found token usage
            const modelInfo = mistralModels[model as MistralModels] || { 
              cost: { 
                prompt: { USD: "$0", EUR: "0 €" }, 
                completion: { USD: "$0", EUR: "0 €" } 
              } 
            };

            const promptPriceStr = modelInfo.cost.prompt[data.currency];
            const completionPriceStr = modelInfo.cost.completion[data.currency];

            const promptCostPerMillion = parseFloat(promptPriceStr.replace(/[^0-9.]/g, ''));
            const completionCostPerMillion = completionPriceStr === '-' ? 0 : parseFloat(completionPriceStr.replace(/[^0-9.]/g, ''));

            const promptCost = (tokenUsage.prompt_tokens / 1000000) * promptCostPerMillion;
            const completionCost = (tokenUsage.completion_tokens / 1000000) * completionCostPerMillion;
            const totalCostDollars = promptCost + completionCost;
            
            const totalCostCents = Number((totalCostDollars * 100).toFixed(4));

            output['tokenDetails' as PortId] = {
              type: 'object',
              value: {
                prompt: tokenUsage.prompt_tokens,
                completion: tokenUsage.completion_tokens,
                total: tokenUsage.total_tokens,
                estimatedCostCents: totalCostCents,
                currency: data.currency
              }
            };
          }
        } else {
          // Non-streaming mode - token information is directly available
          const json = await response.json();
          const content = json.choices[0]?.message?.content;
          const promptTokens = json.usage.prompt_tokens;
          const completionTokens = json.usage.completion_tokens;
          const totalTokens = json.usage.total_tokens;
          
          // Calculate approximate cost
          const modelInfo = mistralModels[model as MistralModels] || { 
            cost: { 
              prompt: { USD: "$0", EUR: "0 €" }, 
              completion: { USD: "$0", EUR: "0 €" } 
            } 
          };

          // Get the price for the selected currency
          const promptPriceStr = modelInfo.cost.prompt[data.currency];
          const completionPriceStr = modelInfo.cost.completion[data.currency];

          // Parse the cost values (removing currency symbols and converting to number)
          const promptCostPerMillion = parseFloat(promptPriceStr.replace(/[^0-9.]/g, ''));
          const completionCostPerMillion = completionPriceStr === '-' ? 0 : parseFloat(completionPriceStr.replace(/[^0-9.]/g, ''));

          // Special case for OCR which is priced per page
          let totalCostCents = 0;
          
          if (model === 'mistral-ocr-latest') {
            // OCR cost calculation would go here
            // This is a placeholder since OCR doesn't use token-based pricing
            totalCostCents = 0; // We'd need a different calculation for OCR
          } else {
            // Regular token-based cost calculation
            const promptCost = (promptTokens / 1000000) * promptCostPerMillion;
            const completionCost = (completionTokens / 1000000) * completionCostPerMillion;
            const totalCostDollars = promptCost + completionCost;
            
            // Convert to cents and round to 4 decimal places
            totalCostCents = Number((totalCostDollars * 100).toFixed(4));
          }
          
          // Currency label
          const currencyLabel = data.currency === 'USD' ? 'cents' : 'euro cents';
          
          // Log detailed token and cost information
          console.log(`Mistral API call:
    Model: ${model}
    Prompt tokens: ${promptTokens}
    Completion tokens: ${completionTokens}
    Total tokens: ${totalTokens}
    Estimated cost: ${totalCostCents} ${currencyLabel}`);

          const assistantMessage = createAssistantMessage(content);

          output['response' as PortId] = {
            type: 'string',
            value: content,
          };

          output['message' as PortId] = {
            type: 'chat-message',
            value: assistantMessage,
          };

          output['messages' as PortId] = {
            type: 'chat-message[]',
            value: [
              ...messages.map(m => {
                if (m.role === 'system') return createSystemMessage(m.content);
                if (m.role === 'user') return createUserMessage(m.content);
                return createAssistantMessage(m.content);
              }),
              assistantMessage,
            ],
          };
          
          output['tokenDetails' as PortId] = {
            type: 'object',
            value: {
              prompt: promptTokens,
              completion: completionTokens,
              total: totalTokens,
              estimatedCostCents: totalCostCents,
              currency: data.currency
            }
          };
        }

        return output;
      } catch (error) {
        console.error("Error in Mistral Chat node:", error);
        throw error;
      }
    },
  };

  return rivet.pluginNodeDefinition(nodeImpl, 'Mistral Chat');
}
