export type SpecialistType = 'fiscal' | 'labor' | 'market';

export interface RoutingResult {
  primarySpecialist: SpecialistType;
  secondarySpecialists: SpecialistType[];
  confidence: number;
  reasoning: string;
}

export interface ChatMessage {
  id: string;
  role: 'user' | 'assistant';
  content: string;
  timestamp: Date;
}
