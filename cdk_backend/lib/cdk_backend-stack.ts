import * as cdk from 'aws-cdk-lib';
import { Construct } from 'constructs';
import * as s3 from 'aws-cdk-lib/aws-s3';
import * as lambda from 'aws-cdk-lib/aws-lambda';
import * as os from 'os';
import { aws_bedrock as bedrock2 } from 'aws-cdk-lib';
import * as iam from 'aws-cdk-lib/aws-iam';
import * as apigatewayv2 from 'aws-cdk-lib/aws-apigatewayv2';
import * as apigatewayv2_integrations from 'aws-cdk-lib/aws-apigatewayv2-integrations';
import { bedrock } from '@cdklabs/generative-ai-cdk-constructs';


export class CdkBackendStack1 extends cdk.Stack {
  constructor(scope: Construct, id: string, props?: cdk.StackProps) {
    super(scope, id, props);

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
        iam.ManagedPolicy.fromAwsManagedPolicyName('AmazonOpenSearchServiceFullAccess'),
        iam.ManagedPolicy.fromAwsManagedPolicyName('CloudWatchFullAccessV2'),
      ]});

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

    const kb = new bedrock.VectorKnowledgeBase(this, 'KnowledgeBase', {
      embeddingsModel: bedrock.BedrockFoundationModel.TITAN_EMBED_TEXT_V2_1024,
      instruction: 'Use this knowledge base to answer questions about CSV and PDF related Inmate Data.',
      name: 'InmateDataKnowledgeBase12',
      description: 'A knowledge base for Inmate Data combied PDF and CSV',
      existingRole: bedrockRole,
    });
    
    const DataSource = new bedrock2.CfnDataSource(this, 'KnowledgeBaseDataSource', {
      name: 'InmateDataKnowledgeBase12',  
      knowledgeBaseId: kb.knowledgeBaseId,

      dataSourceConfiguration: {
        type: 'S3',
        s3Configuration: {
          bucketArn: WebsiteData.bucketArn,
        },
      },
      vectorIngestionConfiguration: {
        parsingConfiguration: {
          parsingStrategy: "BEDROCK_DATA_AUTOMATION",
        },
      },
    });
    // cross region inference profile from genai cdk
    const cris_nova = bedrock.CrossRegionInferenceProfile.fromConfig({
      geoRegion: bedrock.CrossRegionInferenceProfileRegion.US,
      model: bedrock.BedrockFoundationModel.AMAZON_NOVA_PRO_V1,
    });

    const cris_claude = bedrock.CrossRegionInferenceProfile.fromConfig({
      geoRegion: bedrock.CrossRegionInferenceProfileRegion.US,
      model: bedrock.BedrockFoundationModel.ANTHROPIC_CLAUDE_3_5_SONNET_V2_0,
    });

    const PDF_agent = new bedrock.Agent(this, 'Agent-PDF', {
      name: 'PDFAgent-with-knowledge-base',
      description: 'This agent is responsible for processing non-quantitative queries using PDF files and knowledge base.',
      foundationModel: cris_nova,
      shouldPrepareAgent: true,
      knowledgeBases: [kb],
      existingRole: bedrockRoleAgentPDF,
      instruction: 'You are a knowledgeable assistant that uses a knowledge base of PDF documents to answer user queries. When a user asks a question, retrieve relevant PDF documents from the knowledge base, filter out any CSV files, summarize the content of the remaining PDF documents, and provide a clear and concise answer based solely on the PDF data.',
    });
    
    const PDF_agent_Alias = new bedrock.AgentAlias(this, 'PDFAgentAlias', {
      agent: PDF_agent,
      aliasName: "ProductionPDFAgent",
      description: 'Production alias for the PDF agent',
    })

    //new bedrock2.CfnAgentAlias(this, 'PDFAgentAlias', {
    //   agentId: PDF_agent.agentId,
    //   agentAliasName: 'ProductionPDFAgent',
    //   description: 'Alias for the PDF agent',
      
    // }); 




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
      name: 'SupervisorAgentWithCodeInterpreter',
      description: 'This agent is responsible for processing quantitative queries using CSV files and routing non-quantitative queries to the PDF agent.',
      instruction: prompt_for_supervisor,
      foundationModel: cris_claude,
      shouldPrepareAgent: true,
      userInputEnabled: true,
      codeInterpreterEnabled: true,
      existingRole: bedrockRoleAgentPDF,
      agentCollaboration: bedrock.AgentCollaboratorType.SUPERVISOR_ROUTER,
      memory: bedrock.Memory.sessionSummary({
        maxRecentSessions:10,
        memoryDurationDays: 30,
      }),
      agentCollaborators: [
        new bedrock.AgentCollaborator({
          agentAlias: PDF_agent_Alias,
          collaborationInstruction: prompt_collaboration_Supervisor_X_PDF,
          collaboratorName: 'PDFAgentWithKnowledgeBase',
          relayConversationHistory: true,
        }),
      ],
    });

    const Supervisor_Agent_Alias = new bedrock.AgentAlias(this, 'SupervisorAgentAlias', {
      agent: SupervisorAgentWithCodeInterpreter,
      aliasName: "ProductionSupervisorAgent",
      description: 'Production alias for the Supervisor agent',
    }); 

    const pdfAgentAliasCfn = PDF_agent_Alias.node.tryFindChild('Resource') as cdk.CfnResource;
    if (pdfAgentAliasCfn) {
      pdfAgentAliasCfn.applyRemovalPolicy(cdk.RemovalPolicy.DESTROY);
    } else {
      console.warn('PDF Agent Alias did not expose an underlying CfnResource; you may need to handle removal manually.');
    }

    const supervisorAgentAliasCfn = Supervisor_Agent_Alias.node.tryFindChild('Resource') as cdk.CfnResource;
    if (supervisorAgentAliasCfn) {
      supervisorAgentAliasCfn.applyRemovalPolicy(cdk.RemovalPolicy.DESTROY);
    } else {
      console.warn('Supervisor Agent Alias did not expose an underlying CfnResource; you may need to handle removal manually.');
    }




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
        KB_ID: kb.knowledgeBaseId,
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


    const webSocketIntegration = new apigatewayv2_integrations.WebSocketLambdaIntegration('cla-web-socket-integration', webSocketHandler);

    webSocketApi.addRoute('sendMessage',
      {
        integration: webSocketIntegration,
        returnResponse: true
      }
    );

    

    // Output the bucket name
    new cdk.CfnOutput(this, 'WebsiteDataBucketName', {
      value: WebsiteData.bucketName,
      description: 'The name of the S3 bucket where website data will be stored',
      exportName: 'WebsiteDataBucketName', // Optional: export the bucket name for use in other stacks
    });

    // output the WebSocket API URL
    new cdk.CfnOutput(this, 'WebSocketApiUrl', {
      value: webSocketApi.apiEndpoint,
      description: 'The URL of the WebSocket API',
      exportName: 'WebSocketApiUrl', // Optional: export the API URL for use in other stacks
    });
    // knowledge base id
    new cdk.CfnOutput(this, 'KnowledgeBaseId', {
      value: kb.knowledgeBaseId,
      description: 'The ID of the knowledge base',
      exportName: 'KnowledgeBaseId', // Optional: export the knowledge base ID for use in other stacks
    });
    // supervisor agent id
    new cdk.CfnOutput(this, 'SupervisorAgentId', {
      value: SupervisorAgentWithCodeInterpreter.agentId,
      description: 'The ID of the Supervisor agent',
      exportName: 'SupervisorAgentId', // Optional: export the agent ID for use in other stacks
    });
    // pdf agent id
    new cdk.CfnOutput(this, 'PDFAgentId', {
      value: PDF_agent.agentId,
      description: 'The ID of the PDF agent',
      exportName: 'PDFAgentId', // Optional: export the agent ID for use in other stacks
    });

  }
}
