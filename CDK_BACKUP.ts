import * as cdk from 'aws-cdk-lib';
import { Construct } from 'constructs';
import * as s3 from 'aws-cdk-lib/aws-s3';
import * as lambda from 'aws-cdk-lib/aws-lambda';
import * as os from 'os';
import { aws_bedrock as bedrock } from 'aws-cdk-lib';
import * as iam from 'aws-cdk-lib/aws-iam';
import * as apigatewayv2 from '@aws-cdk/aws-apigatewayv2-alpha';
import * as apigatewayv2_integrations from '@aws-cdk/aws-apigatewayv2-integrations-alpha';
import * as opensearchServerless from 'aws-cdk-lib/aws-opensearchserverless';


export class CdkBackendStack extends cdk.Stack {
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

    
    const encryptionPolicy = new opensearchServerless.CfnSecurityPolicy(this, 'MyEncryptionPolicy', {
      name: 'collection-ecn-policy',
      type: 'encryption',
      description: 'Encryption policy for the collection',
      policy: JSON.stringify({
        "Rules": [
          {
            "ResourceType": "collection",
            "Resource": ["collection/collectionknowledgebase"]
          }
        ],
        "AWSOwnedKey": true
      })
    });
    const networkPolicy = new opensearchServerless.CfnSecurityPolicy(this, 'MyNetworkPolicy', {
      name: 'collection-network-policy',
      type: 'network',
      description: 'Network policy for the collection',
      policy: JSON.stringify([
        {
          Description: 'Allow access to the collection',
          Rules: [
            {
              ResourceType: 'collection',
              Resource: [`collection/collectionknowledgebase`]
            }
          ],
          AllowFromPublic: true
        }
      ])
    });
    
    // Add dependency
    const osCollection = new opensearchServerless.CfnCollection(this, 'MyOpenSearchCollection', {
      type: 'VECTORSEARCH', 
      name: 'collectionknowledgebase', 
      description: 'OpenSearch Serverless collection for storing vector embeddings',
    });

    osCollection.node.addDependency(encryptionPolicy);

    const osIndex = new opensearchServerless.CfnIndex(this, 'MyCfnIndex', {
      collectionEndpoint: osCollection.attrCollectionEndpoint, 
      indexName: 'embeddings', 
    
      mappings: {
        properties: {
          // Vector field configuration for embeddings
          embeddings: {
            type: 'knn_vector',
            dimension: 1024, // Titan V2 Embedding dimension
            method: {
              engine: 'faiss',
              name: 'hnsw',
              spaceType: 'l2', // Euclidean distance metric for floating-point vectors
            },
          },
          text: {
            type: 'text',
            index: true, 
          },
          'bedrock-metadata': {
            type: 'text',
            index: false, 
          },
        },
      },
    });
    
    const modelUri = 'amazon.titan-embed-text-v2:0';
    const modelArn = `arn:aws:bedrock:${aws_region}::foundation-model/${modelUri}`;

    const kbRole = new iam.Role(this, 'KnowledgeBaseRole', {
      assumedBy: new iam.ServicePrincipal('bedrock.amazonaws.com'),
    });
    
    // Add permissions for S3
    kbRole.addToPolicy(new iam.PolicyStatement({
      effect: iam.Effect.ALLOW,
      actions: ['s3:GetObject', 's3:ListBucket'],
      resources: [WebsiteData.bucketArn, `${WebsiteData.bucketArn}/*`],
    }));
    
    // Add permissions for OpenSearch Serverless
    kbRole.addToPolicy(new iam.PolicyStatement({
      effect: iam.Effect.ALLOW,
      actions: [
        'aoss:*',
      ],
      resources: [osCollection.attrArn, `${osCollection.attrArn}/*`],
    }));
    
    // Add Bedrock permissions
    kbRole.addManagedPolicy(
      iam.ManagedPolicy.fromAwsManagedPolicyName('AmazonBedrockFullAccess')
    );
    
    const kbRoleArn = kbRole.roleArn; // The role you pass to CfnKnowledgeBase

    const osAccessPolicy = new opensearchServerless.CfnAccessPolicy(this, 'MyOpenSearchAccessPolicy', {
      name: 'os-access-policy',
      type: 'data',
      policy: JSON.stringify([
        {
          Description: "Access policy for Bedrock Knowledge Base",
          Rules: [
            {
              ResourceType: "collection",
              Resource: [`collection/${osCollection.name}`],
              Permission: [
                "aoss:*",
              ]
            }
          ],
          Principal: [kbRoleArn]
        }
      ])
    });
    
    osAccessPolicy.node.addDependency(osCollection);

    console.log(`OpenSearch collection ARN: ${osCollection.attrArn}`);
    console.log(`OpenSearch collection endpoint: ${osCollection.attrCollectionEndpoint}`);
    console.log(`OpenSearch index name: ${osIndex.indexName}`);

    const kb = new bedrock.CfnKnowledgeBase(this, 'CombinedPdfCsvKnowledgeBase', {
      name: 'combined-pdf-csv',
      roleArn: kbRole.roleArn, // role for the knowledge base
      knowledgeBaseConfiguration: {
        type: 'VECTOR', 
        vectorKnowledgeBaseConfiguration: {
          embeddingModelArn: modelArn, // update with your v2 Titan ARN 
        }
      },
      storageConfiguration: {
        type: 'OPENSEARCH_SERVERLESS', 
        opensearchServerlessConfiguration: {
          collectionArn: osCollection.attrArn, 
          fieldMapping: {
            metadataField: 'bedrock-metadata',
            textField: 'text',
            vectorField: 'embeddings',
          },
          vectorIndexName: osIndex.indexName // update as needed
        }
      }
    });
  
    kb.node.addDependency(osCollection);
    kb.node.addDependency(osAccessPolicy);
    kb.node.addDependency(osIndex); 

    osIndex.node.addDependency(osAccessPolicy);
    osIndex.node.addDependency(osCollection);


    // const bedrockAgentRole = new iam.Role(this, 'BedrockAgentRole', {
    //   assumedBy: new iam.ServicePrincipal('bedrock.amazonaws.com'),
    // });

    // Add required permissions to the role
    // bedrockAgentRole.addToPolicy(new iam.PolicyStatement({
    //   effect: iam.Effect.ALLOW,
    //   actions: [
    //     'lambda:InvokeFunction',
    //     'bedrock:InvokeModel'
    //   ],
    //   resources: ['*'], // Adjust this to restrict access to specific resources if needed
    // }));
                                                
    // const agent = new bedrock.CfnAgent(this, 'MyBedrockAgent', {
    //   agentName: 'MyCustomAgent',
    //   instruction: 'You are a helpful assistant that provides information about inmates.',
    //   foundationModel: 'anthropic.claude-v2', // or your preferred model
    //   agentResourceRoleArn: bedrockAgentRole.roleArn,
    // });
    // const agentAlias = new bedrock.CfnAgentAlias(this, 'MyAgentAlias', {
    //   agentId: agent.attrAgentId,
    //   agentAliasName: 'production',
    // });


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
      },
      timeout: cdk.Duration.seconds(120),
    });

    const webSocketHandler = new lambda.Function(this, 'pc-web-socket-handler', {
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

    // new cdk.CfnOutput(this, 'BedrockAgentId', {
    //   value: agent.attrAgentId,
    //   description: 'The ID of the Bedrock Agent',
    // });
    
    // new cdk.CfnOutput(this, 'BedrockAgentAliasId', {
    //   value: agentAlias.attrAgentAliasId,
    //   description: 'The ID of the Bedrock Agent Alias',
    // });

  }
}
