"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.SSMParameterReader = void 0;
const custom_resources_1 = require("aws-cdk-lib/custom-resources");
const aws_cdk_lib_1 = require("aws-cdk-lib");
class SSMParameterReader extends custom_resources_1.AwsCustomResource {
    constructor(scope, name, props) {
        const { parameterName, region } = props;
        const ssmAwsSdkCall = {
            service: 'SSM',
            action: 'getParameter',
            parameters: {
                Name: parameterName
            },
            region,
            physicalResourceId: custom_resources_1.PhysicalResourceId.of(Date.now().toString())
        };
        const ssmCrPolicy = custom_resources_1.AwsCustomResourcePolicy.fromSdkCalls({
            resources: [
                aws_cdk_lib_1.Arn.format({
                    service: 'ssm',
                    region: props.region,
                    resource: 'parameter',
                    resourceName: parameterName,
                }, aws_cdk_lib_1.Stack.of(scope)),
            ],
        });
        super(scope, name, { onUpdate: ssmAwsSdkCall, policy: ssmCrPolicy });
    }
    getParameterValue() {
        return this.getResponseField('Parameter.Value').toString();
    }
}
exports.SSMParameterReader = SSMParameterReader;
//# sourceMappingURL=data:application/json;base64,eyJ2ZXJzaW9uIjozLCJmaWxlIjoic3NtLXBhcmFtZXRlci1yZWFkZXIuanMiLCJzb3VyY2VSb290IjoiIiwic291cmNlcyI6WyJzc20tcGFyYW1ldGVyLXJlYWRlci50cyJdLCJuYW1lcyI6W10sIm1hcHBpbmdzIjoiOzs7QUFDQSxtRUFBMEg7QUFDMUgsNkNBQXlDO0FBT3pDLE1BQWEsa0JBQW1CLFNBQVEsb0NBQWlCO0lBQ3ZELFlBQVksS0FBZ0IsRUFBRSxJQUFZLEVBQUUsS0FBOEI7UUFDeEUsTUFBTSxFQUFFLGFBQWEsRUFBRSxNQUFNLEVBQUUsR0FBRyxLQUFLLENBQUM7UUFFeEMsTUFBTSxhQUFhLEdBQWU7WUFDaEMsT0FBTyxFQUFFLEtBQUs7WUFDZCxNQUFNLEVBQUUsY0FBYztZQUN0QixVQUFVLEVBQUU7Z0JBQ1YsSUFBSSxFQUFFLGFBQWE7YUFDcEI7WUFDRCxNQUFNO1lBQ04sa0JBQWtCLEVBQUUscUNBQWtCLENBQUMsRUFBRSxDQUFDLElBQUksQ0FBQyxHQUFHLEVBQUUsQ0FBQyxRQUFRLEVBQUUsQ0FBQztTQUNqRSxDQUFDO1FBRUYsTUFBTSxXQUFXLEdBQUcsMENBQXVCLENBQUMsWUFBWSxDQUFDO1lBQ3JELFNBQVMsRUFBRTtnQkFDVCxpQkFBRyxDQUFDLE1BQU0sQ0FDUjtvQkFDRSxPQUFPLEVBQUUsS0FBSztvQkFDZCxNQUFNLEVBQUUsS0FBSyxDQUFDLE1BQU07b0JBQ3BCLFFBQVEsRUFBRSxXQUFXO29CQUNyQixZQUFZLEVBQUUsYUFBYTtpQkFDNUIsRUFDRCxtQkFBSyxDQUFDLEVBQUUsQ0FBQyxLQUFLLENBQUMsQ0FDaEI7YUFDRjtTQUNGLENBQUMsQ0FBQztRQUVMLEtBQUssQ0FBQyxLQUFLLEVBQUUsSUFBSSxFQUFFLEVBQUUsUUFBUSxFQUFFLGFBQWEsRUFBRSxNQUFNLEVBQUUsV0FBVyxFQUFFLENBQUMsQ0FBQztJQUN2RSxDQUFDO0lBRU0saUJBQWlCO1FBQ3RCLE9BQU8sSUFBSSxDQUFDLGdCQUFnQixDQUFDLGlCQUFpQixDQUFDLENBQUMsUUFBUSxFQUFFLENBQUM7SUFDN0QsQ0FBQztDQUNGO0FBbENELGdEQWtDQyIsInNvdXJjZXNDb250ZW50IjpbImltcG9ydCB7IENvbnN0cnVjdCB9IGZyb20gJ2NvbnN0cnVjdHMnO1xuaW1wb3J0IHsgQXdzQ3VzdG9tUmVzb3VyY2UsIEF3c0N1c3RvbVJlc291cmNlUG9saWN5LCBBd3NTZGtDYWxsLCBQaHlzaWNhbFJlc291cmNlSWQgfSBmcm9tICdhd3MtY2RrLWxpYi9jdXN0b20tcmVzb3VyY2VzJztcbmltcG9ydCB7IEFybiwgU3RhY2sgfSBmcm9tICdhd3MtY2RrLWxpYic7XG5cbmludGVyZmFjZSBTU01QYXJhbWV0ZXJSZWFkZXJQcm9wcyB7XG4gIHBhcmFtZXRlck5hbWU6IHN0cmluZztcbiAgcmVnaW9uOiBzdHJpbmc7XG59XG5cbmV4cG9ydCBjbGFzcyBTU01QYXJhbWV0ZXJSZWFkZXIgZXh0ZW5kcyBBd3NDdXN0b21SZXNvdXJjZSB7XG4gIGNvbnN0cnVjdG9yKHNjb3BlOiBDb25zdHJ1Y3QsIG5hbWU6IHN0cmluZywgcHJvcHM6IFNTTVBhcmFtZXRlclJlYWRlclByb3BzKSB7XG4gICAgY29uc3QgeyBwYXJhbWV0ZXJOYW1lLCByZWdpb24gfSA9IHByb3BzO1xuXG4gICAgY29uc3Qgc3NtQXdzU2RrQ2FsbDogQXdzU2RrQ2FsbCA9IHtcbiAgICAgIHNlcnZpY2U6ICdTU00nLFxuICAgICAgYWN0aW9uOiAnZ2V0UGFyYW1ldGVyJyxcbiAgICAgIHBhcmFtZXRlcnM6IHtcbiAgICAgICAgTmFtZTogcGFyYW1ldGVyTmFtZVxuICAgICAgfSxcbiAgICAgIHJlZ2lvbixcbiAgICAgIHBoeXNpY2FsUmVzb3VyY2VJZDogUGh5c2ljYWxSZXNvdXJjZUlkLm9mKERhdGUubm93KCkudG9TdHJpbmcoKSlcbiAgICB9O1xuXG4gICAgY29uc3Qgc3NtQ3JQb2xpY3kgPSBBd3NDdXN0b21SZXNvdXJjZVBvbGljeS5mcm9tU2RrQ2FsbHMoe1xuICAgICAgICByZXNvdXJjZXM6IFtcbiAgICAgICAgICBBcm4uZm9ybWF0KFxuICAgICAgICAgICAge1xuICAgICAgICAgICAgICBzZXJ2aWNlOiAnc3NtJyxcbiAgICAgICAgICAgICAgcmVnaW9uOiBwcm9wcy5yZWdpb24sXG4gICAgICAgICAgICAgIHJlc291cmNlOiAncGFyYW1ldGVyJyxcbiAgICAgICAgICAgICAgcmVzb3VyY2VOYW1lOiBwYXJhbWV0ZXJOYW1lLFxuICAgICAgICAgICAgfSxcbiAgICAgICAgICAgIFN0YWNrLm9mKHNjb3BlKSxcbiAgICAgICAgICApLFxuICAgICAgICBdLFxuICAgICAgfSk7XG5cbiAgICBzdXBlcihzY29wZSwgbmFtZSwgeyBvblVwZGF0ZTogc3NtQXdzU2RrQ2FsbCwgcG9saWN5OiBzc21DclBvbGljeSB9KTtcbiAgfVxuXG4gIHB1YmxpYyBnZXRQYXJhbWV0ZXJWYWx1ZSgpOiBzdHJpbmcge1xuICAgIHJldHVybiB0aGlzLmdldFJlc3BvbnNlRmllbGQoJ1BhcmFtZXRlci5WYWx1ZScpLnRvU3RyaW5nKCk7XG4gIH1cbn0iXX0=