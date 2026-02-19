import { LogicScenario } from '../data/scenario';

export interface ChatMessage {
    role: 'user' | 'assistant' | 'system';
    content: string;
}

const API_KEY = import.meta.env.VITE_OPENROUTER_API_KEY;
const SITE_URL = 'http://localhost:5173'; // Default Vite port

export async function sendMessageToAI(
    messages: ChatMessage[],
    scenario: LogicScenario,
    currentStepIndex: number
) {
    if (!API_KEY) {
        console.error("Missing API Key");
        return { role: 'assistant', content: "Error: API Key is missing in .env file." };
    }

    // Construct the System Prompt based on the hidden scenario state
    // We only reveal the step instruction to the AI, not necessarily the answer, unless needed for verification.
    const currentStep = scenario.steps[currentStepIndex];

    // Base system prompt
    let systemContent = `
You are a Senior Technical Interviewer for "ConAssess", an AI-powered assessment platform.
Current Scenario: "${scenario.title}"
Topic Area: ${scenario.environment}

Your Role:
1. You are the "Interviewer". The user is the "Candidate" answering questions.
2. Guide the user through the assessment steps one at a time.
3. Be professional, concise, and encourage best practices.
4. Do NOT give away the answer immediately. If the user is stuck, provide hints.
5. If the user successfully completes a step (indicated by a SYSTEM_EVENT), introduce the NEXT step.
6. Adapt your language to the topic — use domain-appropriate terminology.
`;

    if (currentStep) {
        systemContent += `\nCURRENT OBJECTIVE (Hidden from user): ${currentStep.instruction}`;
    } else {
        systemContent += `\nCURRENT OBJECTIVE: The assessment is complete. Congratulate the user.`;
    }

    const payloadMessages = [
        { role: 'system', content: systemContent },
        ...messages
    ];

    try {
        const response = await fetch("https://openrouter.ai/api/v1/chat/completions", {
            method: "POST",
            headers: {
                "Authorization": `Bearer ${API_KEY}`,
                "HTTP-Referer": SITE_URL,
                "X-Title": "ConAssess LogicBox",
                "Content-Type": "application/json"
            },
            body: JSON.stringify({
                "model": "google/gemini-2.0-flash-001",
                "messages": payloadMessages,
                "temperature": 0.7,
                "max_tokens": 150
            })
        });

        const data = await response.json();
        if (data.error) {
            console.error("OpenRouter Error", data.error);
            return { role: 'assistant', content: "I'm having trouble connecting to the interview server." };
        }

        return data.choices[0].message;

    } catch (error) {
        console.error("AI Request Failed", error);
        return { role: 'assistant', content: "Connection failed." };
    }
}

// ─── AI-Driven Answer Validation ─────────────────────────────────────
export type AnswerStatus = 'correct' | 'partially_correct' | 'incorrect';

export interface ValidationResult {
    correct: boolean;
    status: AnswerStatus;
    feedback: string;
    correctedCommand?: string;
}

export async function validateAnswer(
    userAnswer: string,
    step: { instruction: string; expectedAnswer: string },
    scenario: LogicScenario
): Promise<ValidationResult> {
    if (!API_KEY) {
        return { correct: false, status: 'incorrect', feedback: "Error: API Key is missing." };
    }

    const systemPrompt = `You are an answer validator for a technical assessment platform called "ConAssess".
Scenario: "${scenario.title}"
Topic: ${scenario.environment}

CURRENT STEP INSTRUCTION: ${step.instruction}
EXPECTED ANSWER: ${step.expectedAnswer}

The user will provide their answer. Evaluate it using THREE-TIER grading:

1. "correct" — The answer is functionally correct and demonstrates full understanding
2. "partially_correct" — The answer shows the right idea or direction but is incomplete, has minor syntax errors, or is missing key details
3. "incorrect" — The answer is fundamentally wrong or unrelated

IMPORTANT: The user may be using VOICE INPUT (speech-to-text), so interpret spoken input generously:
- Spoken dashes, dots, slashes should be interpreted as syntax characters
- Natural language descriptions should be mapped to proper syntax
- "dash" → "-", "dot" → ".", "slash" → "/", "equals" → "="

For typed input, also accept equivalent variations:
- Different but equivalent syntax (e.g. shorthand flags vs long flags)
- Minor case differences where the language/tool is case-insensitive
- Equivalent logic expressed differently

Respond ONLY with a JSON object (no markdown, no code fences):
{"status": "correct"|"partially_correct"|"incorrect", "feedback": "brief explanation", "correctedAnswer": "properly formatted answer or null"}

Rules:
- "correct": feedback should be encouraging (1 sentence). Set correctedAnswer to the properly formatted version.
- "partially_correct": feedback should acknowledge what was right and briefly note what was missing/wrong. Set correctedAnswer to the proper version.
- "incorrect": feedback should explain WHY it's wrong (1-2 sentences). Set correctedAnswer to null.
- This is a TEST — do NOT give hints or reveal the full answer. Just grade and give brief feedback.
- Be LENIENT with formatting/punctuation — focus on whether the user knows the RIGHT CONCEPT.`;

    try {
        const response = await fetch("https://openrouter.ai/api/v1/chat/completions", {
            method: "POST",
            headers: {
                "Authorization": `Bearer ${API_KEY}`,
                "HTTP-Referer": SITE_URL,
                "X-Title": "ConAssess LogicBox Validator",
                "Content-Type": "application/json"
            },
            body: JSON.stringify({
                "model": "google/gemini-2.0-flash-001",
                "messages": [
                    { role: 'system', content: systemPrompt },
                    { role: 'user', content: userAnswer }
                ],
                "temperature": 0.1,  // Low temp for consistent validation
                "max_tokens": 200
            })
        });

        const data = await response.json();
        if (data.error) {
            console.error("Validation API Error", data.error);
            return { correct: false, status: 'incorrect' as AnswerStatus, feedback: "Validation service unavailable. Please try again." };
        }

        const raw = data.choices[0].message.content.trim();

        // Parse the JSON response, handling potential markdown wrapping
        let cleaned = raw;
        if (cleaned.startsWith('```')) {
            cleaned = cleaned.replace(/^```(?:json)?\s*/, '').replace(/\s*```$/, '');
        }

        const result = JSON.parse(cleaned);
        const status: AnswerStatus = result.status || (result.correct ? 'correct' : 'incorrect');
        return {
            correct: status === 'correct',
            status,
            feedback: result.feedback || '',
            correctedCommand: result.correctedAnswer || result.correctedCommand || undefined,
        };

    } catch (error) {
        console.error("Validation parse error", error);
        return { correct: false, status: 'incorrect', feedback: "Could not validate your answer. Please try again." };
    }
}

// ─── AI Scenario Generation ──────────────────────────────────────────
import { AIScenarioConfig } from '../data/aiscenario';

export async function generateScenario(config: AIScenarioConfig): Promise<LogicScenario> {
    if (!API_KEY) {
        throw new Error("API Key is missing.");
    }

    // ── Randomize scenario theme for variety ──
    const industries = [
        'an e-commerce platform', 'a healthcare system', 'a fintech application',
        'a social media platform', 'a real-time gaming service', 'a logistics system',
        'a video streaming service', 'an IoT platform', 'a SaaS product',
        'a startup MVP', 'a machine learning pipeline', 'an education platform',
        'a government portal', 'a travel booking system', 'a food delivery app',
    ];

    const randomIndustry = industries[Math.floor(Math.random() * industries.length)];
    const randomSeed = Math.floor(Math.random() * 100000);

    const systemPrompt = `You are a technical assessment generator for "ConAssess", an AI-powered interview platform that supports ANY technical topic.

Generate a complete assessment scenario. Respond ONLY with valid JSON (no markdown fences, no extra text).

CRITICAL JSON RULES:
- Use \\n for newlines inside string values, NEVER use actual line breaks inside a JSON string value.
- All string values must be properly escaped.
- Do NOT use markdown code fences around the JSON.

The JSON must have this EXACT shape:
{"context": "markdown string with \\n for newlines", "codeTemplate": "ONE unified code block with ___BLANK_1___, ___BLANK_2___ etc.", "steps": [{"id": "step_1", "instruction": "what blank 1 asks", "expectedAnswer": "correct answer for blank 1", "outputSimulation": "expected output or result"}]}

IMPORTANT — codeTemplate RULES:
The top-level "codeTemplate" is ONE SINGLE code block / script / config that contains ALL the blanks.
- Use numbered markers: ___BLANK_1___, ___BLANK_2___, ___BLANK_3___, etc.
- There must be EXACTLY ${config.blanks} blank markers in the template — no more, no fewer.
- ___BLANK_N___ corresponds to step N's expectedAnswer
- CRITICAL ORDER RULE: Blanks MUST appear in STRICTLY ASCENDING PHYSICAL ORDER in the code template string.
  When reading the code from top to bottom:
  1. The FIRST blank marker you encounter MUST be ___BLANK_1___
  2. The SECOND blank marker MUST be ___BLANK_2___
  3. The THIRD blank marker MUST be ___BLANK_3___
  ...and so on.
  NEVER place ___BLANK_1___ after ___BLANK_3___ in the text.
  If the logical flow of the code requires checking something at the end (like an exception handler), that step must be numbered LAST (e.g. Blank 5), not Blank 1.
  Re-number your steps if necessary to ensure the physical order in the code is 1, 2, 3, 4, 5.
- Each ___BLANK_N___ must be placed INLINE where the expectedAnswer goes. It replaces ONE expression, value, or short statement.
  NEVER use a blank to represent an entire function definition, class, or multi-line block.
- The code template should be a REALISTIC, COMPLETE script or config file (20-50 lines)
- It should feel like a real-world file with meaningful surrounding code
- Use \\n for newlines inside the template string
- Do NOT put codeTemplate inside individual steps — it goes at the TOP LEVEL only
- VALIDATION: Before outputting, mentally scan the template top-to-bottom and verify blanks appear as 1, 2, 3, … in that exact order.

FINAL CHECKLIST BEFORE OUTPUTTING JSON:
1. Did I generate EXACTLY ${config.blanks} blank markers?
2. Are they numbered ___BLANK_1___, ___BLANK_2___, ... up to ___BLANK_${config.blanks}___?
3. Are they in PHYSICAL ORDER (1, then 2, then 3) from top of code to bottom?
4. Is ___BLANK_1___ matched with Step 1's instruction?
5. Did I skip any numbers? (e.g. going from 1 to 3). If so, fix it immediately.
6. Did I duplicate any numbers? (e.g. two ___BLANK_2___s). If so, fix it.

codeTemplate EXAMPLE (Python, 5 blanks):
"import functools\n\n___BLANK_1___\ndef load_data(data_path):\n    # Simulate data loading from disk\n    print(f\"Loading data from {data_path}\")\n    return [1, 2, 3]\n\ndef calculate_memory_gb(array):\n    return ___BLANK_2___\n\ndef upload_to_s3(file_path, bucket):\n    import boto3\n    s3 = boto3.client('s3')\n    config = boto3.s3.transfer.TransferConfig(multipart_threshold=1024*25)\n    extra_args = ___BLANK_3___\n    s3.upload_file(file_path, bucket, file_path, ExtraArgs=extra_args, Config=config)\n\ndef log_metric(metric_name, value, step):\n    ___BLANK_4___\n\nclass AWSProfileSwitcher:\n    def __init__(self, profile_name):\n        self.profile_name = profile_name\n    def __enter__(self):\n        ___BLANK_5___\n        return self"

Another EXAMPLE (Docker/CLI, 3 blanks):
"FROM ___BLANK_1___\n\nWORKDIR /app\n\nCOPY package*.json ./\nRUN ___BLANK_2___\n\nCOPY . .\n\nEXPOSE 3000\nCMD [\"node\", \"___BLANK_3___\"]"

Another EXAMPLE (SQL, 3 blanks):
"CREATE TABLE orders (\n    id SERIAL PRIMARY KEY,\n    customer_id INTEGER ___BLANK_1___,\n    total DECIMAL(10,2),\n    status VARCHAR(20) DEFAULT ___BLANK_2___\n);\n\nSELECT c.name, COUNT(o.id) as order_count\nFROM customers c\n___BLANK_3___\nGROUP BY c.name\nHAVING COUNT(o.id) > 5;"

CONFIG:
- Topic: ${config.topic}
- Difficulty: ${config.difficulty}  
- Number of steps: ${config.blanks}
- Environment/Domain: ${config.environment}
- INDUSTRY CONTEXT: The scenario should be set in ${randomIndustry}
- VARIATION SEED: ${randomSeed} (use this to vary your creative choices)

TOPIC-ADAPTIVE RULES:
Adapt the question format to match the topic:
- For CLI/DevOps topics (Docker, Kubernetes, Linux, Git, etc.): expectedAnswer should be a command, outputSimulation should be realistic CLI output
- For programming topics (Python, JavaScript, Java, etc.): expectedAnswer should be code (a function, expression, or statement), outputSimulation should be the expected output when run
- For query/database topics (SQL, MongoDB, etc.): expectedAnswer should be a query, outputSimulation should be the result set
- For conceptual topics (System Design, Data Structures, etc.): expectedAnswer should be a concise technical answer, outputSimulation should be a brief explanation or diagram
- For cloud/infrastructure topics (AWS, Terraform, etc.): expectedAnswer should be a command or configuration snippet, outputSimulation should be the expected result

CRITICAL — SHORT ANSWERS ONLY:
Each step MUST expect a SHORT answer — maximum 1 line, ideally under 80 characters.
Do NOT ask the user to write entire functions, classes, or multi-line code blocks.
Instead, break the problem into small, focused parts where each step asks about ONE specific concept.
Each blank in the code template should replace a SINGLE expression, value, method call, or short statement — NOT an entire function body or class definition.

GOOD examples of expectedAnswer (SHORT):
- "Optional[float] = 0.0"
- "record['page_views'] = 0; print(e, file=sys.stderr)"
- "list(map(lambda x: UserActivity(**x), processed_data))"
- "@app.get('/products/{id}')"
- "HashMap<String, Integer>"
- "O(n log n)"
- "git rebase -i HEAD~3"
- "const [state, setState] = useState(0)"

BAD examples of expectedAnswer (TOO LONG — never do this):
- "def get_evens(lst):\\n    return [x for x in lst if x % 2 == 0]" (multi-line function)
- "class Product(BaseModel):\\n    id: int\\n    name: str\\n    price: float" (entire class)
- "from fastapi import FastAPI\\napp = FastAPI()\\n@app.get..." (multiple statements)

Ask about ONE piece at a time:
- Instead of "Write a Pydantic model" → ask "What type annotation makes the time_spent field optional with a default of 0.0?"
- Instead of "Write a FastAPI route" → ask "What decorator creates a GET endpoint at /products?"
- Instead of "Write a SQL join" → ask "Write a JOIN clause to connect orders with customers on customer_id"
- Instead of "Write a try-except block" → ask "What should go in the except block to default page_views to 0 and log the error?"

CONTEXT FORMAT (VERY IMPORTANT):
The "context" field must be a well-structured markdown string with these sections:
1. A heading with the scenario title (use # for heading)
2. A short paragraph describing the real-world situation/problem (2-3 sentences)
3. A sub-heading: "## Complete the code as per the given instructions:"
4. A numbered list of EXACTLY ${config.blanks} detailed question-style instructions, one per blank. Each MUST start with a bold label like:
   - **At Blank 1:** a detailed, specific question. E.g. "What decorator from functools allows you to cache function results, and how would you import it?"
   - **At Blank 2:** another detailed question. E.g. "Given the 'get_product_view_count' function, what value should be returned if there's a connection error to the Redis server?"
   These MUST be detailed, descriptive questions — NOT brief one-line summaries. They should read like an interviewer asking a specific technical question about each blank.
   CRITICAL: The text after "At Blank N:" MUST be IDENTICAL word-for-word to that step's "instruction" field in the steps array.
5. A section with relevant details (architecture, tech stack, constraints, etc.)

REQUIREMENTS:
- Create a UNIQUE scenario related to ${config.topic} in the context of ${randomIndustry}
- Use specific, realistic details relevant to the topic and industry
- context: A structured markdown problem statement following the format above
- Each step builds on the previous one logically
- Instructions should be clear but not reveal the exact answer
- expectedAnswer: MUST be a single short line (under 80 chars). NEVER multi-line code.
- outputSimulation: realistic output relevant to the topic type (use \\\\n for line breaks)
- Generate EXACTLY ${config.blanks} steps
- Keep each string value concise
- Be creative and varied — do not use generic textbook examples
- CRITICAL: The "At Blank N:" text in the context MUST be the SAME as the step's "instruction" field — word for word.`;

    try {
        const response = await fetch("https://openrouter.ai/api/v1/chat/completions", {
            method: "POST",
            headers: {
                "Authorization": `Bearer ${API_KEY}`,
                "HTTP-Referer": SITE_URL,
                "X-Title": "ConAssess ScenarioGen",
                "Content-Type": "application/json"
            },
            body: JSON.stringify({
                "model": "google/gemini-2.0-flash-001",
                "messages": [
                    { role: 'system', content: systemPrompt },
                    { role: 'user', content: `Generate a ${config.blanks}-step ${config.topic} assessment at ${config.difficulty} level. Return ONLY valid JSON.` }
                ],
                "temperature": 1.0,
                "max_tokens": 4000
            })
        });

        const data = await response.json();
        if (data.error) {
            console.error("Generation API Error", data.error);
            throw new Error("Failed to generate scenario.");
        }

        let raw = data.choices[0].message.content.trim();

        // Strip markdown code fences if present
        if (raw.startsWith('```')) {
            raw = raw.replace(/^```(?:json)?\s*\n?/, '').replace(/\n?\s*```$/, '');
        }

        // Replace any actual newlines inside the JSON (outside of \n escape sequences) 
        // This handles cases where the AI puts real line breaks in strings
        let cleaned = raw.trim();

        const generated = JSON.parse(cleaned);

        if (!generated.context || !Array.isArray(generated.steps) || generated.steps.length === 0) {
            throw new Error("Invalid scenario structure returned by AI.");
        }

        // Assemble into a LogicScenario
        const scenario: LogicScenario = {
            id: config.id,
            title: config.title,
            description: config.description,
            difficulty: config.difficulty,
            environment: config.environment,
            context: generated.context,
            codeTemplate: generated.codeTemplate || '',
            steps: generated.steps.map((s: any, i: number) => ({
                id: s.id || `step_${i + 1}`,
                instruction: s.instruction,
                expectedAnswer: s.expectedAnswer,
                outputSimulation: s.outputSimulation,
            })),
        };

        // ── POST-PROCESSING: Re-order Blanks & Sync Instructions ──
        // Ensure blanks are physically ordered 1, 2, 3... in the code
        if (scenario.codeTemplate) {
            const regex = /___BLANK_(\d+)___/g;
            let match;
            const foundBlanks: { originalId: number; index: number; marker: string }[] = [];

            while ((match = regex.exec(scenario.codeTemplate)) !== null) {
                foundBlanks.push({
                    originalId: parseInt(match[1]),
                    index: match.index,
                    marker: match[0]
                });
            }

            // Sort by physical position (top to bottom)
            foundBlanks.sort((a, b) => a.index - b.index);

            // Create ID Mapping: Old ID -> New ID (1-based index)
            const idMap = new Map<number, number>();
            foundBlanks.forEach((b, i) => {
                idMap.set(b.originalId, i + 1);
            });

            // Only modify if we found blanks
            if (foundBlanks.length > 0) {
                // 1. Rewrite Code Template with new markers
                let newTemplate = scenario.codeTemplate;
                let rebuilt = '';
                let lastIdx = 0;

                foundBlanks.forEach((b, i) => {
                    const newMarker = `___BLANK_${i + 1}___`;
                    rebuilt += scenario.codeTemplate.substring(lastIdx, b.index);
                    rebuilt += newMarker;
                    lastIdx = b.index + b.marker.length;
                });
                rebuilt += scenario.codeTemplate.substring(lastIdx);
                scenario.codeTemplate = rebuilt;

                // 2. Re-order and Update Steps
                const newSteps = new Array(foundBlanks.length);

                foundBlanks.forEach((b, i) => {
                    const oldStepIdx = b.originalId - 1; // 0-indexed match
                    const newStepIdx = i; // 0-indexed destination

                    if (scenario.steps[oldStepIdx]) {
                        const step = { ...scenario.steps[oldStepIdx] };
                        step.id = `step_${newStepIdx + 1}`;

                        // Update "At Blank X" in instruction text to "At Blank Y"
                        const headerRegex = new RegExp(`At\\s+Blank\\s+${b.originalId}`, 'gi');
                        step.instruction = step.instruction.replace(headerRegex, `At Blank ${newStepIdx + 1}`);

                        newSteps[newStepIdx] = step;
                    } else {
                        // Fallback for mismatch
                        newSteps[newStepIdx] = {
                            id: `step_${newStepIdx + 1}`,
                            instruction: "Missing step definition.",
                            expectedAnswer: "???",
                            outputSimulation: ""
                        };
                    }
                });

                scenario.steps = newSteps.filter(s => !!s);

                // 3. Update Context Markdown (Left Panel)
                if (scenario.context) {
                    // Regex to replace "At Blank <OldID>" with "At Blank <NewID>"
                    // We use a callback to handle swaps atomically
                    const contextRegex = /At\s+Blank\s+(\d+)/gi;
                    scenario.context = scenario.context.replace(contextRegex, (match, p1) => {
                        const oldId = parseInt(p1);
                        const newId = idMap.get(oldId);
                        return newId ? `At Blank ${newId}` : match;
                    });
                }
            }
        }

        return scenario;

    } catch (error) {
        console.error("Scenario generation failed", error);
        throw error;
    }
}

