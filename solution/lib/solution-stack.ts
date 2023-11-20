import * as cdk from 'aws-cdk-lib';
import { Construct } from 'constructs';
import * as EC2 from 'aws-cdk-lib/aws-ec2';
import * as Sns from 'aws-cdk-lib/aws-sns';
import * as Sqs from 'aws-cdk-lib/aws-sqs';
import { aws_elasticache as ElastiCache } from 'aws-cdk-lib';
import * as SnsSubscription from 'aws-cdk-lib/aws-sns-subscriptions';
import * as cloudwatch from 'aws-cdk-lib/aws-cloudwatch';
import { StringParameter } from 'aws-cdk-lib/aws-ssm';
import { SSMParameterReader } from './ssm-parameter-reader';

export class SolutionStack extends cdk.Stack {
  private vpc: EC2.Vpc;
  private topic: Sns.Topic;
  private sqs: Sqs.Queue;
  private securityGroup: EC2.SecurityGroup;

  private createVpc() {
    this.vpc = new EC2.Vpc (this, 'cache');
  }

  private createSns(topicName: string) {
    return new Sns.Topic(this, topicName)
  }

  private createDLQ() {
    return new Sqs.Queue (this, 'DLQ');
  }

  private createSqs(dlq: Sqs.Queue) {
    this.sqs = new Sqs.Queue (this, 'Queue', {
      deadLetterQueue: {
        queue: dlq,
        maxReceiveCount: 1
      }
    });
  }

  private subscribeSqsToSns(queue: Sqs.IQueue, dlq: Sqs.Queue) {
    this.topic.addSubscription(new SnsSubscription.SqsSubscription(queue, {
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

    this.securityGroup = new EC2.SecurityGroup(this, securityGroupName, {
      vpc: this.vpc,
      allowAllOutbound: true,
      description: "ElastiCache Security Group",
      securityGroupName: securityGroupName
    });

    this.securityGroup.addIngressRule(EC2.Peer.anyIpv4(), EC2.Port.tcp(6379), "Redis port");

    console.log ("createElasticCache securityGroup: ", this.securityGroup);

    /*
    this.cache = new ElastiCache.CfnCacheCluster(this, "CacheCluster", {
      cacheNodeType: 'cache.m7g.large',
      engine: 'redis',
      numCacheNodes: 1,
      cacheSubnetGroupName: subnetGroup.ref,
      vpcSecurityGroupIds:[securityGroup.securityGroupId],
    });
    */

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
    const subnetOutput = new cdk.CfnOutput(this, name, {
      value: this.vpc.privateSubnets[0].subnetId,
      exportName: name
    });
  }

  private defineOutput() {
    this.exportPrivateSubnet('CardAuthPrivateSubnet1');

    const securityGroupOutput = new cdk.CfnOutput(this, 'SecurityGroupId', {
      exportName: 'SecurityGroupId',
      value: this.securityGroup.securityGroupId
    });

    new cdk.CfnOutput(this, 'CardAuthQueueARN', {
      exportName: 'CardAuthQueueARN',
      value: this.sqs.queueArn
    });

    new cdk.CfnOutput(this, 'SQS', {
      exportName: 'SQS',
      value: this.sqs.queueArn
    })

  }

  private createDLQAlarm (dlq: Sqs.Queue) {
      const alarm = new cloudwatch.Alarm(this, 'DLQAlarm', {
        metric: dlq.metricApproximateNumberOfMessagesVisible(),
        threshold: 1,
        evaluationPeriods: 1,
      })
  }

  private createEmailSubscription(topic: Sns.Topic) {
    topic.addSubscription(new SnsSubscription.EmailSubscription('epatro+cache@gmail.com'));
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

constructor(scope: Construct, id: string, props?: cdk.StackProps) {
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

    console.log ("createVpc stackName: ", stackName);
    if (stackName == 'Primary') {
      this.topic = this.createSns('Message');
      this.subscribeSqsToSns(this.sqs, dlq);
      const secondarySqsArn = this.retrieveSecondarySqsArn();

      const secondaryQueue = Sqs.Queue.fromQueueArn(this, 'SecondaryQueue', secondarySqsArn);
      this.subscribeSqsToSns(secondaryQueue, dlq);

    } else {
      console.log ("Skipping SNS creation");
    }

    this.createElastiCache(stackName);
    this.defineOutput();
    this.defineParameters(stackName);
  }
}
