import { Construct } from 'constructs';
import { AwsCustomResource } from 'aws-cdk-lib/custom-resources';
interface SSMParameterReaderProps {
    parameterName: string;
    region: string;
}
export declare class SSMParameterReader extends AwsCustomResource {
    constructor(scope: Construct, name: string, props: SSMParameterReaderProps);
    getParameterValue(): string;
}
export {};
