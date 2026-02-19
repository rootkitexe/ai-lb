// AI-Generated Scenario Configs
// These are lightweight configs — the AI generates the full scenario at runtime

export interface AIScenarioConfig {
    id: string;
    title: string;
    description: string;
    topic: string;
    difficulty: 'Junior' | 'Mid' | 'Senior';
    blanks: number;
    environment: string;
    tags: string[];
}

export const aiScenarioConfigs: AIScenarioConfig[] = [
    {
        id: 'ai-docker-networking',
        title: 'Docker Networking Challenge',
        description: 'AI-generated questions on Docker networking, port mapping, and container communication.',
        topic: 'Docker Networking',
        difficulty: 'Mid',
        blanks: 5,
        environment: 'Docker',
        tags: ['Docker', 'AI-Generated', 'Networking'],
    },
];
