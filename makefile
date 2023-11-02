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

cacher_deploy: cacher_build
	cd cacher; sam deploy

delete:
	aws cloudformation delete-stack --stack-name SolutionStack

destroy: cacher_delete query_delete loader_delete
	cd solution; cdk destroy --require-approval never

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

query_deploy: query_build
	cd elasticache_query; sam deploy

run_query:
	curl https://4pcxke1yt1.execute-api.us-west-2.amazonaws.com/Prod/query

send_auth:
	cd auth_loader; sam local invoke

set_region:
	aws configure set default.region us-west-2
	
solution_deploy: bootstrap synth
	cd solution; cdk deploy --require-approval never

synth:
	cd solution; cdk synth

