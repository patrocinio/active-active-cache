import { APIGatewayProxyEvent, APIGatewayProxyResult, SQSEvent } from 'aws-lambda';

import { createClient } from 'redis';

/**
 *
 * Event doc: https://docs.aws.amazon.com/apigateway/latest/developerguide/set-up-lambda-proxy-integrations.html#api-gateway-simple-proxy-for-lambda-input-format
 * @param {Object} event - API Gateway Lambda Proxy Input Format
 *
 * Return doc: https://docs.aws.amazon.com/apigateway/latest/developerguide/set-up-lambda-proxy-integrations.html
 * @returns {Object} object - API Gateway Lambda Proxy Output Format
 *
 */

async function publishMessage(account: string, data: string) {
    console.log ("publishMessage account: ", account, " data: ", data);

    const client = await createClient({
        url: "redis://sor17be9bvaug2r0.oht2jg.ng.0001.usw2.cache.amazonaws.com:6379"
    })
      .on('error', err => console.log('Redis Client Error', err))
    .connect();

    await client.set(account, data);
    const value = await client.get('key');
    await client.disconnect();

    return value;
}

export const apiHandler = async (event: APIGatewayProxyEvent): Promise<APIGatewayProxyResult> => {
    try {
        const response = await publishMessage("0", Date.now().toString());

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

export const queueHandler = async (event: SQSEvent): Promise<void> => {
    try {
        for (const message of event.Records) {
            const body = JSON.parse(message.body);

            const attributes = body.MessageAttributes;

            console.log ("queueHandler attributes: ", attributes)
            console.log ("queueHandler attributes type: ", typeof attributes)

            await publishMessage(attributes.Account.Value, attributes.Data.Value)
        }
    } catch (err) {
        console.log(err);
    }
};
