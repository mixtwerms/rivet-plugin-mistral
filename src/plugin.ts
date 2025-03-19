import { type RivetPlugin } from '@ironclad/rivet-core';
import { mistralChatNode } from './nodes/mistralChatNode.js';

export const mistralPlugin: RivetPlugin = {
  id: 'mistral',
  name: 'Mistral AI',

  register: (register) => {
    register(mistralChatNode);
  },

  configSpec: {
    mistralApiKey: {
      type: 'secret',
      label: 'Mistral API Key',
      description: 'The API key for accessing Mistral AI.',
      pullEnvironmentVariable: 'MISTRAL_API_KEY',
      helperText: 'You may also set the MISTRAL_API_KEY environment variable.',
    },
  },
};
