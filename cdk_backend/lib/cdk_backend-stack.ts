import * as cdk from 'aws-cdk-lib';
import { Construct } from 'constructs';
import * as s3 from 'aws-cdk-lib/aws-s3';
import * as lambda from 'aws-cdk-lib/aws-lambda';
import * as os from 'os';


export class CdkBackendStack extends cdk.Stack {
  constructor(scope: Construct, id: string, props?: cdk.StackProps) {
    super(scope, id, props);

    // Create an S3 bucket
    // amazonq-ignore-next-line
    const WebsiteData = new s3.Bucket(this, 'WebsiteData', {
      versioned: true,
      removalPolicy: cdk.RemovalPolicy.RETAIN, // NOT recommended for production
    });

    // detect Architecture

    const aws_region = cdk.Stack.of(this).region;
    const accountId = cdk.Stack.of(this).account;
    console.log(`AWS Region: ${aws_region}`);
    const hostArchitecture = os.arch(); 
    console.log(`Host architecture: ${hostArchitecture}`);
    
    const lambdaArchitecture = hostArchitecture === 'arm64'
                                                ? lambda.Architecture.ARM_64
                                                : lambda.Architecture.X86_64;

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

    // Output the bucket name
    new cdk.CfnOutput(this, 'WebsiteDataBucketName', {
      value: WebsiteData.bucketName,
      description: 'The name of the S3 bucket where website data will be stored',
      exportName: 'WebsiteDataBucketName', // Optional: export the bucket name for use in other stacks
    });

    // Grant the Lambda function permissions to read from the S3 bucket
    WebsiteData.grantReadWrite(InmateSummaryScrapper);
    WebsiteData.grantReadWrite(CondemnedInmateListScrapper);
    WebsiteData.grantReadWrite(ScoreJailRosterScraper);

  }
}
