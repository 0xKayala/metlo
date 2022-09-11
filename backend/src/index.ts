import express, { Express, Request, Response } from "express"
import dotenv from "dotenv"
import { TypeormStore } from "connect-typeorm"
import session from "express-session"
import { InstanceSettings, Session as SessionModel } from "models"
import {
  getEndpointHandler,
  getEndpointsHandler,
  getHostsHandler,
  getUsageHandler,
} from "api/get-endpoints"
import {
  deleteSpecHandler,
  getSpecHandler,
  getSpecListHandler,
  updateSpecHandler,
  uploadNewSpecHandler,
} from "api/spec"
import { getAlertsHandler, updateAlertHandler } from "api/alert"
import { deleteDataFieldHandler, updateDataFieldClasses } from "api/data-field"
import { getSummaryHandler } from "api/summary"
import { AppDataSource } from "data-source"
import { MulterSource } from "multer-source"
import {
  aws_instance_choices,
  aws_os_choices,
  gcp_instance_choices,
  gcp_os_choices,
  get_long_running_state,
  setup_connection,
} from "./api/setup"
import {
  deleteTest,
  getTest,
  listTests,
  runTestHandler,
  saveTest,
} from "./api/tests"
import {
  delete_connection,
  get_connection_for_uuid,
  get_ssh_key_for_connection_uuid,
  list_connections,
  update_connection,
} from "./api/connections"
import { RedisClient } from "utils/redis"
import { getSensitiveDataSummaryHandler } from "api/data-field/sensitive-data"
import { getVulnerabilitySummaryHandler } from "api/alert/vulnerability"

dotenv.config()

const app: Express = express()
const port = process.env.PORT || 8080
RedisClient.getInstance()

app.disable("x-powered-by")
app.use(express.json())
app.use(express.urlencoded({ extended: true }))
app.use(
  session({
    resave: false,
    saveUninitialized: false,
    store: new TypeormStore({
      cleanupLimit: 2,
      limitSubquery: false, // If using MariaDB.
      ttl: 86400,
    }).connect(AppDataSource.getRepository(SessionModel)),
    secret: process.env.EXPRESS_SECRET,
  }),
)

app.get("/api/v1", (req: Request, res: Response) => {
  res.send("OK")
})

app.get("/api/v1/summary", getSummaryHandler)
app.get("/api/v1/sensitive-data-summary", getSensitiveDataSummaryHandler)
app.get("/api/v1/vulnerability-summary", getVulnerabilitySummaryHandler)
app.get("/api/v1/endpoints/hosts", getHostsHandler)
app.get("/api/v1/endpoints", getEndpointsHandler)
app.get("/api/v1/endpoint/:endpointId", getEndpointHandler)
app.get("/api/v1/endpoint/:endpointId/usage", getUsageHandler)

app.post("/api/v1/spec/new", MulterSource.single("file"), uploadNewSpecHandler)
app.delete("/api/v1/spec/:specFileName", deleteSpecHandler)
app.put(
  "/api/v1/spec/:specFileName",
  MulterSource.single("file"),
  updateSpecHandler,
)
app.get("/api/v1/specs", getSpecListHandler)
app.get("/api/v1/spec/:specFileName", getSpecHandler)

app.post(
  "/api/v1/data-field/:dataFieldId/update-classes",
  updateDataFieldClasses,
)
app.delete("/api/v1/data-field/:dataFieldId", deleteDataFieldHandler)

app.get("/api/v1/alerts", getAlertsHandler)
app.put("/api/v1/alert/:alertId", updateAlertHandler)

app.post("/api/v1/setup_connection", setup_connection)
app.get("/api/v1/long_running/:uuid", get_long_running_state)
app.post("/api/v1/setup_connection/aws/os", aws_os_choices)
app.post("/api/v1/setup_connection/aws/instances", aws_instance_choices)
app.post("/api/v1/setup_connection/gcp/os", gcp_os_choices)
app.post("/api/v1/setup_connection/gcp/instances", gcp_instance_choices)
app.get("/api/v1/list_connections", list_connections)
app.get("/api/v1/list_connections/:uuid", get_connection_for_uuid)
app.get(
  "/api/v1/list_connections/:uuid/sshkey",
  get_ssh_key_for_connection_uuid,
)
app.post("/api/v1/update_connection", update_connection)
app.delete("/api/v1/delete_connection/:uuid", delete_connection)

app.post("/api/v1/test/run", runTestHandler)
app.post("/api/v1/test/save", saveTest)
app.get("/api/v1/test/list", listTests)
app.get("/api/v1/test/list/:uuid", getTest)
app.delete("/api/v1/test/:uuid/delete", deleteTest)

const initInstanceSettings = async () => {
  const settingRepository = AppDataSource.getRepository(InstanceSettings)
  const numSettings = await settingRepository.count()
  if (numSettings == 0) {
    console.log("Initializing Instance Settings")
    const setting = new InstanceSettings()
    await settingRepository.save(setting)
  }
}

const main = async () => {
  try {
    const datasource = await AppDataSource.initialize()
    console.log(
      `Is AppDataSource Initialized? ${
        datasource.isInitialized ? "Yes" : "No"
      }`,
    )
    await initInstanceSettings()
    app.listen(port, () => {
      console.log(`⚡️[server]: Server is running at http://localhost:${port}`)
    })
  } catch (err) {
    console.error(`CatchBlockInsideMain: ${err}`)
  }
}

main().catch(err => {
  console.error(`Error in main try block: ${err}`)
})
