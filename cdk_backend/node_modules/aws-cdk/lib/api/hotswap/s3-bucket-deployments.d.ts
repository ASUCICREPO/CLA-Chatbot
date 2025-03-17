import type { ChangeHotswapResult, HotswappableChangeCandidate } from './common';
import type { EvaluateCloudFormationTemplate } from '../evaluate-cloudformation-template';
/**
 * This means that the value is required to exist by CloudFormation's Custom Resource API (or our S3 Bucket Deployment Lambda's API)
 * but the actual value specified is irrelevant
 */
export declare const REQUIRED_BY_CFN = "required-to-be-present-by-cfn";
export declare function isHotswappableS3BucketDeploymentChange(_logicalId: string, change: HotswappableChangeCandidate, evaluateCfnTemplate: EvaluateCloudFormationTemplate): Promise<ChangeHotswapResult>;
export declare function skipChangeForS3DeployCustomResourcePolicy(iamPolicyLogicalId: string, change: HotswappableChangeCandidate, evaluateCfnTemplate: EvaluateCloudFormationTemplate): Promise<boolean>;
