import { type ChangeHotswapResult, type HotswappableChangeCandidate } from './common';
import type { EvaluateCloudFormationTemplate } from '../evaluate-cloudformation-template';
export declare function isHotswappableCodeBuildProjectChange(logicalId: string, change: HotswappableChangeCandidate, evaluateCfnTemplate: EvaluateCloudFormationTemplate): Promise<ChangeHotswapResult>;
