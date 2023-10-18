import * as cdk from 'aws-cdk-lib';
import { Construct } from 'constructs';
import { Vpc } from 'aws-cdk-lib/aws-ec2';

export class SolutionStack extends cdk.Stack {
  private vpc: Vpc;

  constructor(scope: Construct, id: string, props?: cdk.StackProps) {
    super(scope, id, props);

    this.vpc = new Vpc (this, 'card-auth');
  }
}
