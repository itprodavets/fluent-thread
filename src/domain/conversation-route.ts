export type ConversationStep = { id: string; title: string; transition: string; dialogue: string };
export type ConversationRoute = { id: string; language: string; title: string; steps: ConversationStep[] };
