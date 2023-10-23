import * as cdk from 'aws-cdk-lib';
import { Construct } from 'constructs';
import * as EC2 from 'aws-cdk-lib/aws-ec2';
import * as Sns from 'aws-cdk-lib/aws-sns';
import * as Sqs from 'aws-cdk-lib/aws-sqs';
import { aws_elasticache as ElastiCache } from 'aws-cdk-lib';
import * as SnsSubscription from 'aws-cdk-lib/aws-sns-subscriptions';

export class SolutionStack extends cdk.Stack {
  private vpc: EC2.Vpc;
  private topic: Sns.Topic;
  private sqs: Sqs.Queue;
  private cache: ElastiCache.CfnReplicationGroup;

  private createVpc() {
    this.vpc = new EC2.Vpc (this, 'card-auth');
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
    const groupName = "ElastiCacheSubnetGroup";
    const securityGroupName = "ElastiCacheSecurityGroup";

    const subnetGroup = new ElastiCache.CfnSubnetGroup(this, "ElastiCacheSubnetGroup", {
      cacheSubnetGroupName: groupName,
      subnetIds: ["subnet-0cf2262ab7be597f5", "subnet-08fe11dcd51909f11"],
      description: "ElastiCache Subnet Group"
    })

    const securityGroup = new EC2.SecurityGroup(this, securityGroupName, {
      vpc: this.vpc,
      allowAllOutbound: true,
      description: "ElastiCache Security Group",
      securityGroupName: securityGroupName
    });
    securityGroup.addIngressRule(EC2.Peer.anyIpv4(), EC2.Port.tcp(6379), "Redis port");

    console.log ("createElasticCache securityGroup: ", securityGroup);

    /*
    this.cache = new ElastiCache.CfnCacheCluster (this, "ElastiCache", {
      cacheNodeType: 'cache.t2.small',
      engine: 'redis',
      numCacheNodes: 1,
      vpcSecurityGroupIds: [securityGroup.securityGroupId],
      cacheSubnetGroupName: subnetGroup.ref
    });*/

    this.cache = new ElastiCache.CfnReplicationGroup(this, "ReplicationGroup", {
      replicationGroupDescription: "Elastic Cache Replication Group",
      numCacheClusters: 1,
      automaticFailoverEnabled: false,
      engine: 'redis',
      cacheNodeType: 'cache.t2.small',
      cacheSubnetGroupName: subnetGroup.ref,
      securityGroupIds:[securityGroup.securityGroupId],
    });

  }

  constructor(scope: Construct, id: string, props?: cdk.StackProps) {
    super(scope, id, props);
    this.createVpc();
//    this.createSns();
//    this.createSqs();
//    this.subscribeToSns();
    this.createElastiCache();
  }
}
