# AI-Powered Inmate Data Analysis System with Real-time Chat Interface

This project provides a comprehensive system for analyzing inmate population data through an AI-powered chat interface. It combines AWS Bedrock's AI capabilities with web scraping functionality to deliver real-time insights about inmate statistics, demographics, and trends from publicly available correctional facility data.

The system consists of a React-based frontend that provides an intuitive chat interface and a serverless backend powered by AWS CDK that handles data collection, processing, and AI-driven analysis. The application uses AWS Bedrock for natural language processing and vector knowledge base capabilities to provide accurate and context-aware responses to user queries about inmate data.

## Repository Structure
```
.
├── cdk_backend/                 # AWS CDK Infrastructure as Code
│   ├── bin/                    # CDK app entry point
│   ├── lambda/                 # Lambda functions for data processing
│   │   ├── BedrockAIAgent/     # AI chat processing Lambda
│   │   ├── InmateSummaryScrapper/  # Data scraping Lambda
│   │   └── web_socket_opener/  # WebSocket connection handler
│   └── lib/                    # CDK stack definition
└── frontend/                   # React frontend application
    ├── public/                 # Static assets
    └── src/                    # Source code
        ├── Components/         # React components
        │   ├── BotStates/     # Chat bot state components
        │   └── ChatBody.jsx   # Main chat interface
        └── utilities/         # Helper functions and constants
```

## Usage Instructions
### Prerequisites
- Node.js 14.x or later
- AWS CLI configured with appropriate credentials
- AWS CDK CLI installed (`npm install -g aws-cdk`)
- Docker installed and running (for Lambda function builds)
- Python 3.12 for Lambda functions

### Installation

1. Clone the repository:
```bash
git clone <repository-url>
cd <repository-name>
```

2. Install frontend dependencies:
```bash
cd frontend
npm install
```

3. Install backend dependencies:
```bash
cd ../cdk_backend
npm install
```

4. Deploy the CDK stack:
```bash
cdk deploy -c githubToken=<your-token> -c githubOwner=<your-github-username> -c githubRepo=<your-repo-name>
```

### Quick Start
1. Start the frontend development server:
```bash
cd frontend
npm start
```

2. Open your browser and navigate to `http://localhost:3000`

3. Begin chatting with the AI assistant by typing questions about inmate data

### More Detailed Examples
1. Query inmate demographics:
```
"What are the top offenses by county?"
"Compare the suicide rate between 2015 and the previous year"
```

2. Analyze population trends:
```
"What is the average daily population?"
"Show me the trend of inmate population over the last 5 years"
```

### Troubleshooting
1. WebSocket Connection Issues
- Error: "WebSocket connection failed"
  - Check if the AWS API Gateway WebSocket API is deployed correctly
  - Verify the WebSocket URL in the frontend environment variables
  - Ensure your AWS credentials have appropriate permissions

2. Lambda Function Errors
- Error: "Lambda function timed out"
  - Check CloudWatch logs for detailed error messages
  - Increase the Lambda function timeout in CDK stack
  - Verify memory allocation is sufficient

3. AI Response Issues
- Error: "Knowledge base not responding"
  - Verify the Bedrock knowledge base is properly configured
  - Check if the S3 bucket contains the required data files
  - Ensure the Lambda function has proper IAM permissions

## Data Flow
The system processes user queries through a multi-stage pipeline that combines real-time data retrieval with AI-powered analysis.

```
[User Input] -> [WebSocket API] -> [Lambda Handler] -> [Bedrock AI Agent]
                                                   -> [Knowledge Base]
                                                   -> [Data Scrapers]
     [UI] <- [WebSocket Response] <- [Processed Results]
```

Key component interactions:
- Frontend sends user queries through WebSocket connection
- WebSocket handler Lambda routes messages to appropriate processors
- BedrockAIAgent processes queries using the knowledge base
- Data scrapers collect and update inmate information periodically
- Results are streamed back to the UI through WebSocket connection

## Infrastructure

![Infrastructure diagram](./docs/infra.svg)
The application is deployed using AWS CDK with the following key resources:

Lambda Functions:
- BedrockAIAgent: Processes chat queries using AWS Bedrock
- InmateSummaryScrapper: Scrapes and processes inmate summary data
- CondemnedInmateListScrapper: Scrapes condemned inmate data
- ScoreJailRosterScraper: Scrapes jail roster information
- web_socket_opener: Handles WebSocket connections

AWS Services:
- S3 Bucket: Stores website data and scraped information
- OpenSearch Serverless: Vector database for knowledge base
- Bedrock: AI model inference and knowledge base
- API Gateway: WebSocket API endpoint
- IAM: Roles and permissions for service interactions