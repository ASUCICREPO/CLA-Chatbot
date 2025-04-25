# Multi AI Agent Powered Inmate Data Analysis System with Real-time Chat Interface

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
│   │   ├── CondemnedInmateListScrapper/  # Condemned inmate data scraper
│   │   ├── ScoreJailRosterScraper/  # Jail roster scraper
│   │   ├── backup.py          # Backup utility
│   │   ├── requirements.txt   # Python dependencies
│   │   └── web_socket_opener/  # WebSocket connection handler
│   └── lib/                    # CDK stack definition
└── frontend/                   # React frontend application
    ├── public/                 # Static assets
    └── src/                    # Source code
        ├── Components/         # React components
        │   ├── BotStates/     # Chat bot state components
        │   └── ChatBody.jsx   # Main chat interface
        │   ├── AppHeader.jsx  # Application header component
        │   ├── Attachment.jsx # File attachment handling
        │   ├── ChatHeader.jsx # Chat header component
        │   ├── ChatInput.jsx  # Chat input component
        │   ├── FAQExamples.jsx # FAQ display component
        │   ├── FileResponse.jsx # File response handling
        │   ├── LandingPage.jsx # Landing page component
        │   ├── LeftNav.jsx    # Left navigation panel
        │   ├── SpeechRecognition.jsx # Voice input component
        │   └── Switch.jsx     # Language switcher component
        └── utilities/         # Helper functions and constants
            ├── LanguageContext.jsx # Language management
            └── TranscriptContext.jsx # Chat transcript management
```

# Deployment Instructions
## Common Prerequisites

- Fork this repository to your own GitHub account (required for deployment and CI/CD):
  1. Navigate to https://github.com/ASUCICREPO/CLA-Chatbot
  2. Click the "Fork" button in the top right corner
  3. Select your GitHub account as the destination
  4. Wait for the forking process to complete
  5. You'll now have your own copy at https://github.com/YOUR-USERNAME/CLA-Chatbot

- Obtain a GitHub personal access token with repo permissions (needed for CDK deployment):
  1. Go to GitHub Settings > Developer Settings > Personal Access Tokens > Tokens (classic)
  2. Click "Generate new token (classic)"
  3. Give the token a name and select the "repo" and "admin:repo_hook" scope
  4. Click "Generate token" and save the token securely
  For detailed instructions, see:
  - https://docs.github.com/en/authentication/keeping-your-account-and-data-secure/managing-your-personal-access-tokens

- Enable the following AWS Bedrock models in your AWS account:
  - `TITAN_EMBED_TEXT_V2_1024`
  - `ANTHROPIC_CLAUDE_HAIKU_V1_0`
  - `ANTHROPIC_CLAUDE_3_5_SONNET_V2_0`
  
  To request access to these models:
  1. Navigate to the AWS Bedrock console
  2. Click "Model access" in the left navigation pane
  3. Click "Manage model access"
  4. Find each model in the list and select the checkbox next to it
  5. Click "Save changes" at the bottom of the page
  6. Wait for model access to be granted (usually within minutes)
  7. Verify access by checking the "Status" column shows "Access granted"

  Note: If you don't see the option to enable a model, ensure your AWS account 
  and region support Bedrock model access. Contact AWS Support if needed.
- AWS Account Permissions 
   - Ensure permissions to create and manage AWS resources like S3, Lambda, Knowledge Bases, AI Agents, Neptune, and Amplify, Websocket , and etc.  
   - [AWS IAM Policies and Permissions](https://docs.aws.amazon.com/IAM/latest/UserGuide/access_policies.html)


## Deployment Using AWS CodeBuild and AWS CLI
### Prerequisites

- Have access to CodeBuild and AWS Cloudshell

### Deployment

1. Open AWS CloudShell in your AWS Console:
   - Click the CloudShell icon in the AWS Console navigation bar
   - Wait for the CloudShell environment to initialize

2. Clone the repository:
```bash
git clone https://github.com/ASUCICREPO/CLA-Chatbot
cd CLA-Chatbot/
```

3. Deploy using the deployment script (recommended):
```bash
chmod +x deploy.sh
./deploy.sh
```

## Manual CDK Deployment
### Prerequisites

1. **AWS CLI**: To interact with AWS services and set up credentials.

   - [Install AWS CLI](https://docs.aws.amazon.com/cli/latest/userguide/install-cliv2.html)
     
2. **npm**  
   - npm is required to install AWS CDK. Install npm by installing Node.js:  
     - [Download Node.js](https://nodejs.org/) (includes npm).  
   - Verify npm installation:  
     ```bash
     npm --version
     ```
3. **AWS CDK**: For defining cloud infrastructure in code.
   - [Install AWS CDK](https://docs.aws.amazon.com/cdk/v2/guide/getting_started.html)  
     ```bash
     npm install -g aws-cdk
     ```

4. **Docker**: Required to build and run Docker images for the ECS tasks.  
   - [Install Docker](https://docs.docker.com/get-docker/)  
   - Verify installation:  
     ```bash
     docker --version
     ```

### Deployment

1. Clone the repository:
```bash
git clone https://github.com/ASUCICREPO/CLA-Chatbot
cd CLA-Chatbot/
```

2. **Set Up Your Environment**:
   - Configure AWS CLI with your AWS account credentials:
     ```bash
     aws configure
     ```

3. Install dependencies:
```bash
cd cdk_backend
npm install
```

4. Bootstrap CDK:
```bash
cdk bootstrap -c githubToken=<your-token> -c githubOwner=<your-github-username> -c githubRepo=<your-repo-name>
```

5. Deploy the stack:
```bash
cdk deploy -c githubToken=<your-token> -c githubOwner=<your-github-username> -c githubRepo=<your-repo-name>
```

## Usage

Once the infrastructure is deployed using either of the two approaches:

1. Upload any CSV / PDF files to the S3 Bucket

2. Sync the Knowledge Base:
   - Go to AWS Console > Bedrock > Knowledge bases
   - Select the knowledge base created by the stack
   - Click "Sync data sources" button
   - Wait for sync to complete (status will show "Available")

3. Deploy the Frontend:
   - Go to AWS Console > AWS Amplify
   - Select the app created by the stack
   - Click "Run build" under the main branch
   - Wait for build and deployment to complete
   - Access the application URL provided by Amplify 

4. Using the Application:
   - Once frontend deployment is complete, navigate to the Amplify URL
   - The chat interface will load with example queries
   - Enter questions about your inmate data, for example:
     - "What is the total inmate population?"
     - "Show me demographic breakdown by age"
     - "What are the most common offenses?" 


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

## Infrastructure

![Infrastructure diagram](./docs/infra.svg)

## Overview

- **Data Ingestion**  
  Python-based scrapers crawl target sites and drop CSV files into an Amazon S3 bucket, which serves as the single source of truth for all documents.

- **Knowledge Construction**  
  Ingested files feed into a Neptune-backed graph as a vector index. Documents are parsed into nodes/relationships and embedded for fast similarity search.

- **AI Processing**  
  A Supervisor Agent (Claude Sonnet 3.5 V2) processes quantitative queries with a code-enabled CSV processor and qualitative queries to a PDF-focused agent. Both agents leverage Bedrock foundation models and shared memory/guardrails.

- **Real-Time Messaging**  
  Users connect via a WebSocket API gateway. Incoming messages hit a Lambda “orchestrator” that invokes the appropriate AI agent(s) and streams back responses over the same socket.

- **Front-End Delivery**  
  A ReactJS chat interface hosted on AWS Amplify opens the WebSocket connection, displays answers instantly, and automatically updates whenever new code is pushed to the GitHub repository.  


## End-to-End Flow

```
[User Input] -> [WebSocket API] -> [Lambda Handler] -> [Bedrock AI Agents]
                                                   -> [Knowledge Base]
     [UI] <- [WebSocket Response] <- [Processed Results]
```

1. **User** opens the web app in their browser.  
2. **Browser** sends a query (e.g., “What’s the average inmate count?”). 
3. **Client** establishes a WebSocket connection to API Gateway.
4. **WebSocket Handler** Lambda receives the message and triggers BedrockAIAgent.  
5. **Supervisor Agent**  
   - If quantitative → runs Python code on CSVs stored in S3.  
   - If text-only → delegates to PDF Agent.  
6. **PDF Agent**  
   - Retrieves relevant graph embeddings.  
   - Chunks and summarizes PDF content.  
7. **Supervisor** merges results (CSV or PDF), returns a final answer.  
8. **BedrockAIAgent** publishes the response back through the WebSocket.  
9. **User** sees the answer in real time on the web UI.

---

This modular, serverless design ensures **scalability**, **security**, and **extensibility**—you can add new ingestion pipelines, swap foundation models, or introduce additional agents without rewriting core infrastructure.

## The application is deployed using AWS CDK with the following key resources:

### Lambda Functions:
- BedrockAIAgent: Processes chat queries using AWS Bedrock
- InmateSummaryScrapper: Scrapes and processes inmate summary data
- CondemnedInmateListScrapper: Scrapes condemned inmate data
- ScoreJailRosterScraper: Scrapes jail roster information
- web_socket_opener: Handles WebSocket connections

### Bedrock Components:
- Graph Knowledge Base: Stores and processes inmate data
- PDF Agent: Handles non-quantitative queries using PDF files
- Supervisor Agent: Processes quantitative queries with code interpreter
- Content Filtering: Implements guardrails and content moderation

### Other AWS Services:
- S3 Bucket: Stores website data and scraped information
- OpenSearch Serverless: Vector database for knowledge base
- Bedrock: AI model inference and knowledge base
- API Gateway: WebSocket API endpoint
- IAM: Roles and permissions for service interactions