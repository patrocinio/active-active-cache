loader_deploy: loader_build
	cd auth_loader; sam deploy

loader_build: 
	cd auth_loader; sam build

loader_delete:
	cd auth_loader; sam delete

solution_deploy: bootstrap synth
	cd solution; cdk deploy --require-approval never

synth:
	cd solution; cdk synth

build:
	cd solution; npm run build

init:
	cd solution; cdk init app --language=typescript

bootstrap:
	cd solution; cdk bootstrap

delete:
	aws cloudformation delete-stack --stack-name SolutionStack

set_region:
	aws configure set default.region us-west-2