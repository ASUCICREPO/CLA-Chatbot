import { LoadBalancerContextQuery, LoadBalancerListenerContextQuery } from '@aws-cdk/cloud-assembly-schema';
import { LoadBalancerContextResponse, LoadBalancerListenerContextResponse } from '@aws-cdk/cx-api';
import { type SdkProvider } from '../api/aws-auth/sdk-provider';
import { ContextProviderPlugin } from '../api/plugin';
/**
 * Provides load balancer context information.
 */
export declare class LoadBalancerContextProviderPlugin implements ContextProviderPlugin {
    private readonly aws;
    constructor(aws: SdkProvider);
    getValue(query: LoadBalancerContextQuery): Promise<LoadBalancerContextResponse>;
}
/**
 * Provides load balancer listener context information
 */
export declare class LoadBalancerListenerContextProviderPlugin implements ContextProviderPlugin {
    private readonly aws;
    constructor(aws: SdkProvider);
    getValue(query: LoadBalancerListenerContextQuery): Promise<LoadBalancerListenerContextResponse>;
}
