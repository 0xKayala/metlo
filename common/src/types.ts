import {
  AlertType,
  ConnectionType,
  DataClass,
  DataSection,
  DataTag,
  DataType,
  protocols,
  RestMethod,
  RiskScore,
  SpecExtension,
  Status,
  AWS_STEPS,
  UpdateAlertType,
  GCP_STEPS,
  AWS_SOURCE_TYPE,
  GCP_SOURCE_TYPE,
  AuthType,
  AttackType,
} from "./enums"
import { Test, Request as TestRequest } from "@metlo/testing"
import "axios"

export interface Meta {
  incoming: boolean
  source: string
  sourcePort: string
  destination: string
  destinationPort: string
}

export interface SessionMeta {
  authenticationProvided: boolean
  authenticationSuccessful: boolean
  authType: AuthType
  uniqueSessionKey?: string
  user?: string
}

export interface PairObject {
  name: string
  value: string
}

export interface Url {
  host: string
  path: string
  parameters: PairObject[]
}

declare module "axios" {
  interface AxiosRequestConfig {
    metadata?: Record<string, any>
  }
  interface AxiosResponseConfig {
    metadata?: Record<string, any>
  }
  interface AxiosResponse {
    duration?: number
  }
}

export interface Request {
  url: Url
  headers: PairObject[]
  body: string
  method: RestMethod
}

export interface Response {
  status: number
  headers: PairObject[]
  body: string
}

export interface TraceParams {
  request: Request
  response: Response
  meta: Meta
}

export interface GetSensitiveDataAggParams {
  hosts?: string[]
  riskScores?: RiskScore[]
  locations?: DataSection[]
}

export interface GetVulnerabilityAggParams {
  hosts?: string[]
  riskScores?: RiskScore[]
}

export interface GetAttackParams {
  hosts?: string[]
  riskScores?: RiskScore[]
  offset?: number
  limit?: number
}

export interface GetEndpointParams {
  hosts?: string[]
  riskScores?: RiskScore[]
  dataClasses?: DataClass[]
  searchQuery?: string
  isAuthenticatedDetected?: boolean
  offset?: number
  limit?: number
}

export interface GetAlertParams {
  apiEndpointUuid?: string
  riskScores?: RiskScore[]
  status?: Status[]
  alertTypes?: AlertType[]
  hosts?: string[]
  offset?: number
  limit?: number
  order?: "DESC" | "ASC"
}

export interface UpdateDataFieldClassesParams {
  dataClasses: DataClass[]
  dataSection: DataSection
  dataPath: string
}

export interface UpdateDataFieldParams {
  isRisk: boolean
}

export interface UpdateAlertParams {
  updateType: UpdateAlertType
  resolutionMessage?: string
}

export type JSONValue =
  | string
  | number
  | boolean
  | { [x: string]: JSONValue }
  | Array<JSONValue>

export interface ApiTrace {
  uuid: string
  path: string
  createdAt: Date
  host: string
  method: RestMethod
  requestParameters: PairObject[]
  requestHeaders: PairObject[]
  requestBody: string
  responseStatus: number
  responseHeaders: PairObject[]
  responseBody: string
  meta: Meta
  apiEndpointUuid: string
}

export interface Alert {
  uuid: string
  type: AlertType
  riskScore: RiskScore
  apiEndpointUuid: string
  apiEndpoint: {
    uuid: string
    method: RestMethod
    host: string
    path: string
    openapiSpecName: string
    openapiSpec: {
      extension: SpecExtension
      minimizedSpecContext: Record<string, MinimizedSpecContext>
    }
  }
  description: string
  createdAt: Date
  updatedAt: Date
  status: Status
  resolutionMessage: string
  context: object
}

export interface DataField {
  uuid: string
  dataClasses: DataClass[]
  dataPath: string
  dataSection: DataSection
  dataType: DataType
  dataTag: DataTag
  falsePositives: DataClass[]
  scannerIdentified: DataClass[]
  createdAt: Date
  updatedAt: Date
  matches: Record<DataClass, string[]>
  apiEndpointUuid: string
}

export interface ApiEndpoint {
  uuid: string
  path: string
  createdAt: Date
  updatedAt: Date
  dataFields: DataField[]
  firstDetected?: Date
  lastActive?: Date
  host: string
  method: RestMethod
  owner: string
  riskScore: RiskScore
  openapiSpecName: string
  isAuthenticatedDetected: boolean
  isAuthenticatedUserSet: boolean
}

export interface ApiEndpointDetailed extends ApiEndpoint {
  openapiSpec: OpenApiSpec
  alerts: Alert[]
  traces: ApiTrace[]
  tests: Test[]
}

export interface TestDetailed {
  uuid: string
  name: string
  tags: string[]
  requests: TestRequest[]
  apiEndpoint: ApiEndpoint
}

export interface OpenApiSpec {
  name: string
  spec: string
  isAutoGenerated: boolean
  extension: SpecExtension
  createdAt: Date
  updatedAt: Date
  hosts: string[]
}

export interface Connection {
  createdAt: Date
  uuid: string
  name: string
  type: ConnectionType
}

export interface EndpointAndUsage extends ApiEndpointDetailed {
  last30MinCnt: number
  last5MinCnt: number
  last1MinCnt: number
}

export interface UsageStats {
  dailyUsage: { day: string; cnt: number }[]
  last1MinCnt: number
  last60MinCnt: number
}

export interface Summary {
  highRiskAlerts: number
  newAlerts: number
  endpointsTracked: number
  piiDataFields: number
  hostCount: number
  piiDataTypeCount: Map<DataClass, number>
  alertTypeCount: Map<AlertType, number>
  topAlerts: Alert[]
  topEndpoints: EndpointAndUsage[]
  usageStats: UsageStats
  numConnections: number
}

export interface Usage {
  date: Date
  count: number
}

export interface PIIDataClassAggItem {
  dataClass: DataClass
  risk: RiskScore
  count: number
  numEndpoints: number
  numHosts: number
}

export interface SensitiveDataSummary {
  piiDataTypeCount: Map<DataClass, number>
  piiItems: PIIDataClassAggItem[]
  totalPIIFields: number
  totalEndpoints: number
}

export interface VulnerabilityAggItem {
  type: AlertType
  risk: RiskScore
  count: number
  numEndpoints: number
  numHosts: number
}

export interface VulnerabilitySummary {
  vulnerabilityTypeCount: Map<AlertType, number>
  vulnerabilityItems: VulnerabilityAggItem[]
  totalVulnerabilities: number
  totalEndpoints: number
}

export interface AttackMeta {
  averageRPS?: number
  currentRPS?: number
}

export interface Attack {
  uuid: string
  createdAt: Date
  riskScore: RiskScore
  attackType: AttackType
  description: string
  metadata: AttackMeta
  startTime: Date
  endTime: Date

  uniqueSessionKey: string
  sourceIP: string
  apiEndpointUuid: string
  apiEndpoint: ApiEndpoint
  host: string

  resolved: boolean
  snoozed: boolean
  snoozeHours: number
}

export interface AttackResponse {
  attackTypeCount: Record<AttackType, number>
  attacks: Attack[]
  totalAttacks: number
  totalEndpoints: number
  validLicense: boolean
}

export interface AttackDetailResponse {
  attack: Attack
  traces: ApiTrace[]
  validLicense: boolean
}

export interface STEP_RESPONSE<T extends ConnectionType = ConnectionType> {
  success: "OK" | "FAIL" | "FETCHING"
  status: "STARTED" | "COMPLETE" | "IN-PROGRESS"
  retry_id?: string
  next_step: AWS_STEPS | GCP_STEPS
  step_number: AWS_STEPS | GCP_STEPS
  last_completed: AWS_STEPS | GCP_STEPS
  message: string
  error?: {
    err: string
  }
  data: CONNECTIONS_BASE &
    (T extends ConnectionType.AWS
      ? Partial<AWS_CONNECTION & AWS_CONNECTION_MISC & SSH_INFO>
      : T extends ConnectionType.GCP
      ? Partial<GCP_CONNECTION & GCP_CONNECTION_MISC>
      : never)
  returns?: {
    os_types?: [{ name: string; ami: string }]
    instance_types?: string[]
  }
}

export interface MachineSpecifications {
  minCpu: number
  maxCpu: number
  minMem: number
  maxMem?: number
}

export interface TrafficFilterRuleSpecs {
  destination_CIDR: string
  source_CIDR: string
  source_port?: string
  destination_port?: string
  protocol: protocols
  direction: "out" | "in"
}

export interface InstanceSettings {
  uuid: string
  updateEmail: string
  skippedUpdateEmail: boolean
}

export interface CONNECTIONS_BASE {
  id: string
  name: string
}

export interface SSH_INFO {
  keypair: string
  username: string
  remote_machine_url: string
}

export interface AWS_CONNECTION {
  secret_access_key: string
  access_id: string
  mirror_source_id: string
  source_type: AWS_SOURCE_TYPE
  region: string
  ami: string
  selected_instance_type: string
  mirror_instance_id: string
  mirror_target_id: string
  mirror_filter_id: string
  mirror_session_id: string
  mirror_rules: Array<TrafficFilterRuleSpecs>
  destination_eni_id: string
  source_eni_id: string
  backend_url: string
  keypair_id: string
  keypair_name: string
  source_private_ip: string
}

export interface AWS_CONNECTION_MISC {
  instance_types: string[]
  virtualization_type: string
  machine_specs: MachineSpecifications
}

export interface ENCRYPTED_AWS_CONNECTION__META {
  keypair_tag: string
  keypair_iv: string
  secret_access_key_tag: string
  secret_access_key_iv: string
  access_id_tag: string
  access_id_iv: string
}

export interface GCP_CONNECTION {
  key_file: string
  project: string
  zone: string
  network_url: string
  ip_range: string
  source_subnetwork_url: string
  firewall_rule_url: string
  destination_subnetwork_url: string
  router_url: string
  machine_type: string
  source_image: string
  image_template_url: string
  instance_url: string
  managed_group_url: string
  health_check_url: string
  backend_service_url: string
  forwarding_rule_url: string
  source_instance_url: string
  packet_mirror_url: string
  mirror_source_value: [string]
  source_type: GCP_SOURCE_TYPE
  source_private_ip: string
}

export interface GCP_CONNECTION_MISC {
  network_name: string
}

export interface ENCRYPTED_GCP_CONNECTION__META {
  key_file_tag: string
  key_file_iv: string
}

export interface ConnectionInfo {
  uuid: string
  connectionType: ConnectionType
  createdAt: Date
  updatedAt: Date
  name: string
  aws?: Omit<AWS_CONNECTION, "secret_access_key" | "access_id" | "keypair">
  gcp?: Omit<GCP_CONNECTION, "key_file">
}

export interface MinimizedSpecContext {
  lineNumber: number
  minimizedSpec: string
}