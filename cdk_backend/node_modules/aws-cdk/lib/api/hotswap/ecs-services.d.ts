import { type ChangeHotswapResult, type HotswappableChangeCandidate, HotswapPropertyOverrides } from './common';
import type { EvaluateCloudFormationTemplate } from '../evaluate-cloudformation-template';
export declare function isHotswappableEcsServiceChange(logicalId: string, change: HotswappableChangeCandidate, evaluateCfnTemplate: EvaluateCloudFormationTemplate, hotswapPropertyOverrides: HotswapPropertyOverrides): Promise<ChangeHotswapResult>;
