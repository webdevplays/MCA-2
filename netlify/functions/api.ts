import serverless from "serverless-http";
import { createExpressApp } from "../../server.js";

let serverlessHandler: any;

export const handler = async (event: any, context: any) => {
  // Set netlify env indicator if not already set
  process.env.NETLIFY = "true";
  
  if (!serverlessHandler) {
    const app = await createExpressApp(false);
    serverlessHandler = serverless(app);
  }
  
  return serverlessHandler(event, context);
};
