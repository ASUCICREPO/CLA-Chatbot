#!/usr/bin/env bash
set -euo pipefail

# --------------------------------------------------
# 1. Prompt for all required values
# --------------------------------------------------

# 1) If GITHUB_URL isn’t already set, prompt for it
if [ -z "${GITHUB_URL:-}" ]; then
  read -rp "Enter the GitHub repository URL, preferably after forking the repository to your enviorment (e.g. format, https://github.com/GITHUB_OWNER/GITHUB_REPO): " GITHUB_URL
fi

# 2) Same for PROJECT_NAME
if [ -z "${PROJECT_NAME:-}" ]; then
  read -rp "Enter the CodeBuild project name (e.g. test123 ): " PROJECT_NAME
fi

# 3) And for each CDK context var…
if [ -z "${GITHUB_TOKEN:-}" ]; then
  read -rp "Enter CDK context githubToken (Please check out the documentation for how to obtain githubToken): " GITHUB_TOKEN
fi

if [ -z "${GITHUB_OWNER:-}" ]; then
  read -rp "Enter CDK context githubOwner: (https://github.com/GITHUB_OWNER/GITHUB_REPO) :  " GITHUB_OWNER
fi

if [ -z "${GITHUB_REPO:-}" ]; then
  read -rp "Enter CDK context githubRepo: (https://github.com/GITHUB_OWNER/GITHUB_REPO) :  " GITHUB_REPO
fi

# --------------------------------------------------
# 2. Ensure IAM service role exists
# --------------------------------------------------

ROLE_NAME="${PROJECT_NAME}-service-role"
echo "Checking for IAM role: $ROLE_NAME"

if aws iam get-role --role-name "$ROLE_NAME" >/dev/null 2>&1; then
  echo "✓ IAM role exists"
  ROLE_ARN=$(aws iam get-role --role-name "$ROLE_NAME" --query 'Role.Arn' --output text)
else
  echo "✱ Creating IAM role: $ROLE_NAME"
  TRUST_DOC='{
    "Version":"2012-10-17",
    "Statement":[{
      "Effect":"Allow",
      "Principal":{"Service":"codebuild.amazonaws.com"},
      "Action":"sts:AssumeRole"
    }]
  }'

  ROLE_ARN=$(aws iam create-role \
    --role-name "$ROLE_NAME" \
    --assume-role-policy-document "$TRUST_DOC" \
    --query 'Role.Arn' --output text)

  echo "Attaching AdministratorAccess policy..."
  aws iam attach-role-policy \
    --role-name "$ROLE_NAME" \
    --policy-arn arn:aws:iam::aws:policy/AdministratorAccess

  # Wait for propagation
  echo "Waiting for IAM role to propagate..."
  sleep 5
  echo "✓ IAM role created"
fi

# --------------------------------------------------
# 3. Create CodeBuild project
# --------------------------------------------------

echo "Creating CodeBuild project: $PROJECT_NAME"

# --------------------------------------------------
# Build environment with explicit environmentVariables
# --------------------------------------------------
ENVIRONMENT='{
  "type": "LINUX_CONTAINER",
  "image": "aws/codebuild/amazonlinux-x86_64-standard:5.0",
  "computeType": "BUILD_GENERAL1_SMALL",
  "environmentVariables": [
    {
      "name":  "GITHUB_TOKEN",
      "value": "'"$GITHUB_TOKEN"'",
      "type":  "PLAINTEXT"
    },
    {
      "name":  "GITHUB_OWNER",
      "value": "'"$GITHUB_OWNER"'",
      "type":  "PLAINTEXT"
    },
    {
      "name":  "GITHUB_REPO",
      "value": "'"$GITHUB_REPO"'",
      "type":  "PLAINTEXT"
    }
  ]
}'

# No artifacts
ARTIFACTS='{"type":"NO_ARTIFACTS"}'

# Source from GitHub
SOURCE='{"type":"GITHUB","location":"'"$GITHUB_URL"'"}'

# Which branch to build

echo "Creating CodeBuild project '$PROJECT_NAME' using GitHub repo '$GITHUB_URL' ..."
aws codebuild create-project \
  --name "$PROJECT_NAME" \
  --source "$SOURCE" \
  --artifacts "$ARTIFACTS" \
  --environment "$ENVIRONMENT" \
  --service-role "$ROLE_ARN" \
  --output json \
  --no-cli-pager

if [ $? -eq 0 ]; then
  echo "✓ CodeBuild project '$PROJECT_NAME' created successfully."
else
  echo "✗ Failed to create CodeBuild project. Please verify AWS CLI permissions and parameters."
  exit 1
fi

# --------------------------------------------------
# 4. Start the build
# --------------------------------------------------

echo "Starting build for project '$PROJECT_NAME'..."
aws codebuild start-build \
  --project-name "$PROJECT_NAME" \
  --no-cli-pager \
  --output json

if [ $? -eq 0 ]; then
  echo "✓ Build started successfully."
else
  echo "✗ Failed to start the build."
  exit 1
fi

# --------------------------------------------------
# 5. List existing CodeBuild projects
# --------------------------------------------------

echo "Current CodeBuild projects:"
aws codebuild list-projects --output table

# --------------------------------------------------
# End of script
# --------------------------------------------------
exit 0