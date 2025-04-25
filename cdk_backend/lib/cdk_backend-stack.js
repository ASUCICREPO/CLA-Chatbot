"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.CdkBackendStack1 = void 0;
const cdk = require("aws-cdk-lib");
const s3 = require("aws-cdk-lib/aws-s3");
const lambda = require("aws-cdk-lib/aws-lambda");
const os = require("os");
const aws_cdk_lib_1 = require("aws-cdk-lib");
const iam = require("aws-cdk-lib/aws-iam");
const apigatewayv2 = require("aws-cdk-lib/aws-apigatewayv2");
const apigatewayv2_integrations = require("aws-cdk-lib/aws-apigatewayv2-integrations");
const generative_ai_cdk_constructs_1 = require("@cdklabs/generative-ai-cdk-constructs");
const secretsmanager = require("aws-cdk-lib/aws-secretsmanager");
const amplify = require("@aws-cdk/aws-amplify-alpha");
class CdkBackendStack1 extends cdk.Stack {
    constructor(scope, id, props) {
        super(scope, id, props);
        const githubToken = this.node.tryGetContext('githubToken');
        const githubOwner = this.node.tryGetContext('githubOwner');
        const githubRepo = this.node.tryGetContext('githubRepo');
        if (!githubToken || !githubOwner) {
            throw new Error('Please provide the githubToken, and githubOwner in the context. like this: cdk deploy -c githubToken=your-github-token -c githubOwner=your-github-owner -c githubRepo=your-github-repo');
        }
        const githubToken_secret_manager = new secretsmanager.Secret(this, 'GitHubToken', {
            secretName: 'github-token',
            description: 'GitHub Personal Access Token for Amplify',
            secretStringValue: cdk.SecretValue.unsafePlainText(githubToken)
        });
        const aws_region = cdk.Stack.of(this).region;
        const accountId = cdk.Stack.of(this).account;
        console.log(`AWS Region: ${aws_region}`);
        // detect Architecture
        const hostArchitecture = os.arch();
        console.log(`Host architecture: ${hostArchitecture}`);
        const lambdaArchitecture = hostArchitecture === 'arm64' ? lambda.Architecture.ARM_64 : lambda.Architecture.X86_64;
        console.log(`Lambda architecture: ${lambdaArchitecture}`);
        // Create an S3 bucket
        // amazonq-ignore-next-line
        const WebsiteData = new s3.Bucket(this, 'WebsiteData', {
            versioned: true,
            removalPolicy: cdk.RemovalPolicy.RETAIN,
        });
        // role with s3 access and bedrock full access
        const bedrockRole = new iam.Role(this, 'BedrockRole2', {
            assumedBy: new iam.ServicePrincipal('bedrock.amazonaws.com'),
            managedPolicies: [
                // amazonq-ignore-next-line
                iam.ManagedPolicy.fromAwsManagedPolicyName('AmazonS3FullAccess'),
                iam.ManagedPolicy.fromAwsManagedPolicyName('AmazonBedrockFullAccess'),
                iam.ManagedPolicy.fromAwsManagedPolicyName('CloudWatchFullAccessV2'),
            ]
        });
        bedrockRole.addToPolicy(new iam.PolicyStatement({
            actions: ['neptune-graph:*'],
            resources: ['*'],
        }));
        const bedrockRoleAgentPDF = new iam.Role(this, 'BedrockRole3', {
            assumedBy: new iam.ServicePrincipal('bedrock.amazonaws.com'),
            managedPolicies: [
                // amazonq-ignore-next-line
                iam.ManagedPolicy.fromAwsManagedPolicyName('AmazonS3FullAccess'),
                iam.ManagedPolicy.fromAwsManagedPolicyName('AmazonBedrockFullAccess'),
                iam.ManagedPolicy.fromAwsManagedPolicyName('CloudWatchFullAccessV2'),
            ]
        });
        const bedrockRoleAgentSupervisor = new iam.Role(this, 'BedrockRole', {
            assumedBy: new iam.ServicePrincipal('bedrock.amazonaws.com'),
            managedPolicies: [
                // amazonq-ignore-next-line
                iam.ManagedPolicy.fromAwsManagedPolicyName('AmazonS3FullAccess'),
                iam.ManagedPolicy.fromAwsManagedPolicyName('AmazonBedrockFullAccess'),
                iam.ManagedPolicy.fromAwsManagedPolicyName('CloudWatchFullAccessV2'),
            ]
        });
        const graphKb = new generative_ai_cdk_constructs_1.bedrock.GraphKnowledgeBase(this, 'GraphRagKB', {
            name: 'InmateDataGraphKB',
            description: 'A knowledge base for Inmate Data combied PDF and CSV',
            embeddingModel: generative_ai_cdk_constructs_1.bedrock.BedrockFoundationModel.TITAN_EMBED_TEXT_V2_1024,
            instruction: 'Use the Neptune-backed graph to answer inmate-data queries.',
            existingRole: bedrockRole,
        });
        new aws_cdk_lib_1.aws_bedrock.CfnDataSource(this, 'KnowledgeBaseDataSource', {
            name: 'InmateDataKnowledgeBase12',
            knowledgeBaseId: graphKb.knowledgeBaseId,
            dataSourceConfiguration: {
                type: 'S3',
                s3Configuration: {
                    bucketArn: WebsiteData.bucketArn,
                },
            },
            vectorIngestionConfiguration: {
                // keep your existing parsing config
                parsingConfiguration: {
                    parsingStrategy: 'BEDROCK_DATA_AUTOMATION',
                },
                // ← required for Neptune Analytics (GraphRAG)
                contextEnrichmentConfiguration: {
                    type: 'BEDROCK_FOUNDATION_MODEL',
                    bedrockFoundationModelConfiguration: {
                        modelArn: generative_ai_cdk_constructs_1.bedrock.BedrockFoundationModel.ANTHROPIC_CLAUDE_HAIKU_V1_0.modelArn,
                        enrichmentStrategyConfiguration: {
                            method: 'CHUNK_ENTITY_EXTRACTION',
                        },
                    },
                },
            },
        });
        const guardrail = new generative_ai_cdk_constructs_1.bedrock.Guardrail(this, 'bedrockGuardrails', {
            name: 'ChatbotGuardrails',
            blockedOutputsMessaging: 'I am sorry, but I cannot provide that information. Plase ask me something else.',
        });
        const DEFAULT_INPUT = generative_ai_cdk_constructs_1.bedrock.ContentFilterStrength.HIGH;
        const DEFAULT_OUTPUT = generative_ai_cdk_constructs_1.bedrock.ContentFilterStrength.MEDIUM;
        const INPUT_MODS = [generative_ai_cdk_constructs_1.bedrock.ModalityType.TEXT, generative_ai_cdk_constructs_1.bedrock.ModalityType.IMAGE];
        const OUTPUT_MODS = [generative_ai_cdk_constructs_1.bedrock.ModalityType.TEXT];
        // Grab just the string‐enum members
        const allFilters = Object
            .values(generative_ai_cdk_constructs_1.bedrock.ContentFilterType)
            .filter((f) => typeof f === 'string');
        for (const type of allFilters) {
            const responseStrength = type === generative_ai_cdk_constructs_1.bedrock.ContentFilterType.PROMPT_ATTACK
                ? generative_ai_cdk_constructs_1.bedrock.ContentFilterStrength.NONE
                : DEFAULT_OUTPUT;
            guardrail.addContentFilter({
                type,
                inputStrength: DEFAULT_INPUT,
                outputStrength: responseStrength,
                inputModalities: INPUT_MODS,
                outputModalities: OUTPUT_MODS,
            });
        }
        // cross region inference profile from genai cdk
        const cris_nova = generative_ai_cdk_constructs_1.bedrock.CrossRegionInferenceProfile.fromConfig({
            geoRegion: generative_ai_cdk_constructs_1.bedrock.CrossRegionInferenceProfileRegion.US,
            model: generative_ai_cdk_constructs_1.bedrock.BedrockFoundationModel.AMAZON_NOVA_PRO_V1,
        });
        const cris_claude = generative_ai_cdk_constructs_1.bedrock.CrossRegionInferenceProfile.fromConfig({
            geoRegion: generative_ai_cdk_constructs_1.bedrock.CrossRegionInferenceProfileRegion.US,
            model: generative_ai_cdk_constructs_1.bedrock.BedrockFoundationModel.ANTHROPIC_CLAUDE_3_5_SONNET_V2_0,
        });
        const prompt_for_PDF_agent = `You are an AI assistant with access to a library of PDF documents. When a user asks a question:
    1. Search the knowledge base for relevant PDF files only; ignore any CSVs or other formats.
    2. Extract and summarize the key information from those PDFs.
    3. Answer the user clearly and concisely, citing only the PDF-sourced data.
    4. If no PDF contains the requested information, reply:
      “I couldn't find any relevant information in the available PDF documents I have.”
    5. <IMPORTANT> If you find multiple data sources that differ by any dimension—such as year, demographic group (e.g., male/female), region, or other categories—list the dimensions and the available options, then ask:
      “I found data for multiple [dimensions]: [options]. Which [dimension] would you like to focus on?”
      For example:
        - “I found data for years: 2018, 2019, 2020. Which year are you interested in?”
        - “I found data for groups: male, female, combined. Which group should I use?”</IMPORTANT>`;
        const PDF_agent = new generative_ai_cdk_constructs_1.bedrock.Agent(this, 'Agent-PDF', {
            name: 'PDFAgent-with-knowledge-base-v1',
            description: 'This agent is responsible for processing non-quantitative queries using PDF files and knowledge base.',
            foundationModel: cris_nova,
            shouldPrepareAgent: true,
            knowledgeBases: [graphKb],
            existingRole: bedrockRoleAgentPDF,
            instruction: prompt_for_PDF_agent,
        });
        const PDF_agent_Alias = new generative_ai_cdk_constructs_1.bedrock.AgentAlias(this, 'PDFAgentAlias', {
            agent: PDF_agent,
            aliasName: "ProductionPDFAgentv1",
            description: 'Production alias for the PDF agent',
        });
        const prompt_for_supervisor = `You are the Supervisor Agent, acting as the primary CSV processing agent. Your role is to process quantitative, data-driven queries using attached CSV files via the Code Interpreter. If the CSV-based approach fails (e.g., due to missing data, insufficient columns, or inability to compute the required result), then delegate the query to the agent PDF-Agent-With-KB for a text-based response and then give the final answer.

    1. Analyze the Query:
      - For quantitative/data-driven queries (e.g., "What are the top male percentages by county?" or "Calculate the average sales value"):
        - Attempt to process using the attached CSV files via the Code Interpreter.
        - Generate Python code dynamically to perform the requested operation. For example, if the user asks, "What's the average of the 'sales' column?" filter the data if needed, calculate the average, and answer the user's query based on the CSV file provided. Make sure to include error handling and check that the CSV file contains the required columns.
        - **Important:** Ensure that the Python code is properly indented using 4 spaces per indentation level (no tabs or extra spaces) to avoid indentation errors.
      - If CSV processing is unsuccessful, or if the necessary CSV data is unavailable, route the query to PDF-Agent-With-KB with multi-agent collaboration.
      - For text-based queries (e.g., "What is CLA?" or "Summarize the jail reform report"), handle them directly via PDF-Agent-With-KB with multi-agent collaboration.

    2. Routing Decisions:
      - For quantitative queries:
        - If CSV processing fails, delegate the query to PDF-Agent-With-KB using multi-agent collaboration.
      - For text-based queries:
        - Answer directly using PDF-Agent-With-KB.

    3. Additional Guidelines:
      - Do not mix quantitative (CSV-based) and qualitative (text-based) responses in a single answer.
      - Always include a clear, concise explanation of your internal routing decision.
      - Provide clear and concise answers without revealing any internal routing or error-handling steps.
      - Do not disclose internal messages such as “CSV processing failed; routing to PDF-Agent-With-KB for text-based analysis.”
      - **Internal Instruction:** Do not send internal routing messages (e.g., "CSV processing failed; routing to PDF-Agent-With-KB for text-based analysis.") to the user front end. These messages should be kept internal as part of multi-agent collaboration.
      - Ensure every delegated query includes all necessary context and any attached CSV files for accurate processing.

    4. CSV List Length Requirement:
      - If the list of items in the CSV has more than 15 rows, return the output as a CSV file.

    By following these instructions, you ensure that each query is handled using the most appropriate method, yielding reliable and accurate responses without exposing internal routing decisions to the user.
    `;
        const prompt_collaboration_Supervisor_X_PDF = `The PDF-Agent handles non-quantitative queries by retrieving and synthesizing information exclusively from PDF documents in the Knowledge Base. When a user asks for summaries, explanations, or textual analyses, or if the you cannot process the query, PDF-Agent ignores CSV files entirely and only answers based on textual information in PDF.`;
        const SupervisorAgentWithCodeInterpreter = new generative_ai_cdk_constructs_1.bedrock.Agent(this, 'SupervisorAgentWithCodeInterpreter', {
            name: 'SupervisorAgentWithCodeInterpreterv1',
            description: 'This agent is responsible for processing quantitative queries using CSV files and routing non-quantitative queries to the PDF agent.',
            instruction: prompt_for_supervisor,
            foundationModel: cris_claude,
            shouldPrepareAgent: true,
            userInputEnabled: true,
            codeInterpreterEnabled: true,
            guardrail: guardrail,
            existingRole: bedrockRoleAgentSupervisor,
            agentCollaboration: generative_ai_cdk_constructs_1.bedrock.AgentCollaboratorType.SUPERVISOR_ROUTER,
            memory: generative_ai_cdk_constructs_1.bedrock.Memory.sessionSummary({
                maxRecentSessions: 10,
                memoryDurationDays: 30,
            }),
            agentCollaborators: [
                new generative_ai_cdk_constructs_1.bedrock.AgentCollaborator({
                    agentAlias: PDF_agent_Alias,
                    collaborationInstruction: prompt_collaboration_Supervisor_X_PDF,
                    collaboratorName: 'PDFAgentWithKnowledgeBase-v1',
                    relayConversationHistory: true,
                }),
            ],
        });
        const Supervisor_Agent_Alias = new generative_ai_cdk_constructs_1.bedrock.AgentAlias(this, 'SupervisorAgentAlias', {
            agent: SupervisorAgentWithCodeInterpreter,
            aliasName: "ProductionSupervisorAgentv1",
            description: 'Production alias for the Supervisor agent',
        });
        const webSocketApi = new apigatewayv2.WebSocketApi(this, 'cla-web-socket-api', {
            apiName: 'cla-web-socket-api',
        });
        const webSocketStage = new apigatewayv2.WebSocketStage(this, 'cla-web-socket-stage', {
            webSocketApi,
            stageName: 'production',
            autoDeploy: true,
        });
        const InmateSummaryScrapper = new lambda.Function(this, 'InmateSummaryScrapper', {
            runtime: lambda.Runtime.PYTHON_3_12,
            handler: 'handler.lambda_handler',
            code: lambda.Code.fromDockerBuild('lambda/InmateSummaryScrapper'),
            architecture: lambdaArchitecture,
            environment: {
                BUCKET_NAME: WebsiteData.bucketName,
                REGION: aws_region,
            },
            timeout: cdk.Duration.seconds(60),
        });
        const CondemnedInmateListScrapper = new lambda.Function(this, 'CondemnedInmateListScrapper', {
            runtime: lambda.Runtime.PYTHON_3_12,
            handler: 'handler.lambda_handler',
            code: lambda.Code.fromDockerBuild('lambda/CondemnedInmateListScrapper'),
            architecture: lambdaArchitecture,
            environment: {
                BUCKET_NAME: WebsiteData.bucketName,
                REGION: aws_region,
            },
            timeout: cdk.Duration.seconds(60),
        });
        const ScoreJailRosterScraper = new lambda.Function(this, 'ScoreJailRosterScraper', {
            runtime: lambda.Runtime.PYTHON_3_12,
            handler: 'handler.lambda_handler',
            code: lambda.Code.fromDockerBuild('lambda/ScoreJailRosterScraper'),
            architecture: lambdaArchitecture,
            environment: {
                BUCKET_NAME: WebsiteData.bucketName,
                REGION: aws_region,
            },
            timeout: cdk.Duration.seconds(60),
        });
        const BedrockAIAgent = new lambda.Function(this, 'BedrockAIAgent', {
            runtime: lambda.Runtime.PYTHON_3_12,
            handler: 'handler.lambda_handler',
            code: lambda.Code.fromDockerBuild('lambda/BedrockAIAgent'),
            architecture: lambdaArchitecture,
            environment: {
                BUCKET_NAME: WebsiteData.bucketName,
                REGION: aws_region,
                URL: webSocketStage.callbackUrl,
                KB_ID: graphKb.knowledgeBaseId,
                SUPERVISOR_AGENT_ID: SupervisorAgentWithCodeInterpreter.agentId,
                SUPERVISOR_AGENT_ALIAS_ID: Supervisor_Agent_Alias.aliasId,
            },
            timeout: cdk.Duration.seconds(120),
        });
        const webSocketHandler = new lambda.Function(this, 'cla-web-socket-handler', {
            runtime: lambda.Runtime.PYTHON_3_12,
            code: lambda.Code.fromAsset('lambda/web_socket_opener'),
            handler: 'handler.lambda_handler',
            environment: {
                RESPONSE_FUNCTION_ARN: BedrockAIAgent.functionArn
            }
        });
        // Grant the Lambda function permissions to read from the S3 bucket
        WebsiteData.grantReadWrite(InmateSummaryScrapper);
        WebsiteData.grantReadWrite(CondemnedInmateListScrapper);
        WebsiteData.grantReadWrite(ScoreJailRosterScraper);
        WebsiteData.grantRead(BedrockAIAgent);
        // Grant Lambda function full access to bedrock and 
        BedrockAIAgent.role?.addManagedPolicy(cdk.aws_iam.ManagedPolicy.fromAwsManagedPolicyName('AmazonBedrockFullAccess'));
        // api gateway 
        BedrockAIAgent.role?.addManagedPolicy(cdk.aws_iam.ManagedPolicy.fromAwsManagedPolicyName('AmazonAPIGatewayInvokeFullAccess'));
        BedrockAIAgent.grantInvoke(webSocketHandler);
        const webSocketIntegration = new apigatewayv2_integrations.WebSocketLambdaIntegration('web-socket-integration', webSocketHandler);
        webSocketApi.addRoute('sendMessage', {
            integration: webSocketIntegration,
            returnResponse: true
        });
        const amplifyApp = new amplify.App(this, 'ChatbotUI', {
            sourceCodeProvider: new amplify.GitHubSourceCodeProvider({
                owner: githubOwner,
                repository: githubRepo,
                oauthToken: githubToken_secret_manager.secretValue
            }),
            buildSpec: cdk.aws_codebuild.BuildSpec.fromObjectToYaml({
                version: '1.0',
                frontend: {
                    phases: {
                        preBuild: {
                            commands: ['cd frontend', 'npm ci']
                        },
                        build: {
                            commands: ['npm run build']
                        }
                    },
                    artifacts: {
                        baseDirectory: 'frontend/build',
                        files: ['**/*']
                    },
                    cache: {
                        paths: ['frontend/node_modules/**/*']
                    }
                }
            }),
        });
        const mainBranch = amplifyApp.addBranch('main', {
            autoBuild: true,
            stage: 'PRODUCTION'
        });
        amplifyApp.addEnvironment('REACT_APP_WEBSOCKET_API', webSocketStage.url);
        amplifyApp.addEnvironment('REACT_APP_BUCKET_NAME', WebsiteData.bucketName);
        amplifyApp.addEnvironment('REACT_APP_BUCKET_REGION', this.region);
        amplifyApp.addEnvironment('REACT_APP_AWS_REGION', this.region);
        githubToken_secret_manager.grantRead(amplifyApp);
        // Output the bucket name
        new cdk.CfnOutput(this, 'WebsiteDataBucketName', {
            value: WebsiteData.bucketName,
            description: 'The name of the S3 bucket where website data will be stored',
            exportName: 'WebsiteDataBucketName',
        });
        new cdk.CfnOutput(this, 'WebSocketURL', {
            value: webSocketStage.callbackUrl,
            description: 'WebSocket URL'
        });
        new cdk.CfnOutput(this, 'AmplifyAppURL', {
            value: `https://${mainBranch.branchName}.${amplifyApp.defaultDomain}`,
            description: 'Amplify Application URL'
        });
        // output the WebSocket API URL
        new cdk.CfnOutput(this, 'WebSocketApiUrl', {
            value: webSocketApi.apiEndpoint,
            description: 'The URL of the WebSocket API',
            exportName: 'WebSocketApiUrl',
        });
        // knowledge base id
        new cdk.CfnOutput(this, 'KnowledgeBaseId', {
            value: graphKb.knowledgeBaseId,
            description: 'The ID of the knowledge base',
            exportName: 'KnowledgeBaseId',
        });
        // supervisor agent id
        new cdk.CfnOutput(this, 'SupervisorAgentId', {
            value: SupervisorAgentWithCodeInterpreter.agentId,
            description: 'The ID of the Supervisor agent',
            exportName: 'SupervisorAgentId',
        });
        // pdf agent id
        new cdk.CfnOutput(this, 'PDFAgentId', {
            value: PDF_agent.agentId,
            description: 'The ID of the PDF agent',
            exportName: 'PDFAgentId',
        });
    }
}
exports.CdkBackendStack1 = CdkBackendStack1;
//# sourceMappingURL=data:application/json;base64,eyJ2ZXJzaW9uIjozLCJmaWxlIjoiY2RrX2JhY2tlbmQtc3RhY2suanMiLCJzb3VyY2VSb290IjoiIiwic291cmNlcyI6WyJjZGtfYmFja2VuZC1zdGFjay50cyJdLCJuYW1lcyI6W10sIm1hcHBpbmdzIjoiOzs7QUFBQSxtQ0FBbUM7QUFFbkMseUNBQXlDO0FBQ3pDLGlEQUFpRDtBQUNqRCx5QkFBeUI7QUFDekIsNkNBQXNEO0FBQ3RELDJDQUEyQztBQUMzQyw2REFBNkQ7QUFDN0QsdUZBQXVGO0FBQ3ZGLHdGQUEyRTtBQUMzRSxpRUFBaUU7QUFDakUsc0RBQXNEO0FBR3RELE1BQWEsZ0JBQWlCLFNBQVEsR0FBRyxDQUFDLEtBQUs7SUFDN0MsWUFBWSxLQUFnQixFQUFFLEVBQVUsRUFBRSxLQUFzQjtRQUM5RCxLQUFLLENBQUMsS0FBSyxFQUFFLEVBQUUsRUFBRSxLQUFLLENBQUMsQ0FBQztRQUV4QixNQUFNLFdBQVcsR0FBRyxJQUFJLENBQUMsSUFBSSxDQUFDLGFBQWEsQ0FBQyxhQUFhLENBQUMsQ0FBQztRQUMzRCxNQUFNLFdBQVcsR0FBRyxJQUFJLENBQUMsSUFBSSxDQUFDLGFBQWEsQ0FBQyxhQUFhLENBQUMsQ0FBQztRQUMzRCxNQUFNLFVBQVUsR0FBRyxJQUFJLENBQUMsSUFBSSxDQUFDLGFBQWEsQ0FBQyxZQUFZLENBQUMsQ0FBQztRQUV6RCxJQUFJLENBQUMsV0FBVyxJQUFJLENBQUMsV0FBVyxFQUFFLENBQUM7WUFDakMsTUFBTSxJQUFJLEtBQUssQ0FBQyx3TEFBd0wsQ0FBQyxDQUFDO1FBQzVNLENBQUM7UUFFRCxNQUFNLDBCQUEwQixHQUFHLElBQUksY0FBYyxDQUFDLE1BQU0sQ0FBQyxJQUFJLEVBQUUsYUFBYSxFQUFFO1lBQ2hGLFVBQVUsRUFBRSxjQUFjO1lBQzFCLFdBQVcsRUFBRSwwQ0FBMEM7WUFDdkQsaUJBQWlCLEVBQUUsR0FBRyxDQUFDLFdBQVcsQ0FBQyxlQUFlLENBQUMsV0FBVyxDQUFDO1NBQ2hFLENBQUMsQ0FBQztRQUVILE1BQU0sVUFBVSxHQUFHLEdBQUcsQ0FB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LENBQUMsSUFBSSxFQUFFLGVBQWUsRUFBRTtZQUN2QyxLQUFLLEVBQUUsV0FBVyxVQUFVLENBQUMsVUFBVSxJQUFJLFVBQVUsQ0FBQyxhQUFhLEVBQUU7WUFDckUsV0FBVyxFQUFFLHlCQUF5QjtTQUN2QyxDQUFDLENBQUM7UUFHSCwrQkFBK0I7UUFDL0IsSUFBSSxHQUFHLENBQUMsU0FBUyxDQUFDLElBQUksRUFBRSxpQkFBaUIsRUFBRTtZQUN6QyxLQUFLLEVBQUUsWUFBWSxDQUFDLFdBQVc7WUFDL0IsV0FBVyxFQUFFLDhCQUE4QjtZQUMzQyxVQUFVLEVBQUUsaUJBQWlCO1NBQzlCLENBQUMsQ0FBQztRQUNILG9CQUFvQjtRQUNwQixJQUFJLEdBQUcsQ0FBQyxTQUFTLENBQUMsSUFBSSxFQUFFLGlCQUFpQixFQUFFO1lBQ3pDLEtBQUssRUFBRSxPQUFPLENBQUMsZUFBZTtZQUM5QixXQUFXLEVBQUUsOEJBQThCO1lBQzNDLFVBQVUsRUFBRSxpQkFBaUI7U0FDOUIsQ0FBQyxDQUFDO1FBQ0gsc0JBQXNCO1FBQ3RCLElBQUksR0FBRyxDQUFDLFNBQVMsQ0FBQyxJQUFJLEVBQUUsbUJBQW1CLEVBQUU7WUFDM0MsS0FBSyxFQUFFLGtDQUFrQyxDQUFDLE9BQU87WUFDakQsV0FBVyxFQUFFLGdDQUFnQztZQUM3QyxVQUFVLEVBQUUsbUJBQW1CO1NBQ2hDLENBQUMsQ0FBQztRQUNILGVBQWU7UUFDZixJQUFJLEdBQUcsQ0FBQyxTQUFTLENBQUMsSUFBSSxFQUFFLFlBQVksRUFBRTtZQUNwQyxLQUFLLEVBQUUsU0FBUyxDQUFDLE9BQU87WUFDeEIsV0FBVyxFQUFFLHlCQUF5QjtZQUN0QyxVQUFVLEVBQUUsWUFBWTtTQUN6QixDQUFDLENBQUM7SUFFTCxDQUFDO0NBQ0Y7QUExYUQsNENBMGFDIiwic291cmNlc0NvbnRlbnQiOlsiaW1wb3J0ICogYXMgY2RrIGZyb20gJ2F3cy1jZGstbGliJztcbmltcG9ydCB7IENvbnN0cnVjdCB9IGZyb20gJ2NvbnN0cnVjdHMnO1xuaW1wb3J0ICogYXMgczMgZnJvbSAnYXdzLWNkay1saWIvYXdzLXMzJztcbmltcG9ydCAqIGFzIGxhbWJkYSBmcm9tICdhd3MtY2RrLWxpYi9hd3MtbGFtYmRhJztcbmltcG9ydCAqIGFzIG9zIGZyb20gJ29zJztcbmltcG9ydCB7IGF3c19iZWRyb2NrIGFzIGJlZHJvY2syIH0gZnJvbSAnYXdzLWNkay1saWInO1xuaW1wb3J0ICogYXMgaWFtIGZyb20gJ2F3cy1jZGstbGliL2F3cy1pYW0nO1xuaW1wb3J0ICogYXMgYXBpZ2F0ZXdheXYyIGZyb20gJ2F3cy1jZGstbGliL2F3cy1hcGlnYXRld2F5djInO1xuaW1wb3J0ICogYXMgYXBpZ2F0ZXdheXYyX2ludGVncmF0aW9ucyBmcm9tICdhd3MtY2RrLWxpYi9hd3MtYXBpZ2F0ZXdheXYyLWludGVncmF0aW9ucyc7XG5pbXBvcnQgeyBiZWRyb2NrIGFzIGJlZHJvY2sgfSBmcm9tICdAY2RrbGFicy9nZW5lcmF0aXZlLWFpLWNkay1jb25zdHJ1Y3RzJztcbmltcG9ydCAqIGFzIHNlY3JldHNtYW5hZ2VyIGZyb20gJ2F3cy1jZGstbGliL2F3cy1zZWNyZXRzbWFuYWdlcic7XG5pbXBvcnQgKiBhcyBhbXBsaWZ5IGZyb20gJ0Bhd3MtY2RrL2F3cy1hbXBsaWZ5LWFscGhhJztcblxuXG5leHBvcnQgY2xhc3MgQ2RrQmFja2VuZFN0YWNrMSBleHRlbmRzIGNkay5TdGFjayB7XG4gIGNvbnN0cnVjdG9yKHNjb3BlOiBDb25zdHJ1Y3QsIGlkOiBzdHJpbmcsIHByb3BzPzogY2RrLlN0YWNrUHJvcHMpIHtcbiAgICBzdXBlcihzY29wZSwgaWQsIHByb3BzKTtcblxuICAgIGNvbnN0IGdpdGh1YlRva2VuID0gdGhpcy5ub2RlLnRyeUdldENvbnRleHQoJ2dpdGh1YlRva2VuJyk7XG4gICAgY29uc3QgZ2l0aHViT3duZXIgPSB0aGlzLm5vZGUudHJ5R2V0Q29udGV4dCgnZ2l0aHViT3duZXInKTtcbiAgICBjb25zdCBnaXRodWJSZXBvID0gdGhpcy5ub2RlLnRyeUdldENvbnRleHQoJ2dpdGh1YlJlcG8nKTtcbiAgICBcbiAgICBpZiAoIWdpdGh1YlRva2VuIHx8ICFnaXRodWJPd25lcikge1xuICAgICAgdGhyb3cgbmV3IEVycm9yKCdQbGVhc2UgcHJvdmlkZSB0aGUgZ2l0aHViVG9rZW4sIGFuZCBnaXRodWJPd25lciBpbiB0aGUgY29udGV4dC4gbGlrZSB0aGlzOiBjZGsgZGVwbG95IC1jIGdpdGh1YlRva2VuPXlvdXItZ2l0aHViLXRva2VuIC1jIGdpdGh1Yk93bmVyPXlvdXItZ2l0aHViLW93bmVyIC1jIGdpdGh1YlJlcG89eW91ci1naXRodWItcmVwbycpO1xuICAgIH1cblxuICAgIGNvbnN0IGdpdGh1YlRva2VuX3NlY3JldF9tYW5hZ2VyID0gbmV3IHNlY3JldHNtYW5hZ2VyLlNlY3JldCh0aGlzLCAnR2l0SHViVG9rZW4nLCB7XG4gICAgICBzZWNyZXROYW1lOiAnZ2l0aHViLXRva2VuJyxcbiAgICAgIGRlc2NyaXB0aW9uOiAnR2l0SHViIFBlcnNvbmFsIEFjY2VzcyBUb2tlbiBmb3IgQW1wbGlmeScsXG4gICAgICBzZWNyZXRTdHJpbmdWYWx1ZTogY2RrLlNlY3JldFZhbHVlLnVuc2FmZVBsYWluVGV4dChnaXRodWJUb2tlbilcbiAgICB9KTtcblxuICAgIGNvbnN0IGF3c19yZWdpb24gPSBjZGsuU3RhY2sub2YodGhpcykucmVnaW9uO1xuICAgIGNvbnN0IGFjY291bnRJZCA9IGNkay5TdGFjay5vZih0aGlzKS5hY2NvdW50O1xuICAgIGNvbnNvbGUubG9nKGBBV1MgUmVnaW9uOiAke2F3c19yZWdpb259YCk7XG5cbiAgICAvLyBkZXRlY3QgQXJjaGl0ZWN0dXJlXG4gICAgY29uc3QgaG9zdEFyY2hpdGVjdHVyZSA9IG9zLmFyY2goKTsgXG4gICAgY29uc29sZS5sb2coYEhvc3QgYXJjaGl0ZWN0dXJlOiAke2hvc3RBcmNoaXRlY3R1cmV9YCk7XG4gICAgXG4gICAgY29uc3QgbGFtYmRhQXJjaGl0ZWN0dXJlID0gaG9zdEFyY2hpdGVjdHVyZSA9PT0gJ2FybTY0JyA/IGxhbWJkYS5BcmNoaXRlY3R1cmUuQVJNXzY0IDogbGFtYmRhLkFyY2hpdGVjdHVyZS5YODZfNjQ7XG4gICAgY29uc29sZS5sb2coYExhbWJkYSBhcmNoaXRlY3R1cmU6ICR7bGFtYmRhQXJjaGl0ZWN0dXJlfWApO1xuICAgIC8vIENyZWF0ZSBhbiBTMyBidWNrZXRcbiAgICAvLyBhbWF6b25xLWlnbm9yZS1uZXh0LWxpbmVcbiAgICBjb25zdCBXZWJzaXRlRGF0YSA9IG5ldyBzMy5CdWNrZXQodGhpcywgJ1dlYnNpdGVEYXRhJywge1xuICAgICAgdmVyc2lvbmVkOiB0cnVlLFxuICAgICAgcmVtb3ZhbFBvbGljeTogY2RrLlJlbW92YWxQb2xpY3kuUkVUQUlOLCBcbiAgICB9KTtcblxuICAgIC8vIHJvbGUgd2l0aCBzMyBhY2Nlc3MgYW5kIGJlZHJvY2sgZnVsbCBhY2Nlc3NcbiAgICBjb25zdCBiZWRyb2NrUm9sZSA9IG5ldyBpYW0uUm9sZSh0aGlzLCAnQmVkcm9ja1JvbGUyJywge1xuICAgICAgYXNzdW1lZEJ5OiBuZXcgaWFtLlNlcnZpY2VQcmluY2lwYWwoJ2JlZHJvY2suYW1hem9uYXdzLmNvbScpLFxuICAgICAgbWFuYWdlZFBvbGljaWVzOiBbXG4gICAgICAgIC8vIGFtYXpvbnEtaWdub3JlLW5leHQtbGluZVxuICAgICAgICBpYW0uTWFuYWdlZFBvbGljeS5mcm9tQXdzTWFuYWdlZFBvbGljeU5hbWUoJ0FtYXpvblMzRnVsbEFjY2VzcycpLFxuICAgICAgICBpYW0uTWFuYWdlZFBvbGljeS5mcm9tQXdzTWFuYWdlZFBvbGljeU5hbWUoJ0FtYXpvbkJlZHJvY2tGdWxsQWNjZXNzJyksXG4gICAgICAgIGlhbS5NYW5hZ2VkUG9saWN5LmZyb21Bd3NNYW5hZ2VkUG9saWN5TmFtZSgnQ2xvdWRXYXRjaEZ1bGxBY2Nlc3NWMicpLFxuICAgICAgXX0pO1xuXG4gICAgYmVkcm9ja1JvbGUuYWRkVG9Qb2xpY3kobmV3IGlhbS5Qb2xpY3lTdGF0ZW1lbnQoe1xuICAgICAgICBhY3Rpb25zOiAgIFsnbmVwdHVuZS1ncmFwaDoqJ10sXG4gICAgICAgIHJlc291cmNlczogWycqJ10sXG4gICAgICB9KSk7XG5cbiAgICAgIGNvbnN0IGJlZHJvY2tSb2xlQWdlbnRQREYgPSBuZXcgaWFtLlJvbGUodGhpcywgJ0JlZHJvY2tSb2xlMycsIHtcbiAgICAgIGFzc3VtZWRCeTogbmV3IGlhbS5TZXJ2aWNlUHJpbmNpcGFsKCdiZWRyb2NrLmFtYXpvbmF3cy5jb20nKSxcbiAgICAgIG1hbmFnZWRQb2xpY2llczogW1xuICAgICAgICAvLyBhbWF6b25xLWlnbm9yZS1uZXh0LWxpbmVcbiAgICAgICAgaWFtLk1hbmFnZWRQb2xpY3kuZnJvbUF3c01hbmFnZWRQb2xpY3lOYW1lKCdBbWF6b25TM0Z1bGxBY2Nlc3MnKSxcbiAgICAgICAgaWFtLk1hbmFnZWRQb2xpY3kuZnJvbUF3c01hbmFnZWRQb2xpY3lOYW1lKCdBbWF6b25CZWRyb2NrRnVsbEFjY2VzcycpLFxuICAgICAgICBpYW0uTWFuYWdlZFBvbGljeS5mcm9tQXdzTWFuYWdlZFBvbGljeU5hbWUoJ0Nsb3VkV2F0Y2hGdWxsQWNjZXNzVjInKSxcbiAgICAgIF19KTtcblxuICAgICAgY29uc3QgYmVkcm9ja1JvbGVBZ2VudFN1cGVydmlzb3IgPSBuZXcgaWFtLlJvbGUodGhpcywgJ0JlZHJvY2tSb2xlJywge1xuICAgICAgICBhc3N1bWVkQnk6IG5ldyBpYW0uU2VydmljZVByaW5jaXBhbCgnYmVkcm9jay5hbWF6b25hd3MuY29tJyksXG4gICAgICAgIG1hbmFnZWRQb2xpY2llczogW1xuICAgICAgICAgIC8vIGFtYXpvbnEtaWdub3JlLW5leHQtbGluZVxuICAgICAgICAgIGlhbS5NYW5hZ2VkUG9saWN5LmZyb21Bd3NNYW5hZ2VkUG9saWN5TmFtZSgnQW1hem9uUzNGdWxsQWNjZXNzJyksXG4gICAgICAgICAgaWFtLk1hbmFnZWRQb2xpY3kuZnJvbUF3c01hbmFnZWRQb2xpY3lOYW1lKCdBbWF6b25CZWRyb2NrRnVsbEFjY2VzcycpLFxuICAgICAgICAgIGlhbS5NYW5hZ2VkUG9saWN5LmZyb21Bd3NNYW5hZ2VkUG9saWN5TmFtZSgnQ2xvdWRXYXRjaEZ1bGxBY2Nlc3NWMicpLFxuICAgICAgICBdfSk7XG5cbiAgICBjb25zdCBncmFwaEtiID0gbmV3IGJlZHJvY2suR3JhcGhLbm93bGVkZ2VCYXNlKHRoaXMsICdHcmFwaFJhZ0tCJywge1xuICAgICAgbmFtZTogJ0lubWF0ZURhdGFHcmFwaEtCJyxcbiAgICAgIGRlc2NyaXB0aW9uOiAnQSBrbm93bGVkZ2UgYmFzZSBmb3IgSW5tYXRlIERhdGEgY29tYmllZCBQREYgYW5kIENTVicsXG4gICAgICBlbWJlZGRpbmdNb2RlbDogYmVkcm9jay5CZWRyb2NrRm91bmRhdGlvbk1vZGVsLlRJVEFOX0VNQkVEX1RFWFRfVjJfMTAyNCxcbiAgICAgIGluc3RydWN0aW9uOiAnVXNlIHRoZSBOZXB0dW5lLWJhY2tlZCBncmFwaCB0byBhbnN3ZXIgaW5tYXRlLWRhdGEgcXVlcmllcy4nLFxuICAgICAgZXhpc3RpbmdSb2xlOiBiZWRyb2NrUm9sZSxcbiAgfSk7XG5cbiAgICBuZXcgYmVkcm9jazIuQ2ZuRGF0YVNvdXJjZSh0aGlzLCAnS25vd2xlZGdlQmFzZURhdGFTb3VyY2UnLCB7XG4gICAgICBuYW1lOiAnSW5tYXRlRGF0YUtub3dsZWRnZUJhc2UxMicsXG4gICAgICBrbm93bGVkZ2VCYXNlSWQ6IGdyYXBoS2Iua25vd2xlZGdlQmFzZUlkLFxuICAgICAgXG4gICAgICBcbiAgICAgIGRhdGFTb3VyY2VDb25maWd1cmF0aW9uOiB7XG4gICAgICAgIHR5cGU6ICdTMycsXG4gICAgICAgIHMzQ29uZmlndXJhdGlvbjoge1xuICAgICAgICAgIGJ1Y2tldEFybjogV2Vic2l0ZURhdGEuYnVja2V0QXJuLFxuICAgICAgICB9LFxuICAgICAgfSxcbiAgICAgIHZlY3RvckluZ2VzdGlvbkNvbmZpZ3VyYXRpb246IHtcbiAgICAgICAgLy8ga2VlcCB5b3VyIGV4aXN0aW5nIHBhcnNpbmcgY29uZmlnXG4gICAgICAgIHBhcnNpbmdDb25maWd1cmF0aW9uOiB7XG4gICAgICAgICAgcGFyc2luZ1N0cmF0ZWd5OiAnQkVEUk9DS19EQVRBX0FVVE9NQVRJT04nLFxuICAgICAgICB9LFxuICAgICAgICAvLyDihpAgcmVxdWlyZWQgZm9yIE5lcHR1bmUgQW5hbHl0aWNzIChHcmFwaFJBRylcbiAgICAgICAgY29udGV4dEVucmljaG1lbnRDb25maWd1cmF0aW9uOiB7XG4gICAgICAgICAgdHlwZTogJ0JFRFJPQ0tfRk9VTkRBVElPTl9NT0RFTCcsXG4gICAgICAgICAgYmVkcm9ja0ZvdW5kYXRpb25Nb2RlbENvbmZpZ3VyYXRpb246IHtcbiAgICAgICAgICAgIG1vZGVsQXJuOiBiZWRyb2NrLkJlZHJvY2tGb3VuZGF0aW9uTW9kZWwuQU5USFJPUElDX0NMQVVERV9IQUlLVV9WMV8wLm1vZGVsQXJuLFxuICAgICAgICAgICAgZW5yaWNobWVudFN0cmF0ZWd5Q29uZmlndXJhdGlvbjoge1xuICAgICAgICAgICAgICBtZXRob2Q6ICdDSFVOS19FTlRJVFlfRVhUUkFDVElPTicsXG4gICAgICAgICAgICB9LFxuICAgICAgICAgIH0sXG4gICAgICAgIH0sXG4gICAgICB9LFxuICAgIH0pO1xuXG5cbiAgICBjb25zdCBndWFyZHJhaWwgPSBuZXcgYmVkcm9jay5HdWFyZHJhaWwodGhpcywgJ2JlZHJvY2tHdWFyZHJhaWxzJywge1xuICAgICAgbmFtZTogJ0NoYXRib3RHdWFyZHJhaWxzJyxcbiAgICAgIGJsb2NrZWRPdXRwdXRzTWVzc2FnaW5nOiAnSSBhbSBzb3JyeSwgYnV0IEkgY2Fubm90IHByb3ZpZGUgdGhhdCBpbmZvcm1hdGlvbi4gUGxhc2UgYXNrIG1lIHNvbWV0aGluZyBlbHNlLicsXG4gICAgfSk7XG4gICAgXG4gICAgY29uc3QgREVGQVVMVF9JTlBVVCAgPSBiZWRyb2NrLkNvbnRlbnRGaWx0ZXJTdHJlbmd0aC5ISUdIO1xuICAgIGNvbnN0IERFRkFVTFRfT1VUUFVUID0gYmVkcm9jay5Db250ZW50RmlsdGVyU3RyZW5ndGguTUVESVVNO1xuICAgIGNvbnN0IElOUFVUX01PRFMgID0gW2JlZHJvY2suTW9kYWxpdHlUeXBlLlRFWFQsIGJlZHJvY2suTW9kYWxpdHlUeXBlLklNQUdFXTtcbiAgICBjb25zdCBPVVRQVVRfTU9EUyA9IFtiZWRyb2NrLk1vZGFsaXR5VHlwZS5URVhUXTtcblxuICAgIC8vIEdyYWIganVzdCB0aGUgc3RyaW5n4oCQZW51bSBtZW1iZXJzXG4gICAgY29uc3QgYWxsRmlsdGVycyA9IE9iamVjdFxuICAgICAgLnZhbHVlcyhiZWRyb2NrLkNvbnRlbnRGaWx0ZXJUeXBlKVxuICAgICAgLmZpbHRlcigoZik6IGYgaXMgYmVkcm9jay5Db250ZW50RmlsdGVyVHlwZSA9PiB0eXBlb2YgZiA9PT0gJ3N0cmluZycpO1xuXG4gICAgZm9yIChjb25zdCB0eXBlIG9mIGFsbEZpbHRlcnMpIHtcbiAgICAgIGNvbnN0IHJlc3BvbnNlU3RyZW5ndGggPVxuICAgICAgICB0eXBlID09PSBiZWRyb2NrLkNvbnRlbnRGaWx0ZXJUeXBlLlBST01QVF9BVFRBQ0tcbiAgICAgICAgICA/IGJlZHJvY2suQ29udGVudEZpbHRlclN0cmVuZ3RoLk5PTkVcbiAgICAgICAgICA6IERFRkFVTFRfT1VUUFVUO1xuXG4gICAgICBndWFyZHJhaWwuYWRkQ29udGVudEZpbHRlcih7XG4gICAgICAgIHR5cGUsXG4gICAgICAgIGlucHV0U3RyZW5ndGg6ICBERUZBVUxUX0lOUFVULFxuICAgICAgICBvdXRwdXRTdHJlbmd0aDogcmVzcG9uc2VTdHJlbmd0aCxcbiAgICAgICAgaW5wdXRNb2RhbGl0aWVzOiAgSU5QVVRfTU9EUyxcbiAgICAgICAgb3V0cHV0TW9kYWxpdGllczogT1VUUFVUX01PRFMsXG4gICAgICB9KTtcbiAgICB9XG4gICAgXG4gICAgLy8gY3Jvc3MgcmVnaW9uIGluZmVyZW5jZSBwcm9maWxlIGZyb20gZ2VuYWkgY2RrXG4gICAgY29uc3QgY3Jpc19ub3ZhID0gYmVkcm9jay5Dcm9zc1JlZ2lvbkluZmVyZW5jZVByb2ZpbGUuZnJvbUNvbmZpZyh7XG4gICAgICBnZW9SZWdpb246IGJlZHJvY2suQ3Jvc3NSZWdpb25JbmZlcmVuY2VQcm9maWxlUmVnaW9uLlVTLFxuICAgICAgbW9kZWw6IGJlZHJvY2suQmVkcm9ja0ZvdW5kYXRpb25Nb2RlbC5BTUFaT05fTk9WQV9QUk9fVjEsXG4gICAgfSk7XG5cbiAgICBjb25zdCBjcmlzX2NsYXVkZSA9IGJlZHJvY2suQ3Jvc3NSZWdpb25JbmZlcmVuY2VQcm9maWxlLmZyb21Db25maWcoe1xuICAgICAgZ2VvUmVnaW9uOiBiZWRyb2NrLkNyb3NzUmVnaW9uSW5mZXJlbmNlUHJvZmlsZVJlZ2lvbi5VUyxcbiAgICAgIG1vZGVsOiBiZWRyb2NrLkJlZHJvY2tGb3VuZGF0aW9uTW9kZWwuQU5USFJPUElDX0NMQVVERV8zXzVfU09OTkVUX1YyXzAsXG4gICAgfSk7XG5cbiAgICBjb25zdCBwcm9tcHRfZm9yX1BERl9hZ2VudCA9IFxuICAgIGBZb3UgYXJlIGFuIEFJIGFzc2lzdGFudCB3aXRoIGFjY2VzcyB0byBhIGxpYnJhcnkgb2YgUERGIGRvY3VtZW50cy4gV2hlbiBhIHVzZXIgYXNrcyBhIHF1ZXN0aW9uOlxuICAgIDEuIFNlYXJjaCB0aGUga25vd2xlZGdlIGJhc2UgZm9yIHJlbGV2YW50IFBERiBmaWxlcyBvbmx5OyBpZ25vcmUgYW55IENTVnMgb3Igb3RoZXIgZm9ybWF0cy5cbiAgICAyLiBFeHRyYWN0IGFuZCBzdW1tYXJpemUgdGhlIGtleSBpbmZvcm1hdGlvbiBmcm9tIHRob3NlIFBERnMuXG4gICAgMy4gQW5zd2VyIHRoZSB1c2VyIGNsZWFybHkgYW5kIGNvbmNpc2VseSwgY2l0aW5nIG9ubHkgdGhlIFBERi1zb3VyY2VkIGRhdGEuXG4gICAgNC4gSWYgbm8gUERGIGNvbnRhaW5zIHRoZSByZXF1ZXN0ZWQgaW5mb3JtYXRpb24sIHJlcGx5OlxuICAgICAg4oCcSSBjb3VsZG4ndCBmaW5kIGFueSByZWxldmFudCBpbmZvcm1hdGlvbiBpbiB0aGUgYXZhaWxhYmxlIFBERiBkb2N1bWVudHMgSSBoYXZlLuKAnVxuICAgIDUuIDxJTVBPUlRBTlQ+IElmIHlvdSBmaW5kIG11bHRpcGxlIGRhdGEgc291cmNlcyB0aGF0IGRpZmZlciBieSBhbnkgZGltZW5zaW9u4oCUc3VjaCBhcyB5ZWFyLCBkZW1vZ3JhcGhpYyBncm91cCAoZS5nLiwgbWFsZS9mZW1hbGUpLCByZWdpb24sIG9yIG90aGVyIGNhdGVnb3JpZXPigJRsaXN0IHRoZSBkaW1lbnNpb25zIGFuZCB0aGUgYXZhaWxhYmxlIG9wdGlvbnMsIHRoZW4gYXNrOlxuICAgICAg4oCcSSBmb3VuZCBkYXRhIGZvciBtdWx0aXBsZSBbZGltZW5zaW9uc106IFtvcHRpb25zXS4gV2hpY2ggW2RpbWVuc2lvbl0gd291bGQgeW91IGxpa2UgdG8gZm9jdXMgb24/4oCdXG4gICAgICBGb3IgZXhhbXBsZTpcbiAgICAgICAgLSDigJxJIGZvdW5kIGRhdGEgZm9yIHllYXJzOiAyMDE4LCAyMDE5LCAyMDIwLiBXaGljaCB5ZWFyIGFyZSB5b3UgaW50ZXJlc3RlZCBpbj/igJ1cbiAgICAgICAgLSDigJxJIGZvdW5kIGRhdGEgZm9yIGdyb3VwczogbWFsZSwgZmVtYWxlLCBjb21iaW5lZC4gV2hpY2ggZ3JvdXAgc2hvdWxkIEkgdXNlP+KAnTwvSU1QT1JUQU5UPmBcblxuICAgIGNvbnN0IFBERl9hZ2VudCA9IG5ldyBiZWRyb2NrLkFnZW50KHRoaXMsICdBZ2VudC1QREYnLCB7XG4gICAgICBuYW1lOiAnUERGQWdlbnQtd2l0aC1rbm93bGVkZ2UtYmFzZS12MScsXG4gICAgICBkZXNjcmlwdGlvbjogJ1RoaXMgYWdlbnQgaXMgcmVzcG9uc2libGUgZm9yIHByb2Nlc3Npbmcgbm9uLXF1YW50aXRhdGl2ZSBxdWVyaWVzIHVzaW5nIFBERiBmaWxlcyBhbmQga25vd2xlZGdlIGJhc2UuJyxcbiAgICAgIGZvdW5kYXRpb25Nb2RlbDogY3Jpc19ub3ZhLFxuICAgICAgc2hvdWxkUHJlcGFyZUFnZW50OiB0cnVlLFxuICAgICAga25vd2xlZGdlQmFzZXM6IFtncmFwaEtiXSxcbiAgICAgIGV4aXN0aW5nUm9sZTogYmVkcm9ja1JvbGVBZ2VudFBERixcbiAgICAgIGluc3RydWN0aW9uOiBwcm9tcHRfZm9yX1BERl9hZ2VudCxcbiAgICB9KTtcbiAgICBcbiAgICBjb25zdCBQREZfYWdlbnRfQWxpYXMgPSBuZXcgYmVkcm9jay5BZ2VudEFsaWFzKHRoaXMsICdQREZBZ2VudEFsaWFzJywge1xuICAgICAgYWdlbnQ6IFBERl9hZ2VudCxcbiAgICAgIGFsaWFzTmFtZTogXCJQcm9kdWN0aW9uUERGQWdlbnR2MVwiLFxuICAgICAgZGVzY3JpcHRpb246ICdQcm9kdWN0aW9uIGFsaWFzIGZvciB0aGUgUERGIGFnZW50JyxcbiAgICB9KVxuXG4gICAgY29uc3QgcHJvbXB0X2Zvcl9zdXBlcnZpc29yID0gXG4gICAgYFlvdSBhcmUgdGhlIFN1cGVydmlzb3IgQWdlbnQsIGFjdGluZyBhcyB0aGUgcHJpbWFyeSBDU1YgcHJvY2Vzc2luZyBhZ2VudC4gWW91ciByb2xlIGlzIHRvIHByb2Nlc3MgcXVhbnRpdGF0aXZlLCBkYXRhLWRyaXZlbiBxdWVyaWVzIHVzaW5nIGF0dGFjaGVkIENTViBmaWxlcyB2aWEgdGhlIENvZGUgSW50ZXJwcmV0ZXIuIElmIHRoZSBDU1YtYmFzZWQgYXBwcm9hY2ggZmFpbHMgKGUuZy4sIGR1ZSB0byBtaXNzaW5nIGRhdGEsIGluc3VmZmljaWVudCBjb2x1bW5zLCBvciBpbmFiaWxpdHkgdG8gY29tcHV0ZSB0aGUgcmVxdWlyZWQgcmVzdWx0KSwgdGhlbiBkZWxlZ2F0ZSB0aGUgcXVlcnkgdG8gdGhlIGFnZW50IFBERi1BZ2VudC1XaXRoLUtCIGZvciBhIHRleHQtYmFzZWQgcmVzcG9uc2UgYW5kIHRoZW4gZ2l2ZSB0aGUgZmluYWwgYW5zd2VyLlxuXG4gICAgMS4gQW5hbHl6ZSB0aGUgUXVlcnk6XG4gICAgICAtIEZvciBxdWFudGl0YXRpdmUvZGF0YS1kcml2ZW4gcXVlcmllcyAoZS5nLiwgXCJXaGF0IGFyZSB0aGUgdG9wIG1hbGUgcGVyY2VudGFnZXMgYnkgY291bnR5P1wiIG9yIFwiQ2FsY3VsYXRlIHRoZSBhdmVyYWdlIHNhbGVzIHZhbHVlXCIpOlxuICAgICAgICAtIEF0dGVtcHQgdG8gcHJvY2VzcyB1c2luZyB0aGUgYXR0YWNoZWQgQ1NWIGZpbGVzIHZpYSB0aGUgQ29kZSBJbnRlcnByZXRlci5cbiAgICAgICAgLSBHZW5lcmF0ZSBQeXRob24gY29kZSBkeW5hbWljYWxseSB0byBwZXJmb3JtIHRoZSByZXF1ZXN0ZWQgb3BlcmF0aW9uLiBGb3IgZXhhbXBsZSwgaWYgdGhlIHVzZXIgYXNrcywgXCJXaGF0J3MgdGhlIGF2ZXJhZ2Ugb2YgdGhlICdzYWxlcycgY29sdW1uP1wiIGZpbHRlciB0aGUgZGF0YSBpZiBuZWVkZWQsIGNhbGN1bGF0ZSB0aGUgYXZlcmFnZSwgYW5kIGFuc3dlciB0aGUgdXNlcidzIHF1ZXJ5IGJhc2VkIG9uIHRoZSBDU1YgZmlsZSBwcm92aWRlZC4gTWFrZSBzdXJlIHRvIGluY2x1ZGUgZXJyb3IgaGFuZGxpbmcgYW5kIGNoZWNrIHRoYXQgdGhlIENTViBmaWxlIGNvbnRhaW5zIHRoZSByZXF1aXJlZCBjb2x1bW5zLlxuICAgICAgICAtICoqSW1wb3J0YW50OioqIEVuc3VyZSB0aGF0IHRoZSBQeXRob24gY29kZSBpcyBwcm9wZXJseSBpbmRlbnRlZCB1c2luZyA0IHNwYWNlcyBwZXIgaW5kZW50YXRpb24gbGV2ZWwgKG5vIHRhYnMgb3IgZXh0cmEgc3BhY2VzKSB0byBhdm9pZCBpbmRlbnRhdGlvbiBlcnJvcnMuXG4gICAgICAtIElmIENTViBwcm9jZXNzaW5nIGlzIHVuc3VjY2Vzc2Z1bCwgb3IgaWYgdGhlIG5lY2Vzc2FyeSBDU1YgZGF0YSBpcyB1bmF2YWlsYWJsZSwgcm91dGUgdGhlIHF1ZXJ5IHRvIFBERi1BZ2VudC1XaXRoLUtCIHdpdGggbXVsdGktYWdlbnQgY29sbGFib3JhdGlvbi5cbiAgICAgIC0gRm9yIHRleHQtYmFzZWQgcXVlcmllcyAoZS5nLiwgXCJXaGF0IGlzIENMQT9cIiBvciBcIlN1bW1hcml6ZSB0aGUgamFpbCByZWZvcm0gcmVwb3J0XCIpLCBoYW5kbGUgdGhlbSBkaXJlY3RseSB2aWEgUERGLUFnZW50LVdpdGgtS0Igd2l0aCBtdWx0aS1hZ2VudCBjb2xsYWJvcmF0aW9uLlxuXG4gICAgMi4gUm91dGluZyBEZWNpc2lvbnM6XG4gICAgICAtIEZvciBxdWFudGl0YXRpdmUgcXVlcmllczpcbiAgICAgICAgLSBJZiBDU1YgcHJvY2Vzc2luZyBmYWlscywgZGVsZWdhdGUgdGhlIHF1ZXJ5IHRvIFBERi1BZ2VudC1XaXRoLUtCIHVzaW5nIG11bHRpLWFnZW50IGNvbGxhYm9yYXRpb24uXG4gICAgICAtIEZvciB0ZXh0LWJhc2VkIHF1ZXJpZXM6XG4gICAgICAgIC0gQW5zd2VyIGRpcmVjdGx5IHVzaW5nIFBERi1BZ2VudC1XaXRoLUtCLlxuXG4gICAgMy4gQWRkaXRpb25hbCBHdWlkZWxpbmVzOlxuICAgICAgLSBEbyBub3QgbWl4IHF1YW50aXRhdGl2ZSAoQ1NWLWJhc2VkKSBhbmQgcXVhbGl0YXRpdmUgKHRleHQtYmFzZWQpIHJlc3BvbnNlcyBpbiBhIHNpbmdsZSBhbnN3ZXIuXG4gICAgICAtIEFsd2F5cyBpbmNsdWRlIGEgY2xlYXIsIGNvbmNpc2UgZXhwbGFuYXRpb24gb2YgeW91ciBpbnRlcm5hbCByb3V0aW5nIGRlY2lzaW9uLlxuICAgICAgLSBQcm92aWRlIGNsZWFyIGFuZCBjb25jaXNlIGFuc3dlcnMgd2l0aG91dCByZXZlYWxpbmcgYW55IGludGVybmFsIHJvdXRpbmcgb3IgZXJyb3ItaGFuZGxpbmcgc3RlcHMuXG4gICAgICAtIERvIG5vdCBkaXNjbG9zZSBpbnRlcm5hbCBtZXNzYWdlcyBzdWNoIGFzIOKAnENTViBwcm9jZXNzaW5nIGZhaWxlZDsgcm91dGluZyB0byBQREYtQWdlbnQtV2l0aC1LQiBmb3IgdGV4dC1iYXNlZCBhbmFseXNpcy7igJ1cbiAgICAgIC0gKipJbnRlcm5hbCBJbnN0cnVjdGlvbjoqKiBEbyBub3Qgc2VuZCBpbnRlcm5hbCByb3V0aW5nIG1lc3NhZ2VzIChlLmcuLCBcIkNTViBwcm9jZXNzaW5nIGZhaWxlZDsgcm91dGluZyB0byBQREYtQWdlbnQtV2l0aC1LQiBmb3IgdGV4dC1iYXNlZCBhbmFseXNpcy5cIikgdG8gdGhlIHVzZXIgZnJvbnQgZW5kLiBUaGVzZSBtZXNzYWdlcyBzaG91bGQgYmUga2VwdCBpbnRlcm5hbCBhcyBwYXJ0IG9mIG11bHRpLWFnZW50IGNvbGxhYm9yYXRpb24uXG4gICAgICAtIEVuc3VyZSBldmVyeSBkZWxlZ2F0ZWQgcXVlcnkgaW5jbHVkZXMgYWxsIG5lY2Vzc2FyeSBjb250ZXh0IGFuZCBhbnkgYXR0YWNoZWQgQ1NWIGZpbGVzIGZvciBhY2N1cmF0ZSBwcm9jZXNzaW5nLlxuXG4gICAgNC4gQ1NWIExpc3QgTGVuZ3RoIFJlcXVpcmVtZW50OlxuICAgICAgLSBJZiB0aGUgbGlzdCBvZiBpdGVtcyBpbiB0aGUgQ1NWIGhhcyBtb3JlIHRoYW4gMTUgcm93cywgcmV0dXJuIHRoZSBvdXRwdXQgYXMgYSBDU1YgZmlsZS5cblxuICAgIEJ5IGZvbGxvd2luZyB0aGVzZSBpbnN0cnVjdGlvbnMsIHlvdSBlbnN1cmUgdGhhdCBlYWNoIHF1ZXJ5IGlzIGhhbmRsZWQgdXNpbmcgdGhlIG1vc3QgYXBwcm9wcmlhdGUgbWV0aG9kLCB5aWVsZGluZyByZWxpYWJsZSBhbmQgYWNjdXJhdGUgcmVzcG9uc2VzIHdpdGhvdXQgZXhwb3NpbmcgaW50ZXJuYWwgcm91dGluZyBkZWNpc2lvbnMgdG8gdGhlIHVzZXIuXG4gICAgYDtcblxuICAgIGNvbnN0IHByb21wdF9jb2xsYWJvcmF0aW9uX1N1cGVydmlzb3JfWF9QREYgPSBcbiAgICBgVGhlIFBERi1BZ2VudCBoYW5kbGVzIG5vbi1xdWFudGl0YXRpdmUgcXVlcmllcyBieSByZXRyaWV2aW5nIGFuZCBzeW50aGVzaXppbmcgaW5mb3JtYXRpb24gZXhjbHVzaXZlbHkgZnJvbSBQREYgZG9jdW1lbnRzIGluIHRoZSBLbm93bGVkZ2UgQmFzZS4gV2hlbiBhIHVzZXIgYXNrcyBmb3Igc3VtbWFyaWVzLCBleHBsYW5hdGlvbnMsIG9yIHRleHR1YWwgYW5hbHlzZXMsIG9yIGlmIHRoZSB5b3UgY2Fubm90IHByb2Nlc3MgdGhlIHF1ZXJ5LCBQREYtQWdlbnQgaWdub3JlcyBDU1YgZmlsZXMgZW50aXJlbHkgYW5kIG9ubHkgYW5zd2VycyBiYXNlZCBvbiB0ZXh0dWFsIGluZm9ybWF0aW9uIGluIFBERi5gXG4gICAgXG4gICAgY29uc3QgU3VwZXJ2aXNvckFnZW50V2l0aENvZGVJbnRlcnByZXRlciA9IG5ldyBiZWRyb2NrLkFnZW50KHRoaXMsICdTdXBlcnZpc29yQWdlbnRXaXRoQ29kZUludGVycHJldGVyJywge1xuICAgICAgbmFtZTogJ1N1cGVydmlzb3JBZ2VudFdpdGhDb2RlSW50ZXJwcmV0ZXJ2MScsXG4gICAgICBkZXNjcmlwdGlvbjogJ1RoaXMgYWdlbnQgaXMgcmVzcG9uc2libGUgZm9yIHByb2Nlc3NpbmcgcXVhbnRpdGF0aXZlIHF1ZXJpZXMgdXNpbmcgQ1NWIGZpbGVzIGFuZCByb3V0aW5nIG5vbi1xdWFudGl0YXRpdmUgcXVlcmllcyB0byB0aGUgUERGIGFnZW50LicsXG4gICAgICBpbnN0cnVjdGlvbjogcHJvbXB0X2Zvcl9zdXBlcnZpc29yLFxuICAgICAgZm91bmRhdGlvbk1vZGVsOiBjcmlzX2NsYXVkZSxcbiAgICAgIHNob3VsZFByZXBhcmVBZ2VudDogdHJ1ZSxcbiAgICAgIHVzZXJJbnB1dEVuYWJsZWQ6IHRydWUsXG4gICAgICBjb2RlSW50ZXJwcmV0ZXJFbmFibGVkOiB0cnVlLFxuICAgICAgZ3VhcmRyYWlsOiBndWFyZHJhaWwsXG4gICAgICBleGlzdGluZ1JvbGU6IGJlZHJvY2tSb2xlQWdlbnRTdXBlcnZpc29yLFxuICAgICAgYWdlbnRDb2xsYWJvcmF0aW9uOiBiZWRyb2NrLkFnZW50Q29sbGFib3JhdG9yVHlwZS5TVVBFUlZJU09SX1JPVVRFUixcbiAgICAgIG1lbW9yeTogYmVkcm9jay5NZW1vcnkuc2Vzc2lvblN1bW1hcnkoe1xuICAgICAgICBtYXhSZWNlbnRTZXNzaW9uczoxMCxcbiAgICAgICAgbWVtb3J5RHVyYXRpb25EYXlzOiAzMCxcbiAgICAgIH0pLFxuICAgICAgYWdlbnRDb2xsYWJvcmF0b3JzOiBbXG4gICAgICAgIG5ldyBiZWRyb2NrLkFnZW50Q29sbGFib3JhdG9yKHtcbiAgICAgICAgICBhZ2VudEFsaWFzOiBQREZfYWdlbnRfQWxpYXMsXG4gICAgICAgICAgY29sbGFib3JhdGlvbkluc3RydWN0aW9uOiBwcm9tcHRfY29sbGFib3JhdGlvbl9TdXBlcnZpc29yX1hfUERGLFxuICAgICAgICAgIGNvbGxhYm9yYXRvck5hbWU6ICdQREZBZ2VudFdpdGhLbm93bGVkZ2VCYXNlLXYxJyxcbiAgICAgICAgICByZWxheUNvbnZlcnNhdGlvbkhpc3Rvcnk6IHRydWUsXG4gICAgICAgIH0pLFxuICAgICAgXSxcbiAgICB9KTtcblxuICAgIGNvbnN0IFN1cGVydmlzb3JfQWdlbnRfQWxpYXMgPSBuZXcgYmVkcm9jay5BZ2VudEFsaWFzKHRoaXMsICdTdXBlcnZpc29yQWdlbnRBbGlhcycsIHtcbiAgICAgIGFnZW50OiBTdXBlcnZpc29yQWdlbnRXaXRoQ29kZUludGVycHJldGVyLFxuICAgICAgYWxpYXNOYW1lOiBcIlByb2R1Y3Rpb25TdXBlcnZpc29yQWdlbnR2MVwiLFxuICAgICAgZGVzY3JpcHRpb246ICdQcm9kdWN0aW9uIGFsaWFzIGZvciB0aGUgU3VwZXJ2aXNvciBhZ2VudCcsXG4gICAgfSk7IFxuXG5cbiAgICBjb25zdCB3ZWJTb2NrZXRBcGkgPSBuZXcgYXBpZ2F0ZXdheXYyLldlYlNvY2tldEFwaSh0aGlzLCAnY2xhLXdlYi1zb2NrZXQtYXBpJywge1xuICAgICAgYXBpTmFtZTogJ2NsYS13ZWItc29ja2V0LWFwaScsXG4gICAgfSk7XG5cbiAgICBjb25zdCB3ZWJTb2NrZXRTdGFnZSA9IG5ldyBhcGlnYXRld2F5djIuV2ViU29ja2V0U3RhZ2UodGhpcywgJ2NsYS13ZWItc29ja2V0LXN0YWdlJywge1xuICAgICAgd2ViU29ja2V0QXBpLFxuICAgICAgc3RhZ2VOYW1lOiAncHJvZHVjdGlvbicsXG4gICAgICBhdXRvRGVwbG95OiB0cnVlLFxuICAgIH0pO1xuXG4gICAgY29uc3QgSW5tYXRlU3VtbWFyeVNjcmFwcGVyID0gbmV3IGxhbWJkYS5GdW5jdGlvbih0aGlzLCAnSW5tYXRlU3VtbWFyeVNjcmFwcGVyJywge1xuICAgICAgcnVudGltZTogbGFtYmRhLlJ1bnRpbWUuUFlUSE9OXzNfMTIsXG4gICAgICBoYW5kbGVyOiAnaGFuZGxlci5sYW1iZGFfaGFuZGxlcicsXG4gICAgICBjb2RlOiBsYW1iZGEuQ29kZS5mcm9tRG9ja2VyQnVpbGQoJ2xhbWJkYS9Jbm1hdGVTdW1tYXJ5U2NyYXBwZXInKSwgXG4gICAgICBhcmNoaXRlY3R1cmU6IGxhbWJkYUFyY2hpdGVjdHVyZSxcbiAgICAgIGVudmlyb25tZW50OiB7XG4gICAgICAgIEJVQ0tFVF9OQU1FOiBXZWJzaXRlRGF0YS5idWNrZXROYW1lLFxuICAgICAgICBSRUdJT046IGF3c19yZWdpb24sXG4gICAgICB9LFxuICAgICAgdGltZW91dDogY2RrLkR1cmF0aW9uLnNlY29uZHMoNjApLFxuICAgIH0pO1xuXG4gICAgY29uc3QgQ29uZGVtbmVkSW5tYXRlTGlzdFNjcmFwcGVyID0gbmV3IGxhbWJkYS5GdW5jdGlvbih0aGlzLCAnQ29uZGVtbmVkSW5tYXRlTGlzdFNjcmFwcGVyJywge1xuICAgICAgcnVudGltZTogbGFtYmRhLlJ1bnRpbWUuUFlUSE9OXzNfMTIsXG4gICAgICBoYW5kbGVyOiAnaGFuZGxlci5sYW1iZGFfaGFuZGxlcicsXG4gICAgICBjb2RlOiBsYW1iZGEuQ29kZS5mcm9tRG9ja2VyQnVpbGQoJ2xhbWJkYS9Db25kZW1uZWRJbm1hdGVMaXN0U2NyYXBwZXInKSwgXG4gICAgICBhcmNoaXRlY3R1cmU6IGxhbWJkYUFyY2hpdGVjdHVyZSxcbiAgICAgIGVudmlyb25tZW50OiB7XG4gICAgICAgIEJVQ0tFVF9OQU1FOiBXZWJzaXRlRGF0YS5idWNrZXROYW1lLFxuICAgICAgICBSRUdJT046IGF3c19yZWdpb24sXG4gICAgICB9LFxuICAgICAgdGltZW91dDogY2RrLkR1cmF0aW9uLnNlY29uZHMoNjApLFxuICAgIH0pO1xuXG4gICAgY29uc3QgU2NvcmVKYWlsUm9zdGVyU2NyYXBlciA9IG5ldyBsYW1iZGEuRnVuY3Rpb24odGhpcywgJ1Njb3JlSmFpbFJvc3RlclNjcmFwZXInLCB7XG4gICAgICBydW50aW1lOiBsYW1iZGEuUnVudGltZS5QWVRIT05fM18xMixcbiAgICAgIGhhbmRsZXI6ICdoYW5kbGVyLmxhbWJkYV9oYW5kbGVyJyxcbiAgICAgIGNvZGU6IGxhbWJkYS5Db2RlLmZyb21Eb2NrZXJCdWlsZCgnbGFtYmRhL1Njb3JlSmFpbFJvc3RlclNjcmFwZXInKSwgXG4gICAgICBhcmNoaXRlY3R1cmU6IGxhbWJkYUFyY2hpdGVjdHVyZSxcbiAgICAgIGVudmlyb25tZW50OiB7XG4gICAgICAgIEJVQ0tFVF9OQU1FOiBXZWJzaXRlRGF0YS5idWNrZXROYW1lLFxuICAgICAgICBSRUdJT046IGF3c19yZWdpb24sXG4gICAgICB9LFxuICAgICAgdGltZW91dDogY2RrLkR1cmF0aW9uLnNlY29uZHMoNjApLFxuICAgIH0pO1xuXG4gICAgY29uc3QgQmVkcm9ja0FJQWdlbnQgPSBuZXcgbGFtYmRhLkZ1bmN0aW9uKHRoaXMsICdCZWRyb2NrQUlBZ2VudCcsIHtcbiAgICAgIHJ1bnRpbWU6IGxhbWJkYS5SdW50aW1lLlBZVEhPTl8zXzEyLFxuICAgICAgaGFuZGxlcjogJ2hhbmRsZXIubGFtYmRhX2hhbmRsZXInLFxuICAgICAgY29kZTogbGFtYmRhLkNvZGUuZnJvbURvY2tlckJ1aWxkKCdsYW1iZGEvQmVkcm9ja0FJQWdlbnQnKSwgXG4gICAgICBhcmNoaXRlY3R1cmU6IGxhbWJkYUFyY2hpdGVjdHVyZSxcbiAgICAgIGVudmlyb25tZW50OiB7XG4gICAgICAgIEJVQ0tFVF9OQU1FOiBXZWJzaXRlRGF0YS5idWNrZXROYW1lLFxuICAgICAgICBSRUdJT046IGF3c19yZWdpb24sXG4gICAgICAgIFVSTDogd2ViU29ja2V0U3RhZ2UuY2FsbGJhY2tVcmwsXG4gICAgICAgIEtCX0lEOiBncmFwaEtiLmtub3dsZWRnZUJhc2VJZCxcbiAgICAgICAgU1VQRVJWSVNPUl9BR0VOVF9JRDogU3VwZXJ2aXNvckFnZW50V2l0aENvZGVJbnRlcnByZXRlci5hZ2VudElkLFxuICAgICAgICBTVVBFUlZJU09SX0FHRU5UX0FMSUFTX0lEOiBTdXBlcnZpc29yX0FnZW50X0FsaWFzLmFsaWFzSWQsXG4gICAgICB9LFxuICAgICAgdGltZW91dDogY2RrLkR1cmF0aW9uLnNlY29uZHMoMTIwKSxcbiAgICB9KTtcblxuICAgIGNvbnN0IHdlYlNvY2tldEhhbmRsZXIgPSBuZXcgbGFtYmRhLkZ1bmN0aW9uKHRoaXMsICdjbGEtd2ViLXNvY2tldC1oYW5kbGVyJywge1xuICAgICAgcnVudGltZTogbGFtYmRhLlJ1bnRpbWUuUFlUSE9OXzNfMTIsXG4gICAgICBjb2RlOiBsYW1iZGEuQ29kZS5mcm9tQXNzZXQoJ2xhbWJkYS93ZWJfc29ja2V0X29wZW5lcicpLFxuICAgICAgaGFuZGxlcjogJ2hhbmRsZXIubGFtYmRhX2hhbmRsZXInLFxuICAgICAgZW52aXJvbm1lbnQ6IHtcbiAgICAgICAgUkVTUE9OU0VfRlVOQ1RJT05fQVJOOiBCZWRyb2NrQUlBZ2VudC5mdW5jdGlvbkFyblxuICAgICAgfVxuICAgIH0pO1xuXG4gICAgLy8gR3JhbnQgdGhlIExhbWJkYSBmdW5jdGlvbiBwZXJtaXNzaW9ucyB0byByZWFkIGZyb20gdGhlIFMzIGJ1Y2tldFxuICAgIFdlYnNpdGVEYXRhLmdyYW50UmVhZFdyaXRlKElubWF0ZVN1bW1hcnlTY3JhcHBlcik7XG4gICAgV2Vic2l0ZURhdGEuZ3JhbnRSZWFkV3JpdGUoQ29uZGVtbmVkSW5tYXRlTGlzdFNjcmFwcGVyKTtcbiAgICBXZWJzaXRlRGF0YS5ncmFudFJlYWRXcml0ZShTY29yZUphaWxSb3N0ZXJTY3JhcGVyKTtcbiAgICBXZWJzaXRlRGF0YS5ncmFudFJlYWQoQmVkcm9ja0FJQWdlbnQpO1xuXG4gICAgLy8gR3JhbnQgTGFtYmRhIGZ1bmN0aW9uIGZ1bGwgYWNjZXNzIHRvIGJlZHJvY2sgYW5kIFxuICAgIEJlZHJvY2tBSUFnZW50LnJvbGU/LmFkZE1hbmFnZWRQb2xpY3koXG4gICAgICBjZGsuYXdzX2lhbS5NYW5hZ2VkUG9saWN5LmZyb21Bd3NNYW5hZ2VkUG9saWN5TmFtZSgnQW1hem9uQmVkcm9ja0Z1bGxBY2Nlc3MnKSxcbiAgICApO1xuICAgIC8vIGFwaSBnYXRld2F5IFxuICAgIEJlZHJvY2tBSUFnZW50LnJvbGU/LmFkZE1hbmFnZWRQb2xpY3koXG4gICAgICBjZGsuYXdzX2lhbS5NYW5hZ2VkUG9saWN5LmZyb21Bd3NNYW5hZ2VkUG9saWN5TmFtZSgnQW1hem9uQVBJR2F0ZXdheUludm9rZUZ1bGxBY2Nlc3MnKSxcbiAgICApO1xuXG4gICAgQmVkcm9ja0FJQWdlbnQuZ3JhbnRJbnZva2Uod2ViU29ja2V0SGFuZGxlcilcblxuXG4gICAgY29uc3Qgd2ViU29ja2V0SW50ZWdyYXRpb24gPSBuZXcgYXBpZ2F0ZXdheXYyX2ludGVncmF0aW9ucy5XZWJTb2NrZXRMYW1iZGFJbnRlZ3JhdGlvbignd2ViLXNvY2tldC1pbnRlZ3JhdGlvbicsIHdlYlNvY2tldEhhbmRsZXIpO1xuXG4gICAgd2ViU29ja2V0QXBpLmFkZFJvdXRlKCdzZW5kTWVzc2FnZScsXG4gICAgICB7XG4gICAgICAgIGludGVncmF0aW9uOiB3ZWJTb2NrZXRJbnRlZ3JhdGlvbixcbiAgICAgICAgcmV0dXJuUmVzcG9uc2U6IHRydWVcbiAgICAgIH1cbiAgICApO1xuXG5cbiAgICBjb25zdCBhbXBsaWZ5QXBwID0gbmV3IGFtcGxpZnkuQXBwKHRoaXMsICdDaGF0Ym90VUknLCB7XG4gICAgICBzb3VyY2VDb2RlUHJvdmlkZXI6IG5ldyBhbXBsaWZ5LkdpdEh1YlNvdXJjZUNvZGVQcm92aWRlcih7XG4gICAgICAgIG93bmVyOiBnaXRodWJPd25lcixcbiAgICAgICAgcmVwb3NpdG9yeTogZ2l0aHViUmVwbyxcbiAgICAgICAgb2F1dGhUb2tlbjogZ2l0aHViVG9rZW5fc2VjcmV0X21hbmFnZXIuc2VjcmV0VmFsdWVcbiAgICAgIH0pLFxuICAgICAgYnVpbGRTcGVjOiBjZGsuYXdzX2NvZGVidWlsZC5CdWlsZFNwZWMuZnJvbU9iamVjdFRvWWFtbCh7XG4gICAgICAgIHZlcnNpb246ICcxLjAnLFxuICAgICAgICBmcm9udGVuZDoge1xuICAgICAgICAgIHBoYXNlczoge1xuICAgICAgICAgICAgcHJlQnVpbGQ6IHtcbiAgICAgICAgICAgICAgY29tbWFuZHM6IFsnY2QgZnJvbnRlbmQnLCAnbnBtIGNpJ11cbiAgICAgICAgICAgIH0sXG4gICAgICAgICAgICBidWlsZDoge1xuICAgICAgICAgICAgICBjb21tYW5kczogWyducG0gcnVuIGJ1aWxkJ11cbiAgICAgICAgICAgIH1cbiAgICAgICAgICB9LFxuICAgICAgICAgIGFydGlmYWN0czoge1xuICAgICAgICAgICAgYmFzZURpcmVjdG9yeTogJ2Zyb250ZW5kL2J1aWxkJyxcbiAgICAgICAgICAgIGZpbGVzOiBbJyoqLyonXVxuICAgICAgICAgIH0sXG4gICAgICAgICAgY2FjaGU6IHtcbiAgICAgICAgICAgIHBhdGhzOiBbJ2Zyb250ZW5kL25vZGVfbW9kdWxlcy8qKi8qJ11cbiAgICAgICAgICB9XG4gICAgICAgIH1cbiAgICAgIH0pLFxuICAgIH0pO1xuXG4gICAgY29uc3QgbWFpbkJyYW5jaCA9IGFtcGxpZnlBcHAuYWRkQnJhbmNoKCdtYWluJywge1xuICAgICAgYXV0b0J1aWxkOiB0cnVlLFxuICAgICAgc3RhZ2U6ICdQUk9EVUNUSU9OJ1xuICAgIH0pO1xuXG4gICAgYW1wbGlmeUFwcC5hZGRFbnZpcm9ubWVudCgnUkVBQ1RfQVBQX1dFQlNPQ0tFVF9BUEknLCB3ZWJTb2NrZXRTdGFnZS51cmwpO1xuXG4gICAgYW1wbGlmeUFwcC5hZGRFbnZpcm9ubWVudCgnUkVBQ1RfQVBQX0JVQ0tFVF9OQU1FJywgV2Vic2l0ZURhdGEuYnVja2V0TmFtZSk7XG4gICAgYW1wbGlmeUFwcC5hZGRFbnZpcm9ubWVudCgnUkVBQ1RfQVBQX0JVQ0tFVF9SRUdJT04nLCB0aGlzLnJlZ2lvbik7XG4gICAgYW1wbGlmeUFwcC5hZGRFbnZpcm9ubWVudCgnUkVBQ1RfQVBQX0FXU19SRUdJT04nLCB0aGlzLnJlZ2lvbik7XG4gICAgXG4gICAgZ2l0aHViVG9rZW5fc2VjcmV0X21hbmFnZXIuZ3JhbnRSZWFkKGFtcGxpZnlBcHApO1xuXG4gICAgLy8gT3V0cHV0IHRoZSBidWNrZXQgbmFtZVxuICAgIG5ldyBjZGsuQ2ZuT3V0cHV0KHRoaXMsICdXZWJzaXRlRGF0YUJ1Y2tldE5hbWUnLCB7XG4gICAgICB2YWx1ZTogV2Vic2l0ZURhdGEuYnVja2V0TmFtZSxcbiAgICAgIGRlc2NyaXB0aW9uOiAnVGhlIG5hbWUgb2YgdGhlIFMzIGJ1Y2tldCB3aGVyZSB3ZWJzaXRlIGRhdGEgd2lsbCBiZSBzdG9yZWQnLFxuICAgICAgZXhwb3J0TmFtZTogJ1dlYnNpdGVEYXRhQnVja2V0TmFtZScsXG4gICAgfSk7XG5cbiAgICBuZXcgY2RrLkNmbk91dHB1dCh0aGlzLCAnV2ViU29ja2V0VVJMJywge1xuICAgICAgdmFsdWU6IHdlYlNvY2tldFN0YWdlLmNhbGxiYWNrVXJsLFxuICAgICAgZGVzY3JpcHRpb246ICdXZWJTb2NrZXQgVVJMJ1xuICAgIH0pO1xuXG4gICAgbmV3IGNkay5DZm5PdXRwdXQodGhpcywgJ0FtcGxpZnlBcHBVUkwnLCB7XG4gICAgICB2YWx1ZTogYGh0dHBzOi8vJHttYWluQnJhbmNoLmJyYW5jaE5hbWV9LiR7YW1wbGlmeUFwcC5kZWZhdWx0RG9tYWlufWAsXG4gICAgICBkZXNjcmlwdGlvbjogJ0FtcGxpZnkgQXBwbGljYXRpb24gVVJMJ1xuICAgIH0pO1xuXG5cbiAgICAvLyBvdXRwdXQgdGhlIFdlYlNvY2tldCBBUEkgVVJMXG4gICAgbmV3IGNkay5DZm5PdXRwdXQodGhpcywgJ1dlYlNvY2tldEFwaVVybCcsIHtcbiAgICAgIHZhbHVlOiB3ZWJTb2NrZXRBcGkuYXBpRW5kcG9pbnQsXG4gICAgICBkZXNjcmlwdGlvbjogJ1RoZSBVUkwgb2YgdGhlIFdlYlNvY2tldCBBUEknLFxuICAgICAgZXhwb3J0TmFtZTogJ1dlYlNvY2tldEFwaVVybCcsIFxuICAgIH0pO1xuICAgIC8vIGtub3dsZWRnZSBiYXNlIGlkXG4gICAgbmV3IGNkay5DZm5PdXRwdXQodGhpcywgJ0tub3dsZWRnZUJhc2VJZCcsIHtcbiAgICAgIHZhbHVlOiBncmFwaEtiLmtub3dsZWRnZUJhc2VJZCxcbiAgICAgIGRlc2NyaXB0aW9uOiAnVGhlIElEIG9mIHRoZSBrbm93bGVkZ2UgYmFzZScsXG4gICAgICBleHBvcnROYW1lOiAnS25vd2xlZGdlQmFzZUlkJywgXG4gICAgfSk7XG4gICAgLy8gc3VwZXJ2aXNvciBhZ2VudCBpZFxuICAgIG5ldyBjZGsuQ2ZuT3V0cHV0KHRoaXMsICdTdXBlcnZpc29yQWdlbnRJZCcsIHtcbiAgICAgIHZhbHVlOiBTdXBlcnZpc29yQWdlbnRXaXRoQ29kZUludGVycHJldGVyLmFnZW50SWQsXG4gICAgICBkZXNjcmlwdGlvbjogJ1RoZSBJRCBvZiB0aGUgU3VwZXJ2aXNvciBhZ2VudCcsXG4gICAgICBleHBvcnROYW1lOiAnU3VwZXJ2aXNvckFnZW50SWQnLCBcbiAgICB9KTtcbiAgICAvLyBwZGYgYWdlbnQgaWRcbiAgICBuZXcgY2RrLkNmbk91dHB1dCh0aGlzLCAnUERGQWdlbnRJZCcsIHtcbiAgICAgIHZhbHVlOiBQREZfYWdlbnQuYWdlbnRJZCxcbiAgICAgIGRlc2NyaXB0aW9uOiAnVGhlIElEIG9mIHRoZSBQREYgYWdlbnQnLFxuICAgICAgZXhwb3J0TmFtZTogJ1BERkFnZW50SWQnLCBcbiAgICB9KTtcblxuICB9XG59XG4iXX0=