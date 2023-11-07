import * as cdk from 'aws-cdk-lib';
import { Construct } from 'constructs';
import * as EC2 from 'aws-cdk-lib/aws-ec2';
import * as Sns from 'aws-cdk-lib/aws-sns';
import * as Sqs from 'aws-cdk-lib/aws-sqs';
import { aws_elasticache as ElastiCache } from 'aws-cdk-lib';
import * as SnsSubscription from 'aws-cdk-lib/aws-sns-subscriptions';
import * as cloudwatch from 'aws-cdk-lib/aws-cloudwatch';

export class SolutionStack extends cdk.Stack {
  private vpc: EC2.Vpc;
  private topic: Sns.Topic;
  private sqs: Sqs.Queue;
  private cache: ElastiCache.CfnReplicationGroup;
  private securityGroup: EC2.SecurityGroup;
//  private cache: ElastiCache.CfnCacheCluster;

  private createVpc() {
    this.vpc = new EC2.Vpc (this, 'cache');
  }

  private createSns() {
    this.topic = new Sns.Topic(this, 'Message')
  }

  private createDLQ() {
    return new Sqs.Queue (this, 'DLQ');
  }

  private createSqs(dlq: Sqs.Queue) {
    this.sqs = new Sqs.Queue (this, 'Same Region Queue', {
      deadLetterQueue: {
        queue: dlq,
        maxReceiveCount: 1
      }
    });
  }

  private subscribeToSns(dlq: Sqs.Queue) {
    this.topic.addSubscription(new SnsSubscription.SqsSubscription(this.sqs, {
      deadLetterQueue: dlq
    }));
  }

  private createElastiCache() {
    const groupName = "ElastiCacheSubnetGroup";
    const securityGroupName = "ElastiCacheSecurityGroup";

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

    this.cache = new ElastiCache.CfnReplicationGroup(this, "ReplicationGroup", {
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
    })

    const replicationGroup = this.cache.replicationGroupDescription;

    console.log ("defineOutput replication group: ", replicationGroup);
    /*
    const redisURL = new cdk.CfnOutput(this, 'RedisURL', {
      exportName: 'CardAuthRedisURL',
      value: this.cache
    })
    */

  }

  private createDLQAlarm (dlq: Sqs.Queue) {
      const alarm = new cloudwatch.Alarm(this, 'DLQAlarm', {
        metric: dlq.metricNumberOfMessagesReceived(),
        threshold: 1,
        evaluationPeriods: 1,
      })
  }

constructor(scope: Construct, id: string, props?: cdk.StackProps) {
    super(scope, id, props);
    this.createVpc();
    this.createSns();
    const dlq = this.createDLQ();
    this.createDLQAlarm(dlq);
    this.createSqs(dlq);
    this.subscribeToSns(dlq);
    this.createElastiCache();
    this.defineOutput();
  }
}
