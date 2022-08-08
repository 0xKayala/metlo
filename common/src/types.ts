import {
  AlertType,
  ConnectionType,
  RestMethod,
  RiskScore,
  SpecExtension,
} from "./enums";

export interface Meta {
  incoming: boolean;
  source: string;
  sourcePort: string;
  destination: string;
  destinationPort: string;
}

export interface PairObject {
  name: string;
  value: string;
}

export interface Url {
  host: string;
  path: string;
  parameters: PairObject[];
}

export interface Request {
  url: Url;
  headers: PairObject[];
  body: string;
  method: RestMethod;
}

export interface Response {
  status: number;
  headers: PairObject[];
  body: string;
}

export interface TraceParams {
  request: Request;
  response: Response;
  meta: Meta;
}

export interface GetEndpointParams {
  hosts?: string[];
  riskScores?: RiskScore[];
  offset?: number;
  limit?: number;
}

export interface GetAlertParams {
  riskScores?: RiskScore[];
  resolved?: boolean;
  alertTypes?: AlertType[];
  offset?: number;
  limit?: number;
}

export type JSONValue =
  | string
  | number
  | boolean
  | { [x: string]: JSONValue }
  | Array<JSONValue>;

export interface ApiTrace {
  uuid: string;
  path: string;
  createdAt: Date;
  host: string;
  method: RestMethod;
  requestParameters: PairObject[];
  requestHeaders: PairObject[];
  requestBody: string;
  responseStatus: number;
  responseHeaders: PairObject[];
  responseBody: string;
  meta: Meta;
  apiEndpointUuid: string;
}

export interface Alert {
  uuid: string;
  type: AlertType;
  riskScore: RiskScore;
  apiEndpointUuid: string;
  apiEndpoint: ApiEndpoint;
  description: string;
  createdAt: Date;
  updatedAt: Date;
  resolved: boolean;
  resolutionMessage: string;
}

export interface PIIField {
  uuid: string;
  dataClass: string;
  dataPath: string;
  risk: RiskScore;
  createdAt: string;
  updatedAt: string;
  matches: string[];
  isRisk: boolean;
}

export interface Endpoint {
  uuid: string;
  host: string;
  path: string;
  method: string;
  riskScore: RiskScore;
  firstDetected: string;
  lastActive: string;
  piiData: PIIField[];
  traces: ApiTrace[];
  alerts: Alert[];
}

export interface ApiEndpoint {
  uuid: string;
  path: string;
  createdAt: Date;
  updatedAt: Date;
  firstDetected: Date;
  lastActive: Date;
  host: string;
  totalCalls: number;
  method: RestMethod;
  owner: string;
  riskScore: RiskScore;
  openapiSpecName: string;
}

export interface ApiEndpointDetailed extends ApiEndpoint {
  sensitiveDataClasses: PIIField[];
  openapiSpec: OpenApiSpec;
  alerts: any[];
  traces: ApiTrace[];
}

export interface OpenApiSpec {
  name: string;
  spec: string;
  isAutoGenerated: boolean;
  extension: SpecExtension;
  createdAt: string;
  updatedAt: string;
}

export interface Connection {
  createdAt: Date;
  uuid: string;
  name: string;
  type: ConnectionType;
}

export interface SummaryResponse {
  highRiskAlerts: number;
  newAlerts: number;
  endpointsTracked: number;
  piiDataFields: number;
}
