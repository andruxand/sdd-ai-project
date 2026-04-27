import type { AWS } from '@serverless/typescript';

const serverlessConfiguration: AWS = {
  service: 'template-api',
  frameworkVersion: '4',
  plugins: ['serverless-offline'],
  provider: {
    name: 'aws',
    runtime: 'nodejs22.x',
    region: 'us-east-1',
    stage: '${opt:stage, "dev"}',
    logRetentionInDays: 30,
    environment: {
      NODE_ENV: '${opt:stage, "dev"}',
    },
  },
  custom: {
    'serverless-offline': {
      httpPort: 3000,
      lambdaPort: 3002,
      noPrependStageInUrl: true,
      reloadHandler: true,
    },
  },
  functions: {},
  resources: {},
};

export default serverlessConfiguration;
