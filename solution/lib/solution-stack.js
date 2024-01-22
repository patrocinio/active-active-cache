"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.SolutionStack = void 0;
const aws_cdk_lib_1 = require("aws-cdk-lib");
const aws_ec2_1 = require("aws-cdk-lib/aws-ec2");
const aws_sns_1 = require("aws-cdk-lib/aws-sns");
const aws_sqs_1 = require("aws-cdk-lib/aws-sqs");
const aws_elasticache_1 = require("aws-cdk-lib/aws-elasticache");
const aws_sns_subscriptions_1 = require("aws-cdk-lib/aws-sns-subscriptions");
const aws_cloudwatch_1 = require("aws-cdk-lib/aws-cloudwatch");
const aws_ssm_1 = require("aws-cdk-lib/aws-ssm");
const ssm_parameter_reader_1 = require("./ssm-parameter-reader");
const aws_cloudwatch_2 = require("aws-cdk-lib/aws-cloudwatch");
class SolutionStack extends aws_cdk_lib_1.Stack {
    createVpc() {
        this.vpc = new aws_ec2_1.Vpc(this, 'cache');
    }
    createSns(topicName) {
        return new aws_sns_1.Topic(this, topicName);
    }
    createDLQ() {
        return new aws_sqs_1.Queue(this, 'DLQ');
    }
    createSqs(dlq) {
        this.sqs = new aws_sqs_1.Queue(this, 'Queue', {
            deadLetterQueue: {
                queue: dlq,
                maxReceiveCount: 1
            }
        });
    }
    subscribeSqsToSns(queue, dlq) {
        this.topic.addSubscription(new aws_sns_subscriptions_1.SqsSubscription(queue, {
            deadLetterQueue: dlq
        }));
    }
    createElastiCache(stackName) {
        const groupName = stackName + "ElastiCacheSubnetGroup";
        const securityGroupName = stackName + "ElastiCacheSecurityGroup";
        const subnetIds = [];
        for (const subnet of this.vpc.privateSubnets) {
            console.log("createElastiCache subnet ID: ", subnet.subnetId);
            subnetIds.push(subnet.subnetId);
        }
        const subnetGroup = new aws_elasticache_1.CfnSubnetGroup(this, "ElastiCacheSubnetGroup", {
            cacheSubnetGroupName: groupName,
            subnetIds: subnetIds,
            description: "ElastiCache Subnet Group"
        });
        this.securityGroup = new aws_ec2_1.SecurityGroup(this, securityGroupName, {
            vpc: this.vpc,
            allowAllOutbound: true,
            description: "ElastiCache Security Group",
            securityGroupName: securityGroupName
        });
        this.securityGroup.addIngressRule(aws_ec2_1.Peer.anyIpv4(), aws_ec2_1.Port.tcp(6379), "Redis port");
        console.log("createElasticCache securityGroup: ", this.securityGroup);
        this.elastiCache = new aws_elasticache_1.CfnReplicationGroup(this, "ReplicationGroup", {
            replicationGroupDescription: "Elastic Cache Replication Group",
            numCacheClusters: 1,
            automaticFailoverEnabled: false,
            engine: 'redis',
            cacheNodeType: 'cache.m7g.large',
            cacheSubnetGroupName: subnetGroup.ref,
            securityGroupIds: [this.securityGroup.securityGroupId],
        });
    }
    exportPrivateSubnet(name) {
        const subnetOutput = new aws_cdk_lib_1.CfnOutput(this, name, {
            value: this.vpc.privateSubnets[0].subnetId,
            exportName: name
        });
    }
    defineOutput() {
        this.exportPrivateSubnet('CardAuthPrivateSubnet1');
        const securityGroupOutput = new aws_cdk_lib_1.CfnOutput(this, 'SecurityGroupId', {
            exportName: 'SecurityGroupId',
            value: this.securityGroup.securityGroupId
        });
        new aws_cdk_lib_1.CfnOutput(this, 'QueueARN', {
            exportName: 'QueueARN',
            value: this.sqs.queueArn
        });
        new aws_cdk_lib_1.CfnOutput(this, 'QueueURL', {
            exportName: 'QueueURL',
            value: this.sqs.queueUrl
        });
    }
    createDLQAlarm(dlq) {
        const alarm = new aws_cloudwatch_1.Alarm(this, 'DLQAlarm', {
            metric: dlq.metricApproximateNumberOfMessagesVisible(),
            threshold: 1,
            evaluationPeriods: 1,
        });
    }
    defineParameters(stackName) {
        new aws_ssm_1.StringParameter(this, 'SQSParameter', {
            parameterName: stackName + 'SQS',
            description: 'The SQS ARN',
            stringValue: this.sqs.queueArn
        });
    }
    retrieveSecondarySqsArn() {
        const reader = new ssm_parameter_reader_1.SSMParameterReader(this, 'SecondarySQS', {
            parameterName: 'SecondarySQS',
            region: 'us-east-2'
        });
        const arn = reader.getParameterValue();
        console.log("retrieveSecondarySqsArn arn: ", arn);
        return arn;
    }
    defineSNSParameter() {
        new aws_ssm_1.StringParameter(this, 'SNSParameter', {
            parameterName: 'SNS',
            description: 'The SNS ARN',
            stringValue: this.topic.topicArn
        });
    }
    retrieveSNSArn() {
        const reader = new ssm_parameter_reader_1.SSMParameterReader(this, 'SNS', {
            parameterName: 'SNS',
            region: 'us-west-2'
        });
        const arn = reader.getParameterValue();
        console.log("retrieveSNSArn arn: ", arn);
        return arn;
    }
    addMetric(region, statistic) {
        return new aws_cloudwatch_2.Metric({
            region: region,
            namespace: "Cacher",
            metricName: "Cacher/Delay",
            statistic: statistic,
            dimensionsMap: {
                "Delay": "Delay"
            }
        });
    }
    createDashboard() {
        const dashboard = new aws_cloudwatch_2.Dashboard(this, 'Dash', {
            defaultInterval: aws_cdk_lib_1.Duration.hours(1),
        });
        dashboard.addWidgets(new aws_cloudwatch_2.GraphWidget({
            title: "Cache Delay",
            left: [
                this.addMetric("us-east-2", "Average"),
                this.addMetric("us-west-2", "Average"),
                this.addMetric("us-east-2", "p99"),
                this.addMetric("us-west-2", "p99")
            ]
        }));
    }
    ;
    createUser() {
    }
    constructor(scope, id, props) {
        super(scope, id, props);
        var stackName = 'Unknown';
        if (props && props.stackName) {
            stackName = props.stackName;
        }
        console.log("Stack name: ", stackName);
        this.createVpc();
        const dlq = this.createDLQ();
        this.createDLQAlarm(dlq);
        this.createSqs(dlq);
        const snsArn = this.retrieveSNSArn();
        console.log("snsArn: ", snsArn);
        console.log("createVpc stackName: ", stackName);
        if (stackName == 'Primary') {
            this.topic = this.createSns('Message');
            this.subscribeSqsToSns(this.sqs, dlq);
            const secondarySqsArn = this.retrieveSecondarySqsArn();
            const secondaryQueue = aws_sqs_1.Queue.fromQueueArn(this, 'SecondaryQueue', secondarySqsArn);
            this.subscribeSqsToSns(secondaryQueue, dlq);
            this.defineSNSParameter();
            this.createDashboard();
            new aws_cdk_lib_1.CfnOutput(this, 'TopicARN', {
                exportName: 'TopicARN',
                value: this.topic.topicArn
            });
        }
        else {
            console.log("Skipping SNS creation");
        }
        this.createElastiCache(stackName);
        this.createUser();
        this.defineOutput();
        this.defineParameters(stackName);
    }
}
exports.SolutionStack = SolutionStack;
//# sourceMappingURL=data:application/json;base64,eyJ2ZXJzaW9uIjozLCJmaWxlIjoic29sdXRpb24tc3RhY2suanMiLCJzb3VyY2VSb290IjoiIiwic291cmNlcyI6WyJzb2x1dGlvbi1zdGFjay50cyJdLCJuYW1lcyI6W10sIm1hcHBpbmdzIjoiOzs7QUFBQSw2Q0FBcUU7QUFFckUsaURBQXFFO0FBQ3JFLGlEQUE0QztBQUM1QyxpREFBb0Q7QUFDcEQsaUVBQWtGO0FBQ2xGLDZFQUFvRTtBQUNwRSwrREFBbUQ7QUFDbkQsaURBQXNEO0FBQ3RELGlFQUE0RDtBQUM1RCwrREFBNEU7QUFFNUUsTUFBYSxhQUFjLFNBQVEsbUJBQUs7SUFPOUIsU0FBUztRQUNmLElBQUksQ0FBQyxHQUFHLEdBQUcsSUFBSSxhQUFHLENBQUUsSUFBSSxFQUFFLE9BQU8sQ0FBQyxDQUFDO0lBQ3JDLENBQUM7SUFFTyxTQUFTLENBQUMsU0FBaUI7UUFDakMsT0FBTyxJQUFJLGVBQUssQ0FBQyxJQUFJLEVBQUUsU0FBUyxDQUFDLENBQUE7SUFDbkMsQ0FBQztJQUVPLFNBQVM7UUFDZixPQUFPLElBQUksZUFBSyxDQUFFLElBQUksRUFBRSxLQUFLLENBQUMsQ0FBQztJQUNqQyxDQUFDO0lBRU8sU0FBUyxDQUFDLEdBQVU7UUFDMUIsSUFBSSxDQUFDLEdBQUcsR0FBRyxJQUFJLGVBQUssQ0FBRSxJQUFJLEVBQUUsT0FBTyxFQUFFO1lBQ25DLGVBQWUsRUFBRTtnQkFDZixLQUFLLEVBQUUsR0FBRztnQkFDVixlQUFlLEVBQUUsQ0FBQzthQUNuQjtTQUNGLENBQUMsQ0FBQztJQUNMLENBQUM7SUFFTyxpQkFBaUIsQ0FBQyxLQUFhLEVBQUUsR0FBVTtRQUNqRCxJQUFJLENBQUMsS0FBSyxDQUFDLGVBQWUsQ0FBQyxJQUFJLHVDQUFlLENBQUMsS0FBSyxFQUFFO1lBQ3BELGVBQWUsRUFBRSxHQUFHO1NBQ3JCLENBQUMsQ0FBQyxDQUFDO0lBQ04sQ0FBQztJQUVPLGlCQUFpQixDQUFDLFNBQWlCO1FBQ3pDLE1BQU0sU0FBUyxHQUFHLFNBQVMsR0FBRyx3QkFBd0IsQ0FBQztRQUN2RCxN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dUJBQXVCLENBQUMsQ0FBQztTQUN2QztRQUVELElBQUksQ0FBQyxpQkFBaUIsQ0FBQyxTQUFTLENBQUMsQ0FBQztRQUNsQyxJQUFJLENBQUMsVUFBVSxFQUFFLENBQUM7UUFDbEIsSUFBSSxDQUFDLFlBQVksRUFBRSxDQUFDO1FBQ3BCLElBQUksQ0FBQyxnQkFBZ0IsQ0FBQyxTQUFTLENBQUMsQ0FBQztJQUNuQyxDQUFDO0NBQ0Y7QUE3TkQsc0NBNk5DIiwic291cmNlc0NvbnRlbnQiOlsiaW1wb3J0IHsgU3RhY2ssIFN0YWNrUHJvcHMsIENmbk91dHB1dCwgRHVyYXRpb24gfSBmcm9tICdhd3MtY2RrLWxpYic7XG5pbXBvcnQgeyBDb25zdHJ1Y3QgfSBmcm9tICdjb25zdHJ1Y3RzJztcbmltcG9ydCB7IFBvcnQsIFBlZXIsIFNlY3VyaXR5R3JvdXAsIFZwYyB9IGZyb20gJ2F3cy1jZGstbGliL2F3cy1lYzInO1xuaW1wb3J0IHsgVG9waWMgfSBmcm9tICdhd3MtY2RrLWxpYi9hd3Mtc25zJztcbmltcG9ydCB7IFF1ZXVlLCBJUXVldWUgfSBmcm9tICdhd3MtY2RrLWxpYi9hd3Mtc3FzJztcbmltcG9ydCB7IENmblJlcGxpY2F0aW9uR3JvdXAsIENmblN1Ym5ldEdyb3VwIH0gZnJvbSAnYXdzLWNkay1saWIvYXdzLWVsYXN0aWNhY2hlJztcbmltcG9ydCB7IFNxc1N1YnNjcmlwdGlvbiB9IGZyb20gJ2F3cy1jZGstbGliL2F3cy1zbnMtc3Vic2NyaXB0aW9ucyc7XG5pbXBvcnQgeyBBbGFybSB9IGZyb20gJ2F3cy1jZGstbGliL2F3cy1jbG91ZHdhdGNoJztcbmltcG9ydCB7IFN0cmluZ1BhcmFtZXRlciB9IGZyb20gJ2F3cy1jZGstbGliL2F3cy1zc20nO1xuaW1wb3J0IHsgU1NNUGFyYW1ldGVyUmVhZGVyIH0gZnJvbSAnLi9zc20tcGFyYW1ldGVyLXJlYWRlcic7XG5pbXBvcnQgeyBEYXNoYm9hcmQsIEdyYXBoV2lkZ2V0LCBNZXRyaWMgfSBmcm9tICdhd3MtY2RrLWxpYi9hd3MtY2xvdWR3YXRjaCc7XG5cbmV4cG9ydCBjbGFzcyBTb2x1dGlvblN0YWNrIGV4dGVuZHMgU3RhY2sge1xuICBwcml2YXRlIHZwYzogVnBjO1xuICBwcml2YXRlIHRvcGljOiBUb3BpYztcbiAgcHJpdmF0ZSBzcXM6IFF1ZXVlO1xuICBwcml2YXRlIHNlY3VyaXR5R3JvdXA6IFNlY3VyaXR5R3JvdXA7XG4gIHByaXZhdGUgZWxhc3RpQ2FjaGU6IENmblJlcGxpY2F0aW9uR3JvdXA7XG5cbiAgcHJpdmF0ZSBjcmVhdGVWcGMoKSB7XG4gICAgdGhpcy52cGMgPSBuZXcgVnBjICh0aGlzLCAnY2FjaGUnKTtcbiAgfVxuXG4gIHByaXZhdGUgY3JlYXRlU25zKHRvcGljTmFtZTogc3RyaW5nKSB7XG4gICAgcmV0dXJuIG5ldyBUb3BpYyh0aGlzLCB0b3BpY05hbWUpXG4gIH1cblxuICBwcml2YXRlIGNyZWF0ZURMUSgpIHtcbiAgICByZXR1cm4gbmV3IFF1ZXVlICh0aGlzLCAnRExRJyk7XG4gIH1cblxuICBwcml2YXRlIGNyZWF0ZVNxcyhkbHE6IFF1ZXVlKSB7XG4gICAgdGhpcy5zcXMgPSBuZXcgUXVldWUgKHRoaXMsICdRdWV1ZScsIHtcbiAgICAgIGRlYWRMZXR0ZXJRdWV1ZToge1xuICAgICAgICBxdWV1ZTogZGxxLFxuICAgICAgICBtYXhSZWNlaXZlQ291bnQ6IDFcbiAgICAgIH1cbiAgICB9KTtcbiAgfVxuXG4gIHByaXZhdGUgc3Vic2NyaWJlU3FzVG9TbnMocXVldWU6IElRdWV1ZSwgZGxxOiBRdWV1ZSkge1xuICAgIHRoaXMudG9waWMuYWRkU3Vic2NyaXB0aW9uKG5ldyBTcXNTdWJzY3JpcHRpb24ocXVldWUsIHtcbiAgICAgIGRlYWRMZXR0ZXJRdWV1ZTogZGxxXG4gICAgfSkpO1xuICB9XG5cbiAgcHJpdmF0ZSBjcmVhdGVFbGFzdGlDYWNoZShzdGFja05hbWU6IHN0cmluZykge1xuICAgIGNvbnN0IGdyb3VwTmFtZSA9IHN0YWNrTmFtZSArIFwiRWxhc3RpQ2FjaGVTdWJuZXRHcm91cFwiO1xuICAgIGNvbnN0IHNlY3VyaXR5R3JvdXBOYW1lID0gc3RhY2tOYW1lICsgXCJFbGFzdGlDYWNoZVNlY3VyaXR5R3JvdXBcIjtcblxuICAgIGNvbnN0IHN1Ym5ldElkcyA9IFtdO1xuICAgIGZvciAoY29uc3Qgc3VibmV0IG9mIHRoaXMudnBjLnByaXZhdGVTdWJuZXRzKSB7XG4gICAgICBjb25zb2xlLmxvZyAoXCJjcmVhdGVFbGFzdGlDYWNoZSBzdWJuZXQgSUQ6IFwiLCBzdWJuZXQuc3VibmV0SWQpO1xuICAgICAgc3VibmV0SWRzLnB1c2goc3VibmV0LnN1Ym5ldElkKTtcbiAgICB9XG5cbiAgICBjb25zdCBzdWJuZXRHcm91cCA9IG5ldyBDZm5TdWJuZXRHcm91cCh0aGlzLCBcIkVsYXN0aUNhY2hlU3VibmV0R3JvdXBcIiwge1xuICAgICAgY2FjaGVTdWJuZXRHcm91cE5hbWU6IGdyb3VwTmFtZSxcbiAgICAgIHN1Ym5ldElkczogc3VibmV0SWRzLFxuICAgICAgZGVzY3JpcHRpb246IFwiRWxhc3RpQ2FjaGUgU3VibmV0IEdyb3VwXCJcbiAgICB9KVxuXG4gICAgdGhpcy5zZWN1cml0eUdyb3VwID0gbmV3IFNlY3VyaXR5R3JvdXAodGhpcywgc2VjdXJpdHlHcm91cE5hbWUsIHtcbiAgICAgIHZwYzogdGhpcy52cGMsXG4gICAgICBhbGxvd0FsbE91dGJvdW5kOiB0cnVlLFxuICAgICAgZGVzY3JpcHRpb246IFwiRWxhc3RpQ2FjaGUgU2VjdXJpdHkgR3JvdXBcIixcbiAgICAgIHNlY3VyaXR5R3JvdXBOYW1lOiBzZWN1cml0eUdyb3VwTmFtZVxuICAgIH0pO1xuXG4gICAgdGhpcy5zZWN1cml0eUdyb3VwLmFkZEluZ3Jlc3NSdWxlKFBlZXIuYW55SXB2NCgpLCBQb3J0LnRjcCg2Mzc5KSwgXCJSZWRpcyBwb3J0XCIpO1xuXG4gICAgY29uc29sZS5sb2cgKFwiY3JlYXRlRWxhc3RpY0NhY2hlIHNlY3VyaXR5R3JvdXA6IFwiLCB0aGlzLnNlY3VyaXR5R3JvdXApO1xuXG4gICAgdGhpcy5lbGFzdGlDYWNoZSA9IG5ldyBDZm5SZXBsaWNhdGlvbkdyb3VwKHRoaXMsIFwiUmVwbGljYXRpb25Hcm91cFwiLCB7XG4gICAgICByZXBsaWNhdGlvbkdyb3VwRGVzY3JpcHRpb246IFwiRWxhc3RpYyBDYWNoZSBSZXBsaWNhdGlvbiBHcm91cFwiLFxuICAgICAgbnVtQ2FjaGVDbHVzdGVyczogMSxcbiAgICAgIGF1dG9tYXRpY0ZhaWxvdmVyRW5hYmxlZDogZmFsc2UsXG4gICAgICBlbmdpbmU6ICdyZWRpcycsXG4gICAgICBjYWNoZU5vZGVUeXBlOiAnY2FjaGUubTdnLmxhcmdlJyxcbiAgICAgIGNhY2hlU3VibmV0R3JvdXBOYW1lOiBzdWJuZXRHcm91cC5yZWYsXG4gICAgICBzZWN1cml0eUdyb3VwSWRzOlt0aGlzLnNlY3VyaXR5R3JvdXAuc2VjdXJpdHlHcm91cElkXSxcbiAgICB9KTtcblxuICB9XG5cbiAgcHJpdmF0ZSBleHBvcnRQcml2YXRlU3VibmV0KG5hbWU6IHN0cmluZykge1xuICAgIGNvbnN0IHN1Ym5ldE91dHB1dCA9IG5ldyBDZm5PdXRwdXQodGhpcywgbmFtZSwge1xuICAgICAgdmFsdWU6IHRoaXMudnBjLnByaXZhdGVTdWJuZXRzWzBdLnN1Ym5ldElkLFxuICAgICAgZXhwb3J0TmFtZTogbmFtZVxuICAgIH0pO1xuICB9XG5cbiAgcHJpdmF0ZSBkZWZpbmVPdXRwdXQoKSB7XG4gICAgdGhpcy5leHBvcnRQcml2YXRlU3VibmV0KCdDYXJkQXV0aFByaXZhdGVTdWJuZXQxJyk7XG5cbiAgICBjb25zdCBzZWN1cml0eUdyb3VwT3V0cHV0ID0gbmV3IENmbk91dHB1dCh0aGlzLCAnU2VjdXJpdHlHcm91cElkJywge1xuICAgICAgZXhwb3J0TmFtZTogJ1NlY3VyaXR5R3JvdXBJZCcsXG4gICAgICB2YWx1ZTogdGhpcy5zZWN1cml0eUdyb3VwLnNlY3VyaXR5R3JvdXBJZFxuICAgIH0pO1xuXG4gICAgbmV3IENmbk91dHB1dCh0aGlzLCAnUXVldWVBUk4nLCB7XG4gICAgICBleHBvcnROYW1lOiAnUXVldWVBUk4nLFxuICAgICAgdmFsdWU6IHRoaXMuc3FzLnF1ZXVlQXJuXG4gICAgfSk7XG5cbiAgICBuZXcgQ2ZuT3V0cHV0KHRoaXMsICdRdWV1ZVVSTCcsIHtcbiAgICAgIGV4cG9ydE5hbWU6ICdRdWV1ZVVSTCcsXG4gICAgICB2YWx1ZTogdGhpcy5zcXMucXVldWVVcmxcbiAgICB9KTtcblxuICB9XG5cbiAgcHJpdmF0ZSBjcmVhdGVETFFBbGFybSAoZGxxOiBRdWV1ZSkge1xuICAgICAgY29uc3QgYWxhcm0gPSBuZXcgQWxhcm0odGhpcywgJ0RMUUFsYXJtJywge1xuICAgICAgICBtZXRyaWM6IGRscS5tZXRyaWNBcHByb3hpbWF0ZU51bWJlck9mTWVzc2FnZXNWaXNpYmxlKCksXG4gICAgICAgIHRocmVzaG9sZDogMSxcbiAgICAgICAgZXZhbHVhdGlvblBlcmlvZHM6IDEsXG4gICAgICB9KVxuICB9XG5cbiAgcHJpdmF0ZSBkZWZpbmVQYXJhbWV0ZXJzKHN0YWNrTmFtZTogU3RyaW5nKSB7XG4gICAgbmV3IFN0cmluZ1BhcmFtZXRlcih0aGlzLCAnU1FTUGFyYW1ldGVyJywge1xuICAgICAgcGFyYW1ldGVyTmFtZTogc3RhY2tOYW1lICsgJ1NRUycsXG4gICAgICBkZXNjcmlwdGlvbjogJ1RoZSBTUVMgQVJOJyxcbiAgICAgIHN0cmluZ1ZhbHVlOiB0aGlzLnNxcy5xdWV1ZUFyblxuICAgIH0pO1xuICB9XG5cbiAgcHJpdmF0ZSByZXRyaWV2ZVNlY29uZGFyeVNxc0FybigpIHtcbiAgICBjb25zdCByZWFkZXIgPSBuZXcgU1NNUGFyYW1ldGVyUmVhZGVyKHRoaXMsICdTZWNvbmRhcnlTUVMnLCB7XG4gICAgICBwYXJhbWV0ZXJOYW1lOiAnU2Vjb25kYXJ5U1FTJyxcbiAgICAgIHJlZ2lvbjogJ3VzLWVhc3QtMidcbiAgICB9KVxuICAgIGNvbnN0IGFybiA9IHJlYWRlci5nZXRQYXJhbWV0ZXJWYWx1ZSgpO1xuICAgIGNvbnNvbGUubG9nIChcInJldHJpZXZlU2Vjb25kYXJ5U3FzQXJuIGFybjogXCIsIGFybik7XG4gICAgcmV0dXJuIGFybjtcbiAgfVxuXG4gIHByaXZhdGUgZGVmaW5lU05TUGFyYW1ldGVyKCkge1xuICAgIG5ldyBTdHJpbmdQYXJhbWV0ZXIodGhpcywgJ1NOU1BhcmFtZXRlcicsIHtcbiAgICAgIHBhcmFtZXRlck5hbWU6ICdTTlMnLFxuICAgICAgZGVzY3JpcHRpb246ICdUaGUgU05TIEFSTicsXG4gICAgICBzdHJpbmdWYWx1ZTogdGhpcy50b3BpYy50b3BpY0FyblxuICAgIH0pO1xuICB9XG5cbiAgcHJpdmF0ZSByZXRyaWV2ZVNOU0FybigpIHtcbiAgICBjb25zdCByZWFkZXIgPSBuZXcgU1NNUGFyYW1ldGVyUmVhZGVyKHRoaXMsICdTTlMnLCB7XG4gICAgICBwYXJhbWV0ZXJOYW1lOiAnU05TJyxcbiAgICAgIHJlZ2lvbjogJ3VzLXdlc3QtMidcbiAgICB9KVxuICAgIGNvbnN0IGFybiA9IHJlYWRlci5nZXRQYXJhbWV0ZXJWYWx1ZSgpO1xuICAgIGNvbnNvbGUubG9nIChcInJldHJpZXZlU05TQXJuIGFybjogXCIsIGFybik7XG4gICAgcmV0dXJuIGFybjtcbiAgfVxuXG4gIHByaXZhdGUgYWRkTWV0cmljKHJlZ2lvbjogc3RyaW5nLCBzdGF0aXN0aWM6IHN0cmluZykge1xuICAgIHJldHVybiBuZXcgTWV0cmljKHtcbiAgICAgIHJlZ2lvbjogcmVnaW9uLFxuICAgICAgbmFtZXNwYWNlOiBcIkNhY2hlclwiLFxuICAgICAgbWV0cmljTmFtZTogXCJDYWNoZXIvRGVsYXlcIixcbiAgICAgIHN0YXRpc3RpYzogc3RhdGlzdGljLFxuICAgICAgZGltZW5zaW9uc01hcDoge1xuICAgICAgICBcIkRlbGF5XCI6IFwiRGVsYXlcIlxuICAgICAgfVxuICAgIH0pXG4gIH1cblxuICBwcml2YXRlIGNyZWF0ZURhc2hib2FyZCgpIHtcbiAgICBjb25zdCBkYXNoYm9hcmQgPSBuZXcgRGFzaGJvYXJkKHRoaXMsICdEYXNoJywge1xuICAgICAgZGVmYXVsdEludGVydmFsOiBEdXJhdGlvbi5ob3VycygxKSxcbiAgICB9KTtcblxuICAgIGRhc2hib2FyZC5hZGRXaWRnZXRzKG5ldyBHcmFwaFdpZGdldCh7XG4gICAgICB0aXRsZTogXCJDYWNoZSBEZWxheVwiLFxuICAgICAgbGVmdDogW1xuICAgICAgICB0aGlzLmFkZE1ldHJpYyhcInVzLWVhc3QtMlwiLCBcIkF2ZXJhZ2VcIiksXG4gICAgICAgIHRoaXMuYWRkTWV0cmljKFwidXMtd2VzdC0yXCIsIFwiQXZlcmFnZVwiKSxcbiAgICAgICAgdGhpcy5hZGRNZXRyaWMoXCJ1cy1lYXN0LTJcIiwgXCJwOTlcIiksXG4gICAgICAgIHRoaXMuYWRkTWV0cmljKFwidXMtd2VzdC0yXCIsIFwicDk5XCIpXG4gICAgICBdXG4gICAgfSkpO1xuICB9O1xuXG4gIHByaXZhdGUgY3JlYXRlVXNlcigpIHtcblxuICB9XG5cblxuXG5jb25zdHJ1Y3RvcihzY29wZTogQ29uc3RydWN0LCBpZDogc3RyaW5nLCBwcm9wcz86IFN0YWNrUHJvcHMpIHtcbiAgICBzdXBlcihzY29wZSwgaWQsIHByb3BzKTtcblxuICAgIHZhciBzdGFja05hbWUgPSAnVW5rbm93bic7XG4gICAgaWYgKHByb3BzICYmIHByb3BzLnN0YWNrTmFtZSkge1xuICAgICAgc3RhY2tOYW1lID0gcHJvcHMuc3RhY2tOYW1lO1xuICAgIH1cbiAgICBjb25zb2xlLmxvZyAoXCJTdGFjayBuYW1lOiBcIiwgc3RhY2tOYW1lKTtcblxuICAgIHRoaXMuY3JlYXRlVnBjKCk7XG4gICAgY29uc3QgZGxxID0gdGhpcy5jcmVhdGVETFEoKTtcbiAgICB0aGlzLmNyZWF0ZURMUUFsYXJtKGRscSk7XG4gICAgdGhpcy5jcmVhdGVTcXMoZGxxKTtcbiAgICBcbiAgICBjb25zdCBzbnNBcm4gPSB0aGlzLnJldHJpZXZlU05TQXJuKCk7XG4gICAgY29uc29sZS5sb2cgKFwic25zQXJuOiBcIiwgc25zQXJuKTtcbiAgICBcbiAgICBjb25zb2xlLmxvZyAoXCJjcmVhdGVWcGMgc3RhY2tOYW1lOiBcIiwgc3RhY2tOYW1lKTtcbiAgICBpZiAoc3RhY2tOYW1lID09ICdQcmltYXJ5Jykge1xuICAgICAgdGhpcy50b3BpYyA9IHRoaXMuY3JlYXRlU25zKCdNZXNzYWdlJyk7XG4gICAgICB0aGlzLnN1YnNjcmliZVNxc1RvU25zKHRoaXMuc3FzLCBkbHEpO1xuICAgICAgY29uc3Qgc2Vjb25kYXJ5U3FzQXJuID0gdGhpcy5yZXRyaWV2ZVNlY29uZGFyeVNxc0FybigpO1xuXG4gICAgICBjb25zdCBzZWNvbmRhcnlRdWV1ZSA9IFF1ZXVlLmZyb21RdWV1ZUFybih0aGlzLCAnU2Vjb25kYXJ5UXVldWUnLCBzZWNvbmRhcnlTcXNBcm4pO1xuICAgICAgdGhpcy5zdWJzY3JpYmVTcXNUb1NucyhzZWNvbmRhcnlRdWV1ZSwgZGxxKTtcbiAgICAgIHRoaXMuZGVmaW5lU05TUGFyYW1ldGVyKCk7XG4gICAgICB0aGlzLmNyZWF0ZURhc2hib2FyZCgpO1xuXG4gICAgICBuZXcgQ2ZuT3V0cHV0KHRoaXMsICdUb3BpY0FSTicsIHtcbiAgICAgICAgZXhwb3J0TmFtZTogJ1RvcGljQVJOJyxcbiAgICAgICAgdmFsdWU6IHRoaXMudG9waWMudG9waWNBcm5cbiAgICAgIH0pXG4gIFxuXG4gICAgfSBlbHNlIHtcbiAgICAgIGNvbnNvbGUubG9nIChcIlNraXBwaW5nIFNOUyBjcmVhdGlvblwiKTtcbiAgICB9XG5cbiAgICB0aGlzLmNyZWF0ZUVsYXN0aUNhY2hlKHN0YWNrTmFtZSk7XG4gICAgdGhpcy5jcmVhdGVVc2VyKCk7XG4gICAgdGhpcy5kZWZpbmVPdXRwdXQoKTtcbiAgICB0aGlzLmRlZmluZVBhcmFtZXRlcnMoc3RhY2tOYW1lKTtcbiAgfVxufVxuIl19