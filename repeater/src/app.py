import json
import time
import urllib.request
import json

def lambda_handler(event, context):

    req = urllib.request.Request(
        url='https://fs4mfkm0pa.execute-api.us-west-2.amazonaws.com/Prod/send/',
        headers={'Accept': 'application/json'},
        method='GET')
    
    while True:
        res = urllib.request.urlopen(req, timeout=5)
        print("Status: ", res.status)
        print("Reason: ", res.reason)
        response = json.loads(res.read())
        print("Response: ", response)
        time.sleep(1)
    