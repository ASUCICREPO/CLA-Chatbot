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

## Usage Instructions
### Prerequisites
- Node.js 14.x or later
- AWS CLI configured with appropriate credentials
- AWS CDK CLI installed (`npm install -g aws-cdk`)
- Docker installed and running (for Lambda function builds)
- GitHub account with personal access token
- Python 3.12 for Lambda functions

### Installation

1. Clone the repository:
```bash
git clone https://github.com/ASUCICREPO/CLA-Chatbot
cd CLA-Chatbot/
```

2. Deploy using the deployment script (recommended):
```bash
chmod +x deploy.sh
./deploy.sh
```

Alternatively, for manual deployment, follow these steps:

1. Install dependencies:
```bash
cd cdk_backend
npm install
```

2. Bootstrap CDK:
```bash
cdk bootstrap -c githubToken=<your-token> -c githubOwner=<your-github-username> -c githubRepo=<your-repo-name>
```

3. Deploy the stack:
```bash
cdk deploy -c githubToken=<your-token> -c githubOwner=<your-github-username> -c githubRepo=<your-repo-name>
```

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
- Multiple data scrapers collect and update inmate information periodically
- Results are streamed back to the UI through WebSocket connection

## Infrastructure

![Infrastructure diagram](./docs/infra.svg)

# Serverless Multi-Agent Chatbot Architecture

This architecture weaves together AWS compute, storage, data-processing, and AI services into a real-time, multi-agent chatbot platform. Below is a high-level, step-by-step walk-through of how each component collaborates to ingest data, manage knowledge, run AI agents, and deliver responses to end users.

---

## 1. Data Ingestion & Storage

1. **Lambda Scrapers**  
   - Python-based Lambdas crawl and fetch target data tables.  
   - They write raw files into a versioned Amazon S3 bucket (`WebsiteData`).

2. **S3 as Single Source of Truth**  
   - All incoming documents (PDFs/CSVs) live in `WebsiteData`.  
   - You can add more connectors to S3 manually or add more documents in a automated fashion.
   
---

## 2. Knowledge Base Construction

1. **Neptune-Backed Graph RAG**  
   - A Graph Knowledge Base an graph in Amazon Neptune.  
   - Ingested S3 objects are parsed into nodes and relationships.

2. **Vector Embeddings with Bedrock**  
   - Each document chunk is embedded using a Bedrock foundation model (Titan/Text-V2).  
   - Embeddings are indexed for fast vector similarity queries.

3. **S3 Data Source Definition**  
   - A CfnDataSource ties the S3 bucket to the knowledge base,  
   - Enabling Bedrock Data Automation parsing and context enrichment.

---

## 3. AI Guardrails & Content Filtering

1. **Guardrail Construct**  
   - Enforces input/output safety rules across modalities (TEXT, IMAGE).  
   - Dynamically adjusts filter strengths for different content-types (e.g., prompt attacks).

2. **Blocked-Output Messaging**  
   - Custom fallback message when policies are triggered:  
     > “I am sorry, but I cannot provide that information. Please ask me something else.”

---

## 4. Multi-Agent Collaboration

1. **PDF Agent**  
   - Foundation Model: Amazon Nova Pro (cross-region).  
   - Role: Answer non-quantitative, text-based queries by retrieving from the graph KB.  
   - Instruction enforces citation of PDF sources and dimension disambiguation.

2. **Supervisor Agent**  
   - Foundation Model: Anthropic Claude 3.5 Sonnet (cross-region).  
   - Code Interpreter enabled for CSV processing:  
     - Generates dynamic Python code to compute metrics or transform tables.  
     - Fallback to PDF Agent if CSV processing fails.  
   - Routes queries based on type (quantitative vs. qualitative).

3. **Agent Aliases**  
   - Production-ready aliases for both agents, enabling versioning and roll-back.

---

## 5. Real-Time Messaging Layer

1. **API Gateway WebSocket**  
   - Defines a WebSocket API (`cla-web-socket-api`) and a `production` stage.  
   - Manages client connections and subscriptions.

2. **WebSocket Handler Lambda**  
   - Invoked on incoming messages (`$default` or custom routes).  
   - Forwards user queries to the BedrockAIAgent function via its ARN.

3. **BedrockAIAgent Lambda**  
   - Acts as the orchestration hub:  
     - Receives WebSocket events.  
     - Calls Supervisor Agent (and PDF Agent as needed).  
     - Publishes responses back to the WebSocket connection.

---

## 6. Front-End Delivery

1. **AWS Amplify Hosting**  
   - Connects to your GitHub repo via a GitHub token stored in Secrets Manager.  
   - Runs `npm ci` → `npm run build` on each `main` branch commit.  
   - Deploys the React app from `frontend/build`.

2. **Environment Injection**  
   - Amplify build injects:  
     - `REACT_APP_WEBSOCKET_API`  
     - `REACT_APP_BUCKET_NAME`  
     - Region variables  
   - Ensures the UI can open WebSocket connections and fetch assets from S3.

---

## 7. End-to-End Flow

1. **User** opens the web app in their browser.  
2. **Client** establishes a WebSocket connection to API Gateway.  
3. **Browser** sends a query (e.g., “What’s the average inmate count?”).  
4. **WebSocket Handler** Lambda receives the message and triggers BedrockAIAgent.  
5. **Supervisor Agent**  
   - If quantitative → runs Python on CSVs stored in S3.  
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