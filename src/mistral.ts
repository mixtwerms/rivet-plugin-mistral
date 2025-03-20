import type { 
  ChatMessage as RivetChatMessage, 
  SystemChatMessage, 
  UserChatMessage, 
  AssistantChatMessage 
} from '@ironclad/rivet-core';

export type ToolCall = {
  id: string;
  type: 'function';
  function: {
    name: string;
    arguments: string;
  };
};

// Mistral's message format
export type MistralMessage = {
  role: 'system' | 'user' | 'assistant';
  content: string;
  tool_calls?: ToolCall[];
};

export type MistralModel = {
  maxTokens: number;
  cost: {
    prompt: {
      USD: string;
      EUR: string;
    };
    completion: {
      USD: string;
      EUR: string;
    };
  };
  displayName: string;
  contextLength: number;
};

export const mistralModels = {
  // Premier models
  'mistral-large-latest': {
    maxTokens: 131072,
    cost: {
      prompt: {
        USD: "$2",
        EUR: "1.8 €"
      },
      completion: {
        USD: "$6",
        EUR: "5.4 €"
      }
    },
    displayName: 'Mistral Large 24.11',
    contextLength: 131072,
  },
  'pixtral-large-latest': {
    maxTokens: 131072,
    cost: {
      prompt: {
        USD: "$2",
        EUR: "1.8 €"
      },
      completion: {
        USD: "$6",
        EUR: "5.4 €"
      }
    },
    displayName: 'Pixtral Large',
    contextLength: 131072,
  },
  'mistral-saba-latest': {
    maxTokens: 32768,
    cost: {
      prompt: {
        USD: "$0.2",
        EUR: "0.2 €"
      },
      completion: {
        USD: "$0.6",
        EUR: "0.6 €"
      }
    },
    displayName: 'Mistral Saba',
    contextLength: 32768,
  },
  'codestral-latest': {
    maxTokens: 262144, // 256k
    cost: {
      prompt: {
        USD: "$0.3",
        EUR: "0.3 €"
      },
      completion: {
        USD: "$0.9",
        EUR: "0.9 €"
      }
    },
    displayName: 'Codestral',
    contextLength: 262144,
  },
  'ministral-8b-latest': {
    maxTokens: 131072,
    cost: {
      prompt: {
        USD: "$0.1",
        EUR: "0.09 €"
      },
      completion: {
        USD: "$0.1",
        EUR: "0.09 €"
      }
    },
    displayName: 'Ministral 8B 24.10',
    contextLength: 131072,
  },
  'ministral-3b-latest': {
    maxTokens: 131072,
    cost: {
      prompt: {
        USD: "$0.04",
        EUR: "0.04 €"
      },
      completion: {
        USD: "$0.04",
        EUR: "0.04 €"
      }
    },
    displayName: 'Ministral 3B 24.10',
    contextLength: 131072,
  },
  'mistral-embed': {
    maxTokens: 8192,
    cost: {
      prompt: {
        USD: "$0.1",
        EUR: "0.09 €"
      },
      completion: {
        USD: "-",
        EUR: "-"
      }
    },
    displayName: 'Mistral Embed',
    contextLength: 8192,
  },
  'mistral-moderation-latest': {
    maxTokens: 8192,
    cost: {
      prompt: {
        USD: "$0.1",
        EUR: "0.09 €"
      },
      completion: {
        USD: "-",
        EUR: "-"
      }
    },
    displayName: 'Mistral Moderation 24.11',
    contextLength: 8192,
  },
  'mistral-ocr-latest': {
    maxTokens: 0, // Not applicable for OCR
    cost: {
      prompt: {
        USD: "1000 Pages / $1",
        EUR: "1000 Pages / 1€"
      },
      completion: {
        USD: "-",
        EUR: "-"
      }
    },
    displayName: 'Mistral OCR',
    contextLength: 0,
  },
  
  // Other models
  'mistral-small-latest': {
    maxTokens: 131072,
    cost: {
      prompt: {
        USD: "$0.1",
        EUR: "0.09 €"
      },
      completion: {
        USD: "$0.3",
        EUR: "0.27 €"
      }
    },
    displayName: 'Mistral Small',
    contextLength: 131072,
  },
  'open-mistral-7b': {
    maxTokens: 32768,
    cost: {
      prompt: {
        USD: "$0.25",
        EUR: "0.23 €"
      },
      completion: {
        USD: "$0.25",
        EUR: "0.23 €"
      }
    },
    displayName: 'Open Mistral 7B',
    contextLength: 32768,
  },
  'open-mixtral-8x7b': {
    maxTokens: 32768,
    cost: {
      prompt: {
        USD: "$0.7",
        EUR: "0.63 €"
      },
      completion: {
        USD: "$0.7",
        EUR: "0.63 €"
      }
    },
    displayName: 'Open Mixtral 8x7B',
    contextLength: 32768,
  },
  'open-mixtral-8x22b': {
    maxTokens: 64000,
    cost: {
      prompt: {
        USD: "$2",
        EUR: "1.8 €"
      },
      completion: {
        USD: "$6",
        EUR: "5.4 €"
      }
    },
    displayName: 'Open Mixtral 8x22B',
    contextLength: 64000,
  },
} as const;


export type MistralModels = keyof typeof mistralModels;

export const mistralModelOptions = Object.entries(mistralModels).map(([id, { displayName }]) => ({
  value: id,
  label: displayName,
}));

export function convertToMistralMessage(rivetMessage: RivetChatMessage): MistralMessage {
  // Ensure we only use valid Mistral roles
  let role: 'system' | 'user' | 'assistant';
  switch (rivetMessage.type) {
    case 'system':
      role = 'system';
      break;
    case 'user':
      role = 'user';
      break;
    case 'assistant':
      role = 'assistant';
      break;
    default:
      role = 'user'; // Default to user for any other type
  }

  return {
    role,
    content: typeof rivetMessage.message === 'string' ? rivetMessage.message : rivetMessage.message.toString()
  };
}

export function createAssistantMessage(content: string): AssistantChatMessage {
  return {
    type: 'assistant',
    message: content,
    function_call: undefined,
    function_calls: [],
  };
}

export function createSystemMessage(content: string): SystemChatMessage {
  return {
    type: 'system',
    message: content,
  };
}

export function createUserMessage(content: string): UserChatMessage {
  return {
    type: 'user',
    message: content,
  };
}
