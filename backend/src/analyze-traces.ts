import { v4 as uuidv4 } from "uuid"
import { AppDataSource } from "data-source"
import { ApiTrace, ApiEndpoint, DataField, Alert, OpenApiSpec } from "models"
import { DataFieldService } from "services/data-field"
import { SpecService } from "services/spec"
import { AlertService } from "services/alert"
import { RedisClient } from "utils/redis"
import { TRACES_QUEUE } from "~/constants"
import { QueryRunner } from "typeorm"
import { QueuedApiTrace } from "@common/types"
import {
  endpointAddNumberParams,
  endpointUpdateDates,
  isSuspectedParamater,
  skipAutoGeneratedMatch,
} from "utils"
import { getPathTokens } from "@common/utils"
import { AlertType, RiskScore } from "@common/enums"
import { isGraphQlEndpoint } from "services/graphql"
import { isQueryFailedError, retryTypeormTransaction } from "utils/db"
import { MetloContext } from "types"
import {
  getEntityManager,
  getQB,
  insertValueBuilder,
  insertValuesBuilder,
} from "services/database/utils"
import { sendWebhookRequests } from "services/webhook"
import { updateIPs } from "analyze/update-ips"

const getEndpointQuery = (ctx: MetloContext) => `
SELECT
  endpoint. *,
  CASE WHEN spec."isAutoGenerated" IS NULL THEN NULL ELSE json_build_object('isAutoGenerated', spec."isAutoGenerated") END as "openapiSpec"
FROM
  ${ApiEndpoint.getTableName(ctx)} endpoint
  LEFT JOIN ${OpenApiSpec.getTableName(
    ctx,
  )} spec ON endpoint."openapiSpecName" = spec.name
WHERE
  $1 ~ "pathRegex"
  AND method = $2
  AND host = $3
GROUP BY
  1,
  spec."isAutoGenerated"
ORDER BY
  endpoint."numberParams" ASC
LIMIT
  1
`

export const getDataFieldsQuery = (ctx: MetloContext) => `
SELECT
  uuid,
  "dataClasses"::text[],
  "falsePositives"::text[],
  "scannerIdentified"::text[],
  "dataType",
  "dataTag",
  "dataSection",
  "createdAt",
  "updatedAt",
  "dataPath",
  "apiEndpointUuid",
  "statusCode",
  "contentType",
  "arrayFields",
  "isNullable"
FROM
  ${DataField.getTableName(ctx)} data_field
WHERE
  "apiEndpointUuid" = $1
`

const sleep = (ms: number) => new Promise(res => setTimeout(res, ms))

const getQueuedApiTrace = async (): Promise<{
  trace: QueuedApiTrace
  ctx: MetloContext
}> => {
  try {
    const unsafeRedisClient = RedisClient.getInstance()
    const traceString = await unsafeRedisClient.lpop(TRACES_QUEUE)
    return JSON.parse(traceString)
  } catch (err) {
    return null
  }
}

const shouldUpdateEndpoint = (
  prevRiskScore: RiskScore,
  prevLastActive: Date,
  apiEndpoint: ApiEndpoint,
) => {
  if (
    !prevRiskScore ||
    !prevLastActive ||
    !apiEndpoint?.lastActive ||
    !apiEndpoint?.riskScore
  ) {
    return true
  }
  return (
    prevRiskScore !== apiEndpoint.riskScore ||
    apiEndpoint.lastActive.getTime() - prevLastActive.getTime() > 30_000
  )
}

const analyze = async (
  ctx: MetloContext,
  trace: QueuedApiTrace,
  apiEndpoint: ApiEndpoint,
  queryRunner: QueryRunner,
  newEndpoint?: boolean,
) => {
  const prevRiskScore = apiEndpoint.riskScore
  const prevLastActive = apiEndpoint.lastActive
  endpointUpdateDates(trace.createdAt, apiEndpoint)
  const dataFields = DataFieldService.findAllDataFields(trace, apiEndpoint)
  let alerts = await SpecService.findOpenApiSpecDiff(
    ctx,
    trace,
    apiEndpoint,
    queryRunner,
  )
  const sensitiveDataAlerts = await AlertService.createDataFieldAlerts(
    ctx,
    dataFields.newFields.concat(dataFields.updatedFields),
    apiEndpoint.uuid,
    apiEndpoint.path,
    trace,
    queryRunner,
  )
  alerts = alerts?.concat(sensitiveDataAlerts)
  if (newEndpoint) {
    const newEndpointAlert = await AlertService.createAlert(
      ctx,
      AlertType.NEW_ENDPOINT,
      apiEndpoint,
    )
    newEndpointAlert.createdAt = trace.createdAt
    newEndpointAlert.updatedAt = trace.createdAt
    alerts = alerts?.concat(newEndpointAlert)
  }

  await queryRunner.startTransaction()

  if (Array.isArray(trace.requestBody)) {
    trace.requestBody = JSON.stringify(trace.requestBody)
  }
  if (Array.isArray(trace.responseBody)) {
    trace.responseBody = JSON.stringify(trace.responseBody)
  }

  await retryTypeormTransaction(
    () =>
      getEntityManager(ctx, queryRunner).insert(ApiTrace, [
        {
          ...trace,
          apiEndpointUuid: apiEndpoint.uuid,
        },
      ]),
    5,
  )
  await retryTypeormTransaction(
    () =>
      insertValuesBuilder(ctx, queryRunner, DataField, dataFields.newFields)
        .orIgnore()
        .execute(),
    5,
  )
  await retryTypeormTransaction(
    () =>
      getEntityManager(ctx, queryRunner).saveList<DataField>(
        dataFields.updatedFields,
      ),
    5,
  )
  await retryTypeormTransaction(
    () =>
      insertValuesBuilder(ctx, queryRunner, Alert, alerts).orIgnore().execute(),
    5,
  )
  if (shouldUpdateEndpoint(prevRiskScore, prevLastActive, apiEndpoint)) {
    await retryTypeormTransaction(
      () =>
        getQB(ctx, queryRunner)
          .update(ApiEndpoint)
          .set({
            firstDetected: apiEndpoint.firstDetected,
            lastActive: apiEndpoint.lastActive,
            riskScore: apiEndpoint.riskScore,
          })
          .andWhere("uuid = :id", { id: apiEndpoint.uuid })
          .execute(),
      5,
    )
  }
  await updateIPs(ctx, trace, apiEndpoint, queryRunner)
  await queryRunner.commitTransaction()

  await sendWebhookRequests(ctx, alerts, apiEndpoint)
}

const generateEndpoint = async (
  ctx: MetloContext,
  trace: QueuedApiTrace,
  queryRunner: QueryRunner,
): Promise<void> => {
  const isGraphQl = isGraphQlEndpoint(trace.path)
  let paramNum = 1
  let parameterizedPath = ""
  let pathRegex = String.raw``
  if (isGraphQl) {
    parameterizedPath = trace.path
    pathRegex = trace.path
  } else {
    const pathTokens = getPathTokens(trace.path)
    for (let j = 0; j < pathTokens.length; j++) {
      const tokenString = pathTokens[j]
      if (tokenString === "/") {
        parameterizedPath += "/"
        pathRegex += "/"
      } else if (tokenString.length > 0) {
        if (isSuspectedParamater(tokenString)) {
          parameterizedPath += `/{param${paramNum}}`
          pathRegex += String.raw`/[^/]+`
          paramNum += 1
        } else {
          parameterizedPath += `/${tokenString}`
          pathRegex += String.raw`/${tokenString}`
        }
      }
    }
  }
  if (pathRegex.length > 0) {
    pathRegex = String.raw`^${pathRegex}(/)*$`
    const apiEndpoint = new ApiEndpoint()
    apiEndpoint.uuid = uuidv4()
    apiEndpoint.path = parameterizedPath
    apiEndpoint.pathRegex = pathRegex
    apiEndpoint.host = trace.host
    apiEndpoint.method = trace.method
    endpointAddNumberParams(apiEndpoint)
    apiEndpoint.dataFields = []
    if (isGraphQl) {
      apiEndpoint.isGraphQl = true
    }

    try {
      await queryRunner.startTransaction()
      await retryTypeormTransaction(
        () =>
          insertValueBuilder(
            ctx,
            queryRunner,
            ApiEndpoint,
            apiEndpoint,
          ).execute(),
        5,
      )
      await queryRunner.commitTransaction()
      await analyze(ctx, trace, apiEndpoint, queryRunner, true)
    } catch (err) {
      if (queryRunner.isTransactionActive) {
        await queryRunner.rollbackTransaction()
      }
      if (isQueryFailedError(err) && err.code === "23505") {
        const existingEndpoint = await getEntityManager(
          ctx,
          queryRunner,
        ).findOne(ApiEndpoint, {
          where: {
            path: trace.path,
            host: trace.host,
            method: trace.method,
          },
          relations: { dataFields: true },
        })
        if (existingEndpoint) {
          await analyze(ctx, trace, existingEndpoint, queryRunner)
        }
      } else {
        console.error(`Error generating new endpoint: ${err}`)
      }
    }
  }
}

const analyzeTraces = async (): Promise<void> => {
  const datasource = await AppDataSource.initialize()
  if (!datasource.isInitialized) {
    console.error("Couldn't initialize datasource...")
    return
  }
  console.log("AppDataSource Initialized...")
  console.log("Running Analyzer...")
  let queryRunner = AppDataSource.createQueryRunner()
  await queryRunner.connect()
  while (true) {
    try {
      const queued = await getQueuedApiTrace()
      if (queued) {
        const { trace, ctx } = queued
        trace.createdAt = new Date(trace.createdAt)
        const apiEndpoint: ApiEndpoint = (
          await queryRunner.query(getEndpointQuery(ctx), [
            trace.path,
            trace.method,
            trace.host,
          ])
        )?.[0]
        if (apiEndpoint && !skipAutoGeneratedMatch(apiEndpoint, trace.path)) {
          const dataFields = await getEntityManager(ctx, queryRunner).find(
            DataField,
            { where: { apiEndpointUuid: apiEndpoint.uuid } },
          )
          apiEndpoint.dataFields = dataFields
          await analyze(ctx, trace, apiEndpoint, queryRunner)
        } else {
          if (trace.responseStatus !== 404 && trace.responseStatus !== 405) {
            await generateEndpoint(ctx, trace, queryRunner)
          }
        }
      } else {
        await sleep(50)
      }
    } catch (err) {
      console.error(`Encountered error while analyzing traces: ${err}`)
      if (queryRunner.isTransactionActive) {
        await queryRunner.rollbackTransaction()
      }
    } finally {
      if (queryRunner.isReleased) {
        queryRunner = AppDataSource.createQueryRunner()
        await queryRunner.connect()
      }
    }
  }
}

export default analyzeTraces
