all:
	echo Specify which command

arch:
	cd architecture; java -jar plantuml-1.2023.11.jar Architecture.puml

auth_load_test:
	ab -n 1000 $(AUTH_URL)

bootstrap:
	cd solution; cdk bootstrap

build:
	cd solution; npm run build

cacher_build: 
	cd cacher; sam build

cacher_delete: 
	cd cacher; sam delete --no-prompts

cacher_delete_secondary:
	cd cacher; sam delete --no-prompts --region us-east-2

cacher_deploy: cacher_deploy_primary cacher_deploy_secondary

cacher_deploy_primary: set_region_us_west_2 find_redis_url cacher_build
	cd cacher; sam deploy --parameter-overrides RedisURL=$(REDIS_ADDRESS) --region us-west-2

cacher_deploy_secondary: set_region_us_east_2 find_redis_url cacher_build
	cd cacher; sam deploy --parameter-overrides RedisURL=$(REDIS_ADDRESS) --region us-east-2

GET_CACHER_ID=$(shell aws apigateway get-rest-apis --output json | jq '.items[] | select (.name == "cacher").id')
SET_CACHER_ID = $(eval CACHER_ID=$(GET_CACHER_ID))

cacher_save: get_region
	$(SET_CACHER_ID)
	echo Cacher ID: $(CACHER_ID)
	curl https://$(CACHER_ID).execute-api.$(REGION).amazonaws.com/Prod/save

delete:
	aws cloudformation delete-stack --stack-name SolutionStack

destroy: cacher_delete query_delete loader_delete
	cd solution; cdk destroy --require-approval never


GET_QUERY_URL = $(shell aws cloudformation describe-stacks --stack-name ecquery --output json | jq .Stacks[0].Outputs[0].OutputValue)
SET_QUERY_URL = $(eval QUERY_URL=$(GET_QUERY_URL))

find_query_url: set_region_us_west_2
	$(SET_QUERY_URL)
	@echo Query URL: $(QUERY_URL)

GET_REDIS_ADDRESS = $(shell aws elasticache describe-cache-clusters \
	  --show-cache-node-info --output json | jq .CacheClusters[0].CacheNodes[0].Endpoint.Address)
SET_REDIS_ADDRESS = $(eval REDIS_ADDRESS=redis://$(GET_REDIS_ADDRESS):6379)

find_redis_url:
	  $(SET_REDIS_ADDRESS)
	  echo Redis: $(REDIS_ADDRESS)

GET_AUTH_ID=$(shell aws apigateway get-rest-apis --output json | jq '.items[] | select (.name == "auth-loader").id')
SET_AUTH_URL = $(eval AUTH_URL=https://$(GET_AUTH_ID).execute-api.$(REGION).amazonaws.com/Prod/)

get_auth_url: get_region
	$(SET_AUTH_URL)
	echo Auth ID: $(AUTH_URL)

GET_REGION=$(shell aws configure list | grep region | awk '{print $$2}')
SET_REGION=$(eval REGION=$(GET_REGION))

get_region:
	$(SET_REGION)
	echo Region: $(REGION)

init:
	cd solution; cdk init app --language=typescript

loader_build: 
	cd auth_loader; sam build

loader_delete:
	cd auth_loader; sam delete --no-prompts

loader_deploy: set_region_us_west_2 loader_build 
	cd auth_loader; sam deploy

query_build:
	cd elasticache_query; sam build

query_delete:
	cd elasticache_query; sam delete --no-prompts

query_deploy: query_build find_redis_url
	cd elasticache_query; sam deploy --parameter-overrides RedisURL=$(REDIS_ADDRESS)

repeat_auth: get_auth_url
	curl $(AUTH_URL)/repeat

repeater_build: 
	cd repeater; sam build

repeater_delete:
	cd repeater; sam delete --no-prompts

repeater_deploy: set_region_us_west_2 repeater_build 
	cd repeater; sam deploy



run_query: set_region_us_west_2 find_query_url
	curl $(QUERY_URL)

send_auth: get_auth_url
	curl $(AUTH_URL)/send

set_region_us_east_2:
	aws configure set default.region us-east-2
	
set_region_us_west_2:
	aws configure set default.region us-west-2
	
solution_deploy: bootstrap synth
	cd solution; cdk deploy --require-approval never --all

solution_deploy_primary: bootstrap synth
	cd solution; cdk deploy --require-approval never PrimarySolutionStack

solution_deploy_secondary: bootstrap synth
	cd solution; cdk deploy --require-approval never SecondarySolutionStack

synth:
	cd solution; cdk synth

