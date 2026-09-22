import {deploymentReadiness as readiness} from "./deployment-readiness.mjs";
export type DeploymentReadiness = {
  accountReady: boolean;
  aiReady: boolean;
  robloxUploadReady: boolean;
};
export const deploymentReadiness = readiness as (env: NodeJS.ProcessEnv) => DeploymentReadiness;
