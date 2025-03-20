import type { RivetPlugin, RivetPluginInitializer } from "@ironclad/rivet-core";
import mistralChatNode from "./nodes/mistralChatNode";

const initializer: RivetPluginInitializer = (rivet) => {
  console.log("Initializing Mistral plugin...");
  
  const node = mistralChatNode(rivet);
  console.log("Created node:", node);

  const plugin: RivetPlugin = {
    id: "rivet-plugin-mistral",
    name: "Mistral AI",
    configSpec: {
      mistralApiKey: {
        type: "secret",
        label: "Mistral API Key",
        description: "The API key for accessing Mistral AI.",
        pullEnvironmentVariable: "MISTRAL_API_KEY",
        helperText: "You may also set the MISTRAL_API_KEY environment variable.",
      },
    },
    contextMenuGroups: [
      {
        id: "ai-chat-mistral",
        label: "AI/Chat (Mistral)",
      },
    ],
    register: (register) => {
      console.log("Registering Mistral node...");
      register(node);
    },
  };

  return plugin;
};

export default initializer;
