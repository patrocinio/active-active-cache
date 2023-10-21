import * as cdk from 'aws-cdk-lib';
import { Construct } from 'constructs';
import { Vpc } from 'aws-cdk-lib/aws-ec2';
import * as Sns from 'aws-cdk-lib/aws-sns';
import * as Sqs from 'aws-cdk-lib/aws-sqs';
import { aws_elasticache as ElastiCache } from 'aws-cdk-lib';
import * as SnsSubscription from 'aws-cdk-lib/aws-sns-subscriptions';

export class SolutionStack extends cdk.Stack {
  private vpc: Vpc;
  private topic: Sns.Topic;
  private sqs: Sqs.Queue;
  private cache: ElastiCache.CfnCacheCluster;

  private createVpc() {
    this.vpc = new Vpc (this, 'card-auth');
  }

  private createSns() {
    this.topic = new Sns.Topic(this, 'Authorization')
  }

  private createSqs() {
    this.sqs = new Sqs.Queue (this, 'Same Region Queue');
  }

  private subscribeToSns() {
    this.topic.addSubscription(new SnsSubscription.SqsSubscription(this.sqs));
  }

  private createElastiCache() {
    const groupName = "ElastiCacheGroupName";

    const subnetGroup = new ElastiCache.CfnSubnetGroup(this, "ElastiCacheSubnetGroup", {
      cacheSubnetGroupName: groupName,
      subnetIds: ["subnet-09dc13d737832aa95"],
      description: "ElastiCache Subnet Group"
    })

    this.cache = new ElastiCache.CfnCacheCluster (this, "ElastiCache", {
      cacheNodeType: 'cache.t2.small',
      engine: 'redis',
      numCacheNodes: 1,
      cacheSecurityGroupNames: ['default'],
    });
  }

  constructor(scope: Construct, id: string, props?: cdk.StackProps) {
    super(scope, id, props);
    this.createVpc();
    this.createSns();
    this.createSqs();
    this.subscribeToSns();
    this.createElastiCache();
  }
}
