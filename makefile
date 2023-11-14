all:
	echo Specify which command

arch:
	cd architecture; java -jar plantuml-1.2023.11.jar Architecture.puml

bootstrap:
	cd solution; cdk bootstrap

build:
	cd solution; npm run build

cacher_build: 
	cd cacher; sam build

cacher_delete:
	cd cacher; sam delete --no-prompts

cacher_deploy: cacher_deploy_primary cacher_deploy_secondary

cacher_deploy_primary: set_region_us_west_2 cacher_build find_redis_url
	cd cacher; sam deploy --parameter-overrides RedisURL=$(REDIS_ADDRESS) --region us-west-2

cacher_deploy_secondary: set_region_us_east_2 cacher_build find_redis_url
	cd cacher; sam deploy --parameter-overrides RedisURL=$(REDIS_ADDRESS) --region us-east-2

cacher_save:
	curl https://ibtred047k.execute-api.us-west-2.amazonaws.com/Prod/save

delete:
	aws cloudformation delete-stack --stack-name SolutionStack

destroy: cacher_delete query_delete loader_delete
	cd solution; cdk destroy --require-approval never


GET_QUERY_URL = $(shell jq .Stacks[0].Outputs[0].OutputValue /tmp/x)
SET_QUERY_URL = $(eval QUERY_URL=$(GET_QUERY_URL))

find_query_url:
	aws cloudformation describe-stacks --stack-name ecquery --output json > /tmp/x
	$(SET_QUERY_URL)
	@echo Query URL: $(QUERY_URL)

GET_REDIS_ADDRESS = $(shell jq .CacheClusters[0].CacheNodes[0].Endpoint.Address /tmp/x)
SET_REDIS_ADDRESS = $(eval REDIS_ADDRESS=redis://$(GET_REDIS_ADDRESS):6379)

find_redis_url:
	aws elasticache describe-cache-clusters \
	  --show-cache-node-info --output json > /tmp/x
	  $(SET_REDIS_ADDRESS)
	  echo Redis: $(REDIS_ADDRESS)

init:
	cd solution; cdk init app --language=typescript

loader_build: 
	cd auth_loader; sam build

loader_delete:
	cd auth_loader; sam delete --no-prompts

loader_deploy: loader_build
	cd auth_loader; sam deploy

query_build:
	cd elasticache_query; sam build

query_delete:
	cd elasticache_query; sam delete --no-prompts

query_deploy: query_build find_redis_url
	cd elasticache_query; sam deploy --parameter-overrides RedisURL=$(REDIS_ADDRESS)

run_query: set_region_us_west_2 find_query_url
	curl $(QUERY_URL)

send_auth:
	curl https://fs4mfkm0pa.execute-api.us-west-2.amazonaws.com/Prod/send

auth_load_test:
	ab -n 1000 https://fs4mfkm0pa.execute-api.us-west-2.amazonaws.com/Prod/send 

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

