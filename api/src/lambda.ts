import serverless from 'serverless-http';
import { createApp } from './app.js';

/** AWS Lambda entry point (Function URL or API Gateway) wrapping the Express app. */
export const handler = serverless(createApp());
