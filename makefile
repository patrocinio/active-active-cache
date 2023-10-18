deploy: synth
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
