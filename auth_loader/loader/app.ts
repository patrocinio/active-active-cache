import { APIGatewayProxyEvent, APIGatewayProxyResult } from 'aws-lambda';

import { SNSClient, PublishCommand } from "@aws-sdk/client-sns";

/**
 *
 * Event doc: https://docs.aws.amazon.com/apigateway/latest/developerguide/set-up-lambda-proxy-integrations.html#api-gateway-simple-proxy-for-lambda-input-format
 * @param {Object} event - API Gateway Lambda Proxy Input Format
 *
 * Return doc: https://docs.aws.amazon.com/apigateway/latest/developerguide/set-up-lambda-proxy-integrations.html
 * @returns {Object} object - API Gateway Lambda Proxy Output Format
 *
 */

export const snsClient = new SNSClient({});

async function publishMessage() {
    const command = new PublishCommand({
        Message: "Hello from SNS!",
        TopicArn: "arn:aws:sns:us-west-2:464940127111:SolutionStack-AuthorizationAE2C3694-OsbBIw6oLaf0",
        MessageAttributes: {
            "Account": {
                DataType: "String",
                StringValue: "1"
            },
            "Data": {
                DataType: "String",
                StringValue: Date.now().toString()
            }
        }
    });

    const response = await snsClient.send(command);
    console.log ("publishMessage Response: ", response);

    return response;
}

export const lambdaHandler = async (event: APIGatewayProxyEvent): Promise<APIGatewayProxyResult> => {
    try {
        const response = await publishMessage();

        return {
            statusCode: 200,
            body: JSON.stringify({
                message: response,
            }),
        };
    } catch (err) {
        console.log(err);
        return {
            statusCode: 500,
            body: JSON.stringify({
                message: 'some error happened',
            }),
        };
    }
};
