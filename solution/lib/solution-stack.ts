import { Stack, StackProps, CfnOutput } from 'aws-cdk-lib';
import { Construct } from 'constructs';
import { Port, Peer, SecurityGroup, Vpc } from 'aws-cdk-lib/aws-ec2';
import { Topic } from 'aws-cdk-lib/aws-sns';
import { Queue, IQueue } from 'aws-cdk-lib/aws-sqs';
import { aws_elasticache as ElastiCache } from 'aws-cdk-lib';
import { SqsSubscription, EmailSubscription } from 'aws-cdk-lib/aws-sns-subscriptions';
import { Alarm } from 'aws-cdk-lib/aws-cloudwatch';
import { StringParameter } from 'aws-cdk-lib/aws-ssm';
import { SSMParameterReader } from './ssm-parameter-reader';
import { Effect, PolicyStatement, ServicePrincipal } from 'aws-cdk-lib/aws-iam';

export class SolutionStack extends Stack {
  private vpc: Vpc;
  private topic: Topic;
  private sqs: Queue;
  private securityGroup: SecurityGroup;

  private createVpc() {
    this.vpc = new Vpc (this, 'cache');
  }

  private createSns(topicName: string) {
    return new Topic(this, topicName)
  }

  private createDLQ() {
    return new Queue (this, 'DLQ');
  }

  private createSqs(dlq: Queue) {
    this.sqs = new Queue (this, 'Queue', {
      deadLetterQueue: {
        queue: dlq,
        maxReceiveCount: 1
      }
    });
  }

  private subscribeSqsToSns(queue: IQueue, dlq: Queue) {
    this.topic.addSubscription(new SqsSubscription(queue, {
      deadLetterQueue: dlq
    }));
  }

  private createElastiCache(stackName: string) {
    const groupName = stackName + "ElastiCacheSubnetGroup";
    const securityGroupName = stackName + "ElastiCacheSecurityGroup";

    const subnetIds = [];
    for (const subnet of this.vpc.privateSubnets) {
      subnetIds.push(subnet.subnetId)
    }


    const subnetGroup = new ElastiCache.CfnSubnetGroup(this, "ElastiCacheSubnetGroup", {
      cacheSubnetGroupName: groupName,
      subnetIds: subnetIds,
      description: "ElastiCache Subnet Group"
    })

    this.securityGroup = new SecurityGroup(this, securityGroupName, {
      vpc: this.vpc,
      allowAllOutbound: true,
      description: "ElastiCache Security Group",
      securityGroupName: securityGroupName
    });

    this.securityGroup.addIngressRule(Peer.anyIpv4(), Port.tcp(6379), "Redis port");

    console.log ("createElasticCache securityGroup: ", this.securityGroup);

    new ElastiCache.CfnReplicationGroup(this, "ReplicationGroup", {
      replicationGroupDescription: "Elastic Cache Replication Group",
      numCacheClusters: 1,
      automaticFailoverEnabled: false,
      engine: 'redis',
      cacheNodeType: 'cache.m7g.large',
      cacheSubnetGroupName: subnetGroup.ref,
      securityGroupIds:[this.securityGroup.securityGroupId],
    });

  }

  private exportPrivateSubnet(name: string) {
    const subnetOutput = new CfnOutput(this, name, {
      value: this.vpc.privateSubnets[0].subnetId,
      exportName: name
    });
  }

  private defineOutput() {
    this.exportPrivateSubnet('CardAuthPrivateSubnet1');

    const securityGroupOutput = new CfnOutput(this, 'SecurityGroupId', {
      exportName: 'SecurityGroupId',
      value: this.securityGroup.securityGroupId
    });

    new CfnOutput(this, 'CardAuthQueueARN', {
      exportName: 'CardAuthQueueARN',
      value: this.sqs.queueArn
    });

    new CfnOutput(this, 'SQS', {
      exportName: 'SQS',
      value: this.sqs.queueArn
    })

  }

  private createDLQAlarm (dlq: Queue) {
      const alarm = new Alarm(this, 'DLQAlarm', {
        metric: dlq.metricApproximateNumberOfMessagesVisible(),
        threshold: 1,
        evaluationPeriods: 1,
      })
  }

  private createEmailSubscription(topic: Topic) {
    topic.addSubscription(new EmailSubscription('epatro+cache@gmail.com'));
  }

  private defineParameters(stackName: String) {
    new StringParameter(this, 'SQSParameter', {
      parameterName: stackName + 'SQS',
      description: 'The SQS ARN',
      stringValue: this.sqs.queueArn
    });
  }

  private retrieveSecondarySqsArn() {
    const reader = new SSMParameterReader(this, 'SecondarySQS', {
      parameterName: 'SecondarySQS',
      region: 'us-east-2'
    })
    const arn = reader.getParameterValue();
    console.log ("retrieveSecondarySqsArn arn: ", arn);
    return arn;
  }

  private addSqsResourcePolicy() {
    const policy = new PolicyStatement(
      {
        effect: Effect.ALLOW,
        actions: ["sqs:SendMessage"],
        principals: [new ServicePrincipal('sns.amazonaws.com')],
        resources: [this.sqs.queueArn],
        conditions: {
          "ArnEquals": {
            "aws:SourceArn": "arn:aws:sns:us-west-2:464940127111:Primary-Message251322C6-WSvpVni84A4S"
          }
        }
      }
    )
    this.sqs.addToResourcePolicy(policy);

  }

constructor(scope: Construct, id: string, props?: StackProps) {
    super(scope, id, props);

    var stackName = 'Unknown';
    if (props && props.stackName) {
      stackName = props.stackName;
    }
    console.log ("Stack name: ", stackName);

    this.createVpc();
    const dlq = this.createDLQ();
    this.createDLQAlarm(dlq);
    const alarmTopic = this.createSns('AlarmTopic');
    this.createEmailSubscription(alarmTopic);
    this.createSqs(dlq);
    this.addSqsResourcePolicy();

    console.log ("createVpc stackName: ", stackName);
    if (stackName == 'Primary') {
      this.topic = this.createSns('Message');
      this.subscribeSqsToSns(this.sqs, dlq);
      const secondarySqsArn = this.retrieveSecondarySqsArn();

      const secondaryQueue = Queue.fromQueueArn(this, 'SecondaryQueue', secondarySqsArn);
      this.subscribeSqsToSns(secondaryQueue, dlq);

    } else {
      console.log ("Skipping SNS creation");
    }

    this.createElastiCache(stackName);
    this.defineOutput();
    this.defineParameters(stackName);
  }
}
