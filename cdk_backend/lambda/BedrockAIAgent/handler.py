import json
import boto3
import base64
import os
import time  # Needed for the sleep between retries

agent_client = boto3.client('bedrock-agent-runtime')
gateway = boto3.client(
    "apigatewaymanagementapi",
    endpoint_url=os.environ['URL']
)

def knowledge_base_retrieval(prompt):
    kb_id = os.environ['KB_ID']

    query = {"text": prompt}
    # Retrieve relevant information from the Knowledge Base
    retrieval_configuration = {
        'vectorSearchConfiguration': {
            'numberOfResults': 15,
        }
    }
    # For 5 responses hardcoded
    kb_response = agent_client.retrieve(knowledgeBaseId=kb_id, retrievalQuery=query, retrievalConfiguration=retrieval_configuration)
    # kb_response = agent_client.retrieve(knowledgeBaseId=kb_id, retrievalQuery=query)
    return kb_response

def lambda_handler(event, context):

    connection_id = event.get("connectionId")
    prompt = event.get("prompt", "")
    session_id = event.get("sessionId", "")
    print(f"DEBUG: Received prompt: {prompt}")

    kb_response = knowledge_base_retrieval(prompt)
    print("DEBUG: Knowledge Base response:")
    print(kb_response)
    sources = []
    rag_info_lines = []

    retrieval_results = kb_response.get("retrievalResults") or []
    for result in retrieval_results:
        metadata = result.get("metadata") or {}
        source_uri = metadata.get('x-amz-bedrock-kb-source-uri', "")
        
        # Safely extract the filename from the S3 URI if available
        filename = os.path.basename(source_uri) if source_uri else "Unknown"
        
        sources.append({
            "s3_uri": source_uri,
        })
        
        content = result.get("content") or {}
        text = content.get("text", "")
        rag_info_lines.append(f"{filename} >> {text}")

    rag_info = "\n".join(rag_info_lines)

    print("DEBUG: Combined RAG info:")
    print(rag_info)
    print("DEBUG: Sources:")
    print(sources)
    
    # Prepare CSV files from sources (up to five)
    csv_files = [src for src in sources if src.get("s3_uri", "").lower().endswith(".csv")]
    # remove duplicates
    print("DEBUG: Before Duplicate Removal CSV files:")
    print(csv_files)
    csv_files = list({file["s3_uri"]: file for file in csv_files}.values())
    print("DEBUG: FINAL CSV files:")
    csv_files = csv_files[:5]  # Limit to up to 5 CSV files
    print(csv_files)
    
    # Prepare invocation parameters
    invocation_params = {
        'agentAliasId': os.environ['SUPERVISOR_AGENT_ALIAS_ID'],
        'agentId': os.environ['SUPERVISOR_AGENT_ID'],
        'sessionId': session_id,
        'enableTrace': True,  # Make sure trace is enabled!
        'inputText': prompt,
    }

    if csv_files:
        invocation_params['sessionState'] = {
            'files': [
                {
                    'name': os.path.basename(file["s3_uri"]),
                    'source': {
                        's3Location': {
                            'uri': file["s3_uri"]
                        },
                        'sourceType': 'S3',
                    },
                    'useCase': 'CODE_INTERPRETER'
                }
                for file in csv_files
            ]
        }
    print("DEBUG: Invocation parameters:")
    print(invocation_params)
    
    max_attempts = 3
    for attempt in range(max_attempts):
        try:
            # Attempt to invoke the agent
            response = agent_client.invoke_agent(**invocation_params)
            print("DEBUG: invoke_agent response received. Now streaming...")
            break  # Exit loop on success
        except Exception as e:
            error_message = str(e)
            print(f"ERROR on attempt {attempt+1}: {error_message}")
            # Check for errors that indicate a transient dependency issue
            if ("internalServerException" in error_message or "dependencyFailedException" in error_message):
                if attempt < max_attempts - 1:
                    wait_time = 2 ** (attempt + 1)  # Exponential backoff: 2, 4, 8 seconds...
                    print(f"Retrying after {wait_time} seconds...")
                    time.sleep(wait_time)
                    continue
                else:
                    print("Max retries reached. Raising exception.")
                    raise
            else:
                # For other errors, don't retry
                raise


    # Gather final text and returned files
    final_text_chunks = []
    returned_files = []

    for event_chunk in response.get("completion", []):
        print(f"DEBUG: event_chunk => {event_chunk}")

        # CASE 1: "chunk"
        if "chunk" in event_chunk:
            chunk_bytes = event_chunk["chunk"].get("bytes", b"")
            chunk_str = chunk_bytes.decode("utf-8", errors="replace").strip()

            print(f"DEBUG: Received chunk string => {chunk_str!r}")

            if not chunk_str:
                print("DEBUG: chunk_str is empty, skipping.")
                continue

            # Attempt JSON parse
            try:
                chunk_json = json.loads(chunk_str)
                print("DEBUG: chunk_str is valid JSON =>", chunk_json)
            except json.JSONDecodeError:
                # Not JSON => raw text from the model
                print("DEBUG: chunk_str is raw text (non-JSON). Forwarding to client.")
                block_type = "delta"
                final_text_chunks.append(chunk_str)

                data = {
                    "statusCode": 200,
                    "type": block_type,
                    "text": chunk_str
                }
                gateway.post_to_connection(
                    ConnectionId=connection_id,
                    Data=json.dumps(data)
                )
                continue

            # If JSON parsed successfully, see what keys we have
            if "messageStart" in chunk_json:
                print("DEBUG: Found 'messageStart' in chunk_json.")
                # Optionally handle start of message here
            elif "contentBlockDelta" in chunk_json:
                print("DEBUG: Found 'contentBlockDelta' in chunk_json.")
                text_part = chunk_json["contentBlockDelta"]["delta"].get("text", "")
                final_text_chunks.append(text_part)

                data = {
                    "statusCode": 200,
                    "type": "delta",
                    "text": text_part
                }
                gateway.post_to_connection(
                    ConnectionId=connection_id,
                    Data=json.dumps(data)
                )

            elif "messageStop" in chunk_json:
                print("DEBUG: Found 'messageStop' in chunk_json.")
                # Mark end of the message if desired
            else:
                print("DEBUG: Unhandled JSON structure =>", chunk_json)

        # CASE 2: "files"
        elif "files" in event_chunk:
            print(f"DEBUG: Found 'files' => {event_chunk['files']}")
            for f in event_chunk["files"]["files"]:
                file_bytes = f.get("bytes", b"")
                filename = f.get("name", "unknown")
                file_type = f.get("type", "unknown")

                b64_data = base64.b64encode(file_bytes).decode("utf-8")
                returned_files.append({
                    "filename": filename,
                    "type": file_type,
                    "base64": b64_data
                })

        # CASE 3: "trace"
        elif "trace" in event_chunk:
            trace_obj0 = event_chunk["trace"]
            trace_obj1 = trace_obj0.get("trace")

            # Check if orchestrationTrace exists
            orchestration_trace = trace_obj1.get("orchestrationTrace")
            if orchestration_trace:
                rationale_obj = orchestration_trace.get("rationale")
                if rationale_obj and "text" in rationale_obj:
                    rationale_text = rationale_obj["text"]
                    print(f"DEBUG: Found rationale text: {rationale_text}")
                    data = {
                        "statusCode": 200,
                        "type": "thinking",
                        "text": rationale_text
                    }
                    gateway.post_to_connection(
                        ConnectionId=connection_id,
                        Data=json.dumps(data)
                    )
                else:
                    print("DEBUG: No rationale text in rationale_obj.")
            else:
                print("DEBUG: orchestrationTrace key not found in trace object.")

        else:
            # Possibly something else, log it
            print(f"DEBUG: Unhandled event => {event_chunk}")

    # After the stream loop ends
    final_text = "".join(final_text_chunks).strip()
    if final_text:
        data = {
            "statusCode": 200,
            "type": "final_text",
            "text": final_text
        }
        gateway.post_to_connection(
            ConnectionId=connection_id,
            Data=json.dumps(data)
        )

    if returned_files:
        data = {
            "statusCode": 200,
            "type": "files",
            "files": returned_files
        }
        gateway.post_to_connection(
            ConnectionId=connection_id,
            Data=json.dumps(data)
        )

    return {
        'statusCode': 200,
        'body': json.dumps({'result': 'Streaming complete'})
    }
