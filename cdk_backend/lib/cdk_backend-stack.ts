import * as cdk from 'aws-cdk-lib';
import { Construct } from 'constructs';
import * as s3 from 'aws-cdk-lib/aws-s3';
import * as lambda from 'aws-cdk-lib/aws-lambda';
import * as os from 'os';
import { aws_bedrock as bedrock2 } from 'aws-cdk-lib';
import * as iam from 'aws-cdk-lib/aws-iam';
import * as apigatewayv2 from 'aws-cdk-lib/aws-apigatewayv2';
import * as apigatewayv2_integrations from 'aws-cdk-lib/aws-apigatewayv2-integrations';
import { bedrock as bedrock } from '@cdklabs/generative-ai-cdk-constructs';
import * as secretsmanager from 'aws-cdk-lib/aws-secretsmanager';
import * as amplify from '@aws-cdk/aws-amplify-alpha';


export class CdkBackendStack1 extends cdk.Stack {
  constructor(scope: Construct, id: string, props?: cdk.StackProps) {
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
      ]});

    bedrockRole.addToPolicy(new iam.PolicyStatement({
        actions:   ['neptune-graph:*'],
        resources: ['*'],
      }));



      const bedrockRoleAgentPDF = new iam.Role(this, 'BedrockRole3', {
      assumedBy: new iam.ServicePrincipal('bedrock.amazonaws.com'),
      managedPolicies: [
        // amazonq-ignore-next-line
        iam.ManagedPolicy.fromAwsManagedPolicyName('AmazonS3FullAccess'),
        iam.ManagedPolicy.fromAwsManagedPolicyName('AmazonBedrockFullAccess'),
        iam.ManagedPolicy.fromAwsManagedPolicyName('CloudWatchFullAccessV2'),
      ]});

      const bedrockRoleAgentSupervisor = new iam.Role(this, 'BedrockRole', {
        assumedBy: new iam.ServicePrincipal('bedrock.amazonaws.com'),
        managedPolicies: [
          // amazonq-ignore-next-line
          iam.ManagedPolicy.fromAwsManagedPolicyName('AmazonS3FullAccess'),
          iam.ManagedPolicy.fromAwsManagedPolicyName('AmazonBedrockFullAccess'),
          iam.ManagedPolicy.fromAwsManagedPolicyName('CloudWatchFullAccessV2'),
        ]});

    const graphKb = new bedrock.GraphKnowledgeBase(this, 'GraphRagKB', {
      name: 'InmateDataGraphKB',
      description: 'A knowledge base for Inmate Data combied PDF and CSV',
      embeddingModel: bedrock.BedrockFoundationModel.TITAN_EMBED_TEXT_V2_1024,
      instruction: 'Use the Neptune-backed graph to answer inmate-data queries.',
      existingRole: bedrockRole,
  });

    
    // const DataSource = new bedrock2.CfnDataSource(this, 'KnowledgeBaseDataSource', {
    //   name: 'InmateDataKnowledgeBase12',  
    //   knowledgeBaseId: graphKb.knowledgeBaseId,

    //   dataSourceConfiguration: {
    //     type: 'S3',
    //     s3Configuration: {
    //       bucketArn: WebsiteData.bucketArn,
    //     },
    //   },
    //   vectorIngestionConfiguration: {
    //     parsingConfiguration: {
    //       parsingStrategy: "BEDROCK_DATA_AUTOMATION",
    //     },
    //   },
    // });

    new bedrock2.CfnDataSource(this, 'KnowledgeBaseDataSource', {
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
            // use the Claude 3 Haiku model for chunk/entity extraction with aws region
            modelArn: bedrock.BedrockFoundationModel.ANTHROPIC_CLAUDE_HAIKU_V1_0.modelArn,
            enrichmentStrategyConfiguration: {

              method: 'CHUNK_ENTITY_EXTRACTION',
            },
          },
        },
      },
    });

    const guardrail = new bedrock.Guardrail(this, 'bedrockGuardrails', {
      name: 'ChatbotGuardrails',
      blockedOutputsMessaging: 'I am sorry, but I cannot provide that information. Plase ask me something else.',
    });
    
    const DEFAULT_INPUT  = bedrock.ContentFilterStrength.HIGH;
    const DEFAULT_OUTPUT = bedrock.ContentFilterStrength.MEDIUM;
    const INPUT_MODS  = [bedrock.ModalityType.TEXT, bedrock.ModalityType.IMAGE];
    const OUTPUT_MODS = [bedrock.ModalityType.TEXT];

    // Grab just the string‐enum members
    const allFilters = Object
      .values(bedrock.ContentFilterType)
      .filter((f): f is bedrock.ContentFilterType => typeof f === 'string');

    for (const type of allFilters) {
      // enforce AWS rule: PROMPT_ATTACK => responseStrength NONE
      const responseStrength =
        type === bedrock.ContentFilterType.PROMPT_ATTACK
          ? bedrock.ContentFilterStrength.NONE
          : DEFAULT_OUTPUT;

      guardrail.addContentFilter({
        type,
        inputStrength:  DEFAULT_INPUT,
        outputStrength: responseStrength,
        inputModalities:  INPUT_MODS,
        outputModalities: OUTPUT_MODS,
      });
    }
    
    // cross region inference profile from genai cdk
    const cris_nova = bedrock.CrossRegionInferenceProfile.fromConfig({
      geoRegion: bedrock.CrossRegionInferenceProfileRegion.US,
      model: bedrock.BedrockFoundationModel.AMAZON_NOVA_PRO_V1,
    });

    const cris_claude = bedrock.CrossRegionInferenceProfile.fromConfig({
      geoRegion: bedrock.CrossRegionInferenceProfileRegion.US,
      model: bedrock.BedrockFoundationModel.ANTHROPIC_CLAUDE_3_5_SONNET_V2_0,
    });

    const prompt_for_PDF_agent = 
    `You are an AI assistant with access to a library of PDF documents. When a user asks a question:
    1. Search the knowledge base for relevant PDF files only; ignore any CSVs or other formats.
    2. Extract and summarize the key information from those PDFs.
    3. Answer the user clearly and concisely, citing only the PDF-sourced data.
    4. If no PDF contains the requested information, reply:
      “I couldn't find any relevant information in the available PDF documents I have.”
    5. <IMPORTANT> If you find multiple data sources that differ by any dimension—such as year, demographic group (e.g., male/female), region, or other categories—list the dimensions and the available options, then ask:
      “I found data for multiple [dimensions]: [options]. Which [dimension] would you like to focus on?”
      For example:
        - “I found data for years: 2018, 2019, 2020. Which year are you interested in?”
        - “I found data for groups: male, female, combined. Which group should I use?”</IMPORTANT>`



    const PDF_agent = new bedrock.Agent(this, 'Agent-PDF', {
      name: 'PDFAgent-with-knowledge-base-v1',
      description: 'This agent is responsible for processing non-quantitative queries using PDF files and knowledge base.',
      foundationModel: cris_nova,
      shouldPrepareAgent: true,
      knowledgeBases: [graphKb],
      existingRole: bedrockRoleAgentPDF,
      instruction: prompt_for_PDF_agent,
    });
    
    const PDF_agent_Alias = new bedrock.AgentAlias(this, 'PDFAgentAlias', {
      agent: PDF_agent,
      aliasName: "ProductionPDFAgentv1",
      description: 'Production alias for the PDF agent',
    })

    const prompt_for_supervisor = 
    `You are the Supervisor Agent, acting as the primary CSV processing agent. Your role is to process quantitative, data-driven queries using attached CSV files via the Code Interpreter. If the CSV-based approach fails (e.g., due to missing data, insufficient columns, or inability to compute the required result), then delegate the query to the agent PDF-Agent-With-KB for a text-based response and then give the final answer.

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

    const prompt_collaboration_Supervisor_X_PDF = 
    `The PDF-Agent handles non-quantitative queries by retrieving and synthesizing information exclusively from PDF documents in the Knowledge Base. When a user asks for summaries, explanations, or textual analyses, or if the you cannot process the query, PDF-Agent ignores CSV files entirely and only answers based on textual information in PDF.`
    
    const SupervisorAgentWithCodeInterpreter = new bedrock.Agent(this, 'SupervisorAgentWithCodeInterpreter', {
      name: 'SupervisorAgentWithCodeInterpreterv1',
      description: 'This agent is responsible for processing quantitative queries using CSV files and routing non-quantitative queries to the PDF agent.',
      instruction: prompt_for_supervisor,
      foundationModel: cris_claude,
      shouldPrepareAgent: true,
      userInputEnabled: true,
      codeInterpreterEnabled: true,
      guardrail: guardrail,
      existingRole: bedrockRoleAgentSupervisor,
      agentCollaboration: bedrock.AgentCollaboratorType.SUPERVISOR_ROUTER,
      memory: bedrock.Memory.sessionSummary({
        maxRecentSessions:10,
        memoryDurationDays: 30,
      }),
      agentCollaborators: [
        new bedrock.AgentCollaborator({
          agentAlias: PDF_agent_Alias,
          collaborationInstruction: prompt_collaboration_Supervisor_X_PDF,
          collaboratorName: 'PDFAgentWithKnowledgeBase-v1',
          relayConversationHistory: true,
        }),
      ],
    });

    const Supervisor_Agent_Alias = new bedrock.AgentAlias(this, 'SupervisorAgentAlias', {
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

    const webSocketApiArn = `arn:aws:execute-api:${this.region}:${this.account}:${webSocketApi.apiId}/${webSocketStage.stageName}/POST/@connections/*`;

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
    BedrockAIAgent.role?.addManagedPolicy(
      cdk.aws_iam.ManagedPolicy.fromAwsManagedPolicyName('AmazonBedrockFullAccess'),
    );
    // api gateway 
    BedrockAIAgent.role?.addManagedPolicy(
      cdk.aws_iam.ManagedPolicy.fromAwsManagedPolicyName('AmazonAPIGatewayInvokeFullAccess'),
    );

    BedrockAIAgent.grantInvoke(webSocketHandler)


    const webSocketIntegration = new apigatewayv2_integrations.WebSocketLambdaIntegration('web-socket-integration', webSocketHandler);

    webSocketApi.addRoute('sendMessage',
      {
        integration: webSocketIntegration,
        returnResponse: true
      }
    );


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
