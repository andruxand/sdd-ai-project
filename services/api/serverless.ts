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
    memorySize: 256,
    timeout: 10,
    tracing: {
      lambda: true,
      apiGateway: true,
    },
    tags: {
      service: '${self:service}',
      stage: '${opt:stage, "dev"}',
      managedBy: 'serverless-framework',
    },
    environment: {
      NODE_ENV: '${opt:stage, "dev"}',
      NODE_OPTIONS: '--enable-source-maps',
      APP_VERSION: '${file(./package.json):version}',
      SERVICE_NAME: '${self:service}',
      STAGE: '${opt:stage, "dev"}',
      METRICS_NAMESPACE: '${self:service}-${opt:stage, "dev"}',
      LOG_LEVEL: 'INFO',
      POWERTOOLS_LOGGER_LOG_EVENT: 'false',
      POWERTOOLS_TRACER_CAPTURE_RESPONSE: 'false',
      POWERTOOLS_TRACER_CAPTURE_ERROR: 'true',
    },
    httpApi: {
      cors: {
        allowedOrigins: ['http://localhost:5173', 'https://app.example.com'],
        allowedHeaders: [
          'Content-Type',
          'X-Correlation-ID',
          'x-datadog-trace-id',
          'x-datadog-parent-id',
          'x-datadog-sampling-priority',
        ],
        allowedMethods: ['GET', 'POST', 'PUT', 'DELETE', 'OPTIONS'],
        exposedResponseHeaders: ['Content-Type', 'X-Correlation-ID'],
        maxAge: 86400,
      },
      metrics: true,
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
  functions: {
    getHealth: {
      handler: 'src/infrastructure/http/handlers/health/getHealth.handler',
      description:
        'Public health check endpoint returning service status, version, and timestamp',
      events: [
        {
          httpApi: {
            path: '/health',
            method: 'get',
          },
        },
      ],
    },
  },
  resources: {
    Resources: {
      // SNS Topic for CloudWatch alarms
      AlertsTopic: {
        Type: 'AWS::SNS::Topic',
        Properties: {
          TopicName: '${self:service}-${opt:stage, "dev"}-alerts',
          DisplayName: 'CloudWatch Alarms for ${self:service}',
          Tags: [
            { Key: 'service', Value: '${self:service}' },
            { Key: 'stage', Value: '${opt:stage, "dev"}' },
            { Key: 'managedBy', Value: 'serverless-framework' },
          ],
        },
      },

      // CloudWatch Alarm: Health Check Error Rate
      HealthCheckErrorRateAlarm: {
        Type: 'AWS::CloudWatch::Alarm',
        Properties: {
          AlarmName: '${self:service}-${opt:stage, "dev"}-HealthCheckErrorRate',
          AlarmDescription:
            'Health check endpoint error rate exceeds 5% over 5 minutes',
          MetricName: 'FunctionErrorsCount',
          Namespace: '${self:service}-${opt:stage, "dev"}',
          Statistic: 'Sum',
          Period: 300,
          EvaluationPeriods: 1,
          Threshold: 0.05,
          ComparisonOperator: 'GreaterThanThreshold',
          TreatMissingData: 'notBreaching',
          AlarmActions: [{ Ref: 'AlertsTopic' }],
          Dimensions: [
            {
              Name: 'service',
              Value: '${self:service}',
            },
          ],
          Tags: [
            { Key: 'service', Value: '${self:service}' },
            { Key: 'stage', Value: '${opt:stage, "dev"}' },
            { Key: 'managedBy', Value: 'serverless-framework' },
          ],
        },
      },

      // CloudWatch Alarm: Health Check P95 Latency
      HealthCheckLatencyP95Alarm: {
        Type: 'AWS::CloudWatch::Alarm',
        Properties: {
          AlarmName:
            '${self:service}-${opt:stage, "dev"}-HealthCheckLatencyP95',
          AlarmDescription:
            'Health check p95 latency exceeds 200ms over 5 minutes',
          MetricName: 'HealthCheck.Latency',
          Namespace: '${self:service}-${opt:stage, "dev"}',
          ExtendedStatistic: 'p95',
          Period: 300,
          EvaluationPeriods: 1,
          Threshold: 200,
          ComparisonOperator: 'GreaterThanThreshold',
          TreatMissingData: 'notBreaching',
          AlarmActions: [{ Ref: 'AlertsTopic' }],
          Dimensions: [
            {
              Name: 'service',
              Value: '${self:service}',
            },
          ],
          Tags: [
            { Key: 'service', Value: '${self:service}' },
            { Key: 'stage', Value: '${opt:stage, "dev"}' },
            { Key: 'managedBy', Value: 'serverless-framework' },
          ],
        },
      },
    },
  },
};

export default serverlessConfiguration;
