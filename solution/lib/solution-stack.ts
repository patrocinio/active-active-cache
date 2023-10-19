import * as cdk from 'aws-cdk-lib';
import { Construct } from 'constructs';
import { Vpc } from 'aws-cdk-lib/aws-ec2';
import * as Sns from 'aws-cdk-lib/aws-sns';

export class SolutionStack extends cdk.Stack {
  private vpc: Vpc;
  private topic: Sns.Topic;

  private createVpc() {
    this.vpc = new Vpc (this, 'card-auth');
  }

  private createSns() {
    this.topic = new Sns.Topic(this, 'Authorization')
  }

  constructor(scope: Construct, id: string, props?: cdk.StackProps) {
    super(scope, id, props);
    this.createVpc();
    this.createSns();
  }
}
