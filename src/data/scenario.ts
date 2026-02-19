export interface LogicStep {
    id: string;
    instruction: string;
    expectedAnswer: string;          // For AI validation context
    commandPattern?: RegExp;         // Optional fallback regex
    outputSimulation: string;
    captureVariable?: {
        name: string;
        value: string;
    };
}

export interface LogicScenario {
    id: string;
    title: string;
    description: string;
    difficulty: 'Junior' | 'Mid' | 'Senior';
    environment: string;
    context: string;
    codeTemplate?: string;           // ONE unified code block with ___BLANK_1___, ___BLANK_2___, etc.
    steps: LogicStep[];
}

// ─── Scenario 1: Kubernetes CrashLoopBackOff ─────────────────────────
export const k8sScenario: LogicScenario = {
    id: 'k8s-crashloop',
    title: 'Kubernetes CrashLoopBackOff',
    description: 'Debug a failing pod in a production cluster.',
    difficulty: 'Senior',
    environment: 'k8s-prod-us-east',
    context: `
# Kubernetes CrashLoopBackOff

## Problem Statement
The **payment-service** in the production cluster is currently unstable. Customers are reporting intermittent failures during checkout. The monitoring dashboard shows that one or more pods in the \`payments\` namespace are constantly restarting.

## Architecture
- **Cluster**: prod-us-east
- **Namespace**: \`payments\`
- **Service**: \`payment-service\` (ClusterIP)
- **Deployment**: \`payment-deployment\`

## Objective
Identify the root cause of the crash and apply a fix. You have full \`kubectl\` access to the namespace.

## Constraints
> [!WARNING]
> Do NOT delete the deployment itself. Only interact with pods, logs, and configuration.

## Evaluation Criteria
- Ability to identify the crashing pod.
- Correct usage of \`kubectl logs\` and \`kubectl describe\`.
- diagnosing the configuration error (Environment Variable vs ConfigMap).
`,
    steps: [
        {
            id: 'step_1',
            instruction: "Our monitoring system has detected that the 'payment-service' is unstable. Please list all pods in the 'payments' namespace to identify the specific pod that is crashing.",
            expectedAnswer: "kubectl get pods -n payments",
            commandPattern: /kubectl get pods.*-n payments/,
            outputSimulation: "NAME\t\t\tREADY\tSTATUS\t\tRESTARTS\tAGE\npay-svc-x9z2\t0/1\tCrashLoopBackOff\t4\t\t2m",
            captureVariable: { name: "TARGET_POD", value: "pay-svc-x9z2" }
        },
        {
            id: 'step_2',
            instruction: "Okay, we see 'pay-svc-x9z2' is in a CrashLoop. Check the logs for this pod to understand why it's failing.",
            expectedAnswer: "kubectl logs pay-svc-x9z2 -n payments",
            commandPattern: /kubectl logs.*pay-svc-x9z2.*-n payments/,
            outputSimulation: "Error: DB_CONNECTION_STRING not found.\nPanic: Application failed to start. Missing required environment variable.",
        },
        {
            id: 'step_3',
            instruction: "It seems like a missing environment variable 'DB_CONNECTION_STRING'. Inspect the pod's deployment configuration/manifest to see how env vars are defined.",
            expectedAnswer: "kubectl describe pod pay-svc-x9z2 -n payments",
            commandPattern: /kubectl describe pod.*pay-svc-x9z2.*-n payments/,
            outputSimulation: "...\nEnvironment:\n  DB_HOST: 10.0.0.4\n  DB_USER: admin\n  (DB_CONNECTION_STRING is missing)\n...",
        },
        {
            id: 'step_4',
            instruction: "The environment variable is indeed missing. We need to patch the deployment to include 'DB_CONNECTION_STRING'. Write the command to edit the deployment.",
            expectedAnswer: "kubectl edit deployment payment-deployment -n payments",
            commandPattern: /kubectl edit deployment.*payment-deployment.*-n payments/,
            outputSimulation: "deployment.apps/payment-deployment edited",
        },
        {
            id: 'step_5',
            instruction: "Great. Now that you've patched the deployment, verify that the new pod is running and stable.",
            expectedAnswer: "kubectl get pods -n payments",
            commandPattern: /kubectl get pods.*-n payments/,
            outputSimulation: "NAME\t\t\tREADY\tSTATUS\t\tRESTARTS\tAGE\npay-svc-rt56\t1/1\tRunning\t\t0\t\t10s",
        }
    ]
};

// ─── Scenario 2: Docker AI-Logic (Fill in the Blanks) ────────────────
export const dockerScenario: LogicScenario = {
    id: 'docker-fill-blanks',
    title: 'Docker: Build a Java Deployment',
    description: 'Write Dockerfile commands to deploy a Java WAR application.',
    difficulty: 'Mid',
    environment: 'docker-build-env',
    context: `
# Docker: Java Application Deployment

## Problem Statement
In your company, you need to deploy a Java project and access it from the URL with port 80, so you write the code on the Docker file.

## Task
In relation to downloading and running Docker images from the Docker Hub, **fill in the blanks** by providing the correct Dockerfile commands.

After you run the container, you should go to the URL with port 80 and get it running.

## Application Details
- **Base Image**: \`java:8-jdk-alpine\`
- **WAR File**: \`test-java-0.0.1-SNAPSHOT.war\`
- **Target Directory**: \`/usr/app\`
- **Exposed Port**: \`80\`

## Dockerfile Structure
Each step corresponds to one line in the Dockerfile. Provide the correct command for each blank.

## Constraints
> [!IMPORTANT]
> Use exact Docker syntax. Commands are case-sensitive (e.g., \`FROM\`, \`COPY\`, \`WORKDIR\`, \`EXPOSE\`, \`CMD\`).

## Evaluation Criteria
- Correct Dockerfile command syntax.
- Proper use of \`FROM\`, \`COPY\`, \`WORKDIR\`, \`EXPOSE\`, and \`CMD\` instructions.
- Understanding of Java application deployment in Docker.
`,
    steps: [
        {
            id: 'blank_1',
            instruction: "Write the Docker command to define the base image to `java:8-jdk-alpine`.",
            expectedAnswer: "FROM java:8-jdk-alpine",
            outputSimulation: "# Dockerfile\nFROM java:8-jdk-alpine",
        },
        {
            id: 'blank_2',
            instruction: "Copy the source WAR file named `test-java-0.0.1-SNAPSHOT.war` to the new container, which is based in `/usr/app`.",
            expectedAnswer: "COPY test-java-0.0.1-SNAPSHOT.war /usr/app",
            outputSimulation: "# Dockerfile\nFROM java:8-jdk-alpine\nCOPY test-java-0.0.1-SNAPSHOT.war /usr/app",
        },
        {
            id: 'blank_3',
            instruction: "Set the work directory to be `/usr/app`.",
            expectedAnswer: "WORKDIR /usr/app",
            outputSimulation: "# Dockerfile\nFROM java:8-jdk-alpine\nCOPY test-java-0.0.1-SNAPSHOT.war /usr/app\nWORKDIR /usr/app",
        },
        {
            id: 'blank_4',
            instruction: "Expose the port to be `80`.",
            expectedAnswer: "EXPOSE 80",
            outputSimulation: "# Dockerfile\nFROM java:8-jdk-alpine\nCOPY test-java-0.0.1-SNAPSHOT.war /usr/app\nWORKDIR /usr/app\nEXPOSE 80",
        },
        {
            id: 'blank_5',
            instruction: "Write the startup command to run the Java application.",
            expectedAnswer: 'CMD ["java", "-jar", "test-java-0.0.1-SNAPSHOT.war"]',
            outputSimulation: "# Dockerfile — COMPLETE ✓\nFROM java:8-jdk-alpine\nCOPY test-java-0.0.1-SNAPSHOT.war /usr/app\nWORKDIR /usr/app\nEXPOSE 80\nCMD [\"java\", \"-jar\", \"test-java-0.0.1-SNAPSHOT.war\"]",
        }
    ]
};

// Export all scenarios
export const scenarios: LogicScenario[] = [k8sScenario, dockerScenario];

// Default export for backward compat
export const scenario = k8sScenario;
