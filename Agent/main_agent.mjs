import {DeliverooApi} from "@unitn-asa/deliveroo-js-client";
import * as constants from "../utils/ConsVar.js";
import {Agent} from "./BDI.js";
import * as dotenv from "dotenv";

dotenv.config()

// Getting token and host
let token = process.env.TOKEN
let host = process.env.HOST
console.log("\ntoken: ", token)
console.log("host: ", host)


// initialize the client object DeliverooApi
const client = new DeliverooApi(host, token);

// Generate an agent
let agent = new Agent(client)


// wait for loading and then start the agent
setTimeout(() => {
    agent.start()  // start the agent
}, constants.TIME_TO_LOAD);