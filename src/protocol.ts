export type ChatMessage = { role: 'user' | 'assistant'; content: string };
export type ToolEvent = { id: string; name: string; detail: string; state: 'running' | 'success' | 'error' | 'approval'; output?: string };
export type WebviewMessage =
  | { type: 'ready' } | { type: 'send'; text: string } | { type: 'approve'; id: string; approved: boolean }
  | { type: 'openFile'; path: string } | { type: 'setKey'; key: string };
export type HostMessage =
  | { type: 'history'; messages: ChatMessage[] } | { type: 'assistantStart' } | { type: 'assistantDelta'; text: string }
  | { type: 'assistantDone' } | { type: 'tool'; tool: ToolEvent } | { type: 'error'; message: string }
  | { type: 'configuration'; ready: boolean; reason?: string; backend?: string };
