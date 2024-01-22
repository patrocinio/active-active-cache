import { Stack, StackProps } from 'aws-cdk-lib';
import { Construct } from 'constructs';
export declare class SolutionStack extends Stack {
    private vpc;
    private topic;
    private sqs;
    private securityGroup;
    private elastiCache;
    private createVpc;
    private createSns;
    private createDLQ;
    private createSqs;
    private subscribeSqsToSns;
    private createElastiCache;
    private exportPrivateSubnet;
    private defineOutput;
    private createDLQAlarm;
    private defineParameters;
    private retrieveSecondarySqsArn;
    private defineSNSParameter;
    private retrieveSNSArn;
    private addMetric;
    private createDashboard;
    private createUser;
    constructor(scope: Construct, id: string, props?: StackProps);
}
