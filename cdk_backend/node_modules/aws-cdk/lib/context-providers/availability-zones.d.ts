import type { AvailabilityZonesContextQuery } from '@aws-cdk/cloud-assembly-schema';
import { type SdkProvider } from '../api/aws-auth/sdk-provider';
import { ContextProviderPlugin } from '../api/plugin';
/**
 * Plugin to retrieve the Availability Zones for the current account
 */
export declare class AZContextProviderPlugin implements ContextProviderPlugin {
    private readonly aws;
    constructor(aws: SdkProvider);
    getValue(args: AvailabilityZonesContextQuery): Promise<(string | undefined)[]>;
}
